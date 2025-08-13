import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
    const raw =
        req.cookies?.token ||
        (req.headers.authorization?.startsWith("Bearer ")
            ? req.headers.authorization.slice(7)
            : null);
    if (!raw) return res.status(401).json({ ok: false, msg: "No token" });
    try {
        req.user = jwt.verify(raw, process.env.JWT_SECRET as string);
        next();
    } catch {
        return res.status(401).json({ ok: false, msg: "Bad token" });
    }
}

router.get("/me", requireAuth, async (req: any, res) => {
    const me = await User.findByPk(req.user.uid);
    res.json({ ok: true, user: me });
});

router.post("/status", requireAuth, async (req: any, res) => {
    const { status } = req.body; // 'online'|'offline'|'in_queue'|'in_chat'
    await User.update({ status, lastSeen: new Date() }, { where: { id: req.user.uid } });
    res.json({ ok: true });
});

export default router;
