import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import Conversation from '../models/Conversation';
import { joinQueue, leaveQueue, tryMatch } from './matchmaking';

type Client = { ws: WebSocket; uid: number; role: 'listener' | 'talker'; room?: string };
const clients = new Map<number, Client>(); // uid -> client
export default function initWsServer(server: any) {
    const wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws, req) => {
        // auth ผ่าน query ?token=
        const url = new URL(req.url ?? '', 'http://localhost');
        const token = url.searchParams.get('token');
        if (!token) return ws.close(4001, 'No token');

        let payload: any;
        try { payload = jwt.verify(token, process.env.JWT_SECRET!); }
        catch { ws.close(4002, 'Bad token'); return; }

        const uid = Number(payload.uid);
        const role = (payload.role as 'listener' | 'talker') || 'talker';
        clients.set(uid, { ws, uid, role });

        ws.send(JSON.stringify({ type: 'HELLO', uid, role }));

        ws.on('message', async (raw) => {
            const msg = JSON.parse(String(raw || '{}'));

            if (msg.type === 'QUEUE_JOIN') {
                joinQueue(uid, (msg.role || role));
                const match = tryMatch();
                if (!match) return ws.send(JSON.stringify({ type: 'QUEUED' }));

                const convo = await Conversation.create({
                    talkerId: match.talkerId,
                    listenerId: match.listenerId,
                    status: 'active',
                    startedAt: new Date(),
                });
                const room = `c:${convo.id}`;
                [match.talkerId, match.listenerId].forEach(id => {
                    const c = clients.get(id);
                    if (c) {
                        c.room = room;
                        c.ws.send(JSON.stringify({ type: 'MATCH_FOUND', conversationId: convo.id }));
                    }
                });
            }

            if (msg.type === 'MESSAGE') {
                const c = clients.get(uid);
                if (!c?.room || c.room !== `c:${msg.conversationId}`) return;
                for (const other of clients.values()) {
                    if (other.room === c.room) {
                        other.ws.send(JSON.stringify({
                            type: 'MESSAGE_NEW',
                            conversationId: msg.conversationId,
                            from: uid,
                            text: msg.text,
                            at: Date.now()
                        }));
                    }
                }
                // จะบันทึกข้อความก็ทำตรงนี้ได้
            }

            if (msg.type === 'END') {
                for (const other of clients.values()) {
                    if (other.room === `c:${msg.conversationId}`) {
                        other.ws.send(JSON.stringify({ type: 'CONVERSATION_ENDED', by: uid }));
                        other.room = undefined;
                    }
                }
                await Conversation.update({ status: 'ended', endedAt: new Date() }, { where: { id: msg.conversationId } });
            }
        });

        ws.on('close', () => {
            leaveQueue(uid);
            clients.delete(uid);
            // TODO: ถ้าหลุดระหว่างคุย อาจ mark dropped และแจ้งอีกฝั่ง
        });
    });
}
