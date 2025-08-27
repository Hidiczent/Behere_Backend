// src/middlewares/requireAdmin.ts
import { RequestHandler } from "express";

// อ่าน ADMIN_IDS จาก .env (เช่น "1,2,3")
const adminIds = (process.env.ADMIN_IDS || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !isNaN(n));

const requireAdmin: RequestHandler = (req, res, next) => {
    const uid = (req as any).userId ?? null;

    if (!uid) {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    if (!adminIds.includes(Number(uid))) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    next();
};

export default requireAdmin;
