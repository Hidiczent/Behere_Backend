// src/controllers/ratings.controller.ts
import { Request, Response } from "express";
import { upsertRating } from "../services/rating.service";

export async function createRating(req: Request, res: Response) {
    try {
        const raterId = Number((req as any).userId ?? (req as any).user?.id); // ← ตรงนี้
        const { conversationId, rating, feedback } = req.body ?? {};
        if (!raterId || !conversationId || rating == null) {
            return res.status(400).json({ ok: false, error: "MISSING_PARAMS" });
        }
        const result = await upsertRating({
            conversationId: Number(conversationId),
            raterId,
            rating: Number(rating),
            feedback,
        });
        res.json({ ok: true, data: result });
    } catch (e: any) {
        res.status(400).json({ ok: false, error: e.message ?? "ERROR" });
    }
}
