import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as cookie from "cookie";
import jwt from "jsonwebtoken";
import User from "../models/User";
import Conversation from "../models/Conversation";
import { joinQueue, leaveQueue, tryMatch, markChatEnded, snapshot } from "./matchmaking";

type Client = { ws: WebSocket; uid: number; room?: string };
const clients = new Map<number, Client>();

// รอ “รีคอนเน็กต์แท้จริง” ก่อนจะถือว่าหลุด
const closeGraceTimers = new Map<number, NodeJS.Timeout>();

export function initWs(server: HttpServer) {
    const wss = new WebSocketServer({
        server,
        path: "/ws",
        perMessageDeflate: false,
        maxPayload: 64 * 1024,
    });

    const send = (ws: WebSocket, data: any) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
    };

    wss.on("connection", async (ws, req) => {
        // ---- รับ token จาก cookie หรือ query ----
        const cookies = cookie.parse(req.headers.cookie || "");
        let token = cookies.token;
        if (!token) {
            const url = new URL(req.url ?? "", "http://localhost");
            token = url.searchParams.get("token") || undefined;
        }
        if (!token) return ws.close(4001, "No token");

        // ---- verify JWT ----
        let payload: any;
        try { payload = jwt.verify(token, process.env.JWT_SECRET as string); }
        catch { return ws.close(4002, "Bad token"); }

        const rawId = (payload as any)?.id ?? (payload as any)?.uid;
        const uid = Number(rawId);
        if (!Number.isFinite(uid) || uid <= 0) {
            send(ws, { type: "ERROR", message: "Bad uid in token" });
            return ws.close(4003, "Bad uid in token");
        }

        // ยกเลิก grace timer เดิมถ้ามี
        const t = closeGraceTimers.get(uid);
        if (t) { clearTimeout(t); closeGraceTimers.delete(uid); }

        // 1 uid = 1 connection (kick previous after grace) + carry room
        const prev = clients.get(uid);
        clients.set(uid, { ws, uid, room: prev?.room });
        if (prev && prev.ws !== ws) {
            try { send(prev.ws, { type: "REPLACED" }); } catch { }
            console.log("WS: KICK prev after grace uid=", uid);
            setTimeout(() => { try { prev.ws.close(4004, "Replaced by a new connection"); } catch { } }, 200);
        }

        try {
            await User.update({ status: "online", lastSeen: new Date() }, { where: { id: uid } });
        } catch (e) { console.error("[DB] update online failed:", e); }

        send(ws, { type: "HELLO", uid });
        console.log("WS: OPEN uid=", uid);

        const isCurrent = () => clients.get(uid)?.ws === ws;

        ws.on("message", async (raw) => {
            const rawStr = String(raw);
            console.log("[WS] message raw:", rawStr);
            let msg: any;
            try { msg = JSON.parse(rawStr); } catch { return send(ws, { type: "ERROR", message: "Bad JSON" }); }

            if (!isCurrent()) return; // เมินซ็อกเก็ตเก่า

            // ===== QUEUE_LEAVE =====
            if (msg.type === "QUEUE_LEAVE") {
                leaveQueue(uid);
                try { await User.update({ status: "online", lastSeen: new Date() }, { where: { id: uid } }); }
                catch (e) { console.error("[DB] set online after QUEUE_LEAVE failed:", e); }
                console.log("[WS] QUEUE_LEAVE ok uid=", uid, snapshot());
                return;
            }

            // ===== QUEUE_JOIN =====
            if (msg.type === "QUEUE_JOIN") {
                const role = msg.role as "talker" | "listener";
                if (role !== "talker" && role !== "listener") return send(ws, { type: "ERROR", message: "Invalid role" });
                console.log(`[WS] QUEUE_JOIN uid=${uid} role=${role}`);

                try { await User.update({ status: "in_queue", lastSeen: new Date() }, { where: { id: uid } }); }
                catch (e) { console.error("[DB] set in_queue failed:", e); }

                joinQueue(uid, role);

                let match = tryMatch();
                if (!match) {
                    setTimeout(async () => {
                        if (!isCurrent()) return;
                        match = tryMatch();
                        if (!match) {
                            console.log("[WS] QUEUED uid=", uid, snapshot());
                            return send(ws, { type: "QUEUED" });
                        }
                        await createAndAnnounceRoom(match.talkerId, match.listenerId);
                    }, 50);
                    return;
                }
                await createAndAnnounceRoom(match.talkerId, match.listenerId);
                return;
            }

            // ===== MESSAGE =====
            if (msg.type === "MESSAGE") {
                const cid = Number(msg.conversationId);
                const text = String(msg.text ?? "");
                if (!Number.isFinite(cid)) return send(ws, { type: "ERROR", message: "Bad conversationId" });

                const room = `c:${cid}`;
                const cur = clients.get(uid);
                if (!cur || cur.ws !== ws || cur.room !== room) {
                    console.log(`[WS] reject MESSAGE uid=${uid} not in room ${room} (cur=${cur?.room})`);
                    return send(ws, { type: "ERROR", message: "Not in conversation" });
                }

                for (const c of clients.values()) {
                    if (c.room === room) send(c.ws, { type: "MESSAGE_NEW", conversationId: cid, from: uid, text, at: Date.now() });
                }
                return;
            }

            // ===== END =====
            if (msg.type === "END") {
                const cid = Number(msg.conversationId);
                if (!Number.isFinite(cid)) return send(ws, { type: "ERROR", message: "Bad conversationId" });

                const room = `c:${cid}`;
                const cur = clients.get(uid);
                if (!cur || cur.ws !== ws || cur.room !== room) return send(ws, { type: "ERROR", message: "Not in conversation" });

                const peers = [...clients.values()].filter(c => c.room === room);
                peers.forEach(c => { send(c.ws, { type: "CONVERSATION_ENDED", by: uid, conversationId: cid }); c.room = undefined; });

                try {
                    await Conversation.update({ status: "ended", endedAt: new Date() }, { where: { id: cid } });
                    await User.update({ status: "online", lastSeen: new Date() }, { where: { id: peers.map(p => p.uid) } as any });
                } catch (e) { console.error("[DB] end/update failed:", e); }

                markChatEnded(uid, peers.find(p => p.uid !== uid)?.uid ?? uid);
                console.log(`[WS] END by uid=${uid} room=c:${cid}`, snapshot());
                return;
            }
        });

        ws.on("close", (code, reasonBuf) => {
            const reason = reasonBuf.toString();

            // ตั้ง grace เพื่อรอดูว่าจะรีคอนเน็กต์เข้ามาแทนไหม
            const GRACE_MS = 350;

            const oldTimer = closeGraceTimers.get(uid);
            if (oldTimer) clearTimeout(oldTimer);

            const timer = setTimeout(async () => {
                closeGraceTimers.delete(uid);

                const entry = clients.get(uid);
                if (entry && entry.ws !== ws) {
                    console.log("WS: CLOSE (reconnected in grace) uid=", uid, "code=", code, "reason=", reason || "(no reason)");
                    return;
                }

                console.log("WS: CLOSE uid=", uid, "code=", code, "reason=", reason || "(no reason)");

                // ออกจากคิว
                leaveQueue(uid);

                const room = entry?.room; // ถ้าไม่มี entry แสดงว่าถูกลบทิ้งแล้ว
                if (clients.get(uid)?.ws === ws) clients.delete(uid);

                if (room) {
                    for (const other of clients.values()) {
                        if (other.room === room) {
                            other.room = undefined;
                            send(other.ws, { type: "PARTNER_DISCONNECTED" });
                            markChatEnded(uid, other.uid);
                            try { await User.update({ status: "online" }, { where: { id: other.uid } }); }
                            catch (e) { console.error("[DB] set partner online failed:", e); }
                        }
                    }
                    try { await Conversation.update({ status: "dropped", endedAt: new Date() }, { where: { id: Number(room.slice(2)) } }); }
                    catch (e) { console.error("[DB] mark dropped failed:", e); }
                }

                try { await User.update({ status: "offline", lastSeen: new Date() }, { where: { id: uid } }); }
                catch (e) { console.error("[DB] set offline failed:", e); }
            }, GRACE_MS);

            closeGraceTimers.set(uid, timer);
        });

        async function createAndAnnounceRoom(talkerId: number, listenerId: number) {
            const convo = await Conversation.create({
                talkerId, listenerId, status: "active", startedAt: new Date(),
            });

            const room = `c:${convo.id}`;
            const ids = [talkerId, listenerId];

            try { await User.update({ status: "in_chat" }, { where: { id: ids } }); }
            catch (e) { console.error("[DB] set in_chat failed:", e); }

            ids.forEach((id) => {
                const c = clients.get(id);
                if (c) { c.room = room; send(c.ws, { type: "MATCH_FOUND", conversationId: convo.id }); }
            });

            console.log(`[WS] MATCH_FOUND room=${room} talker=${talkerId} listener=${listenerId}`);
        }
    });
}
