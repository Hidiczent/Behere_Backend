// src/controllers/reports.controller.ts
import { Request, Response } from "express";
import { z } from "zod";
import { createReport } from "../services/report.service";

const CreateReportSchema = z.object({
    conversationId: z.coerce.number().int().positive(),
    reason: z.enum(["spam", "harassment", "other"]),
    detail: z.string().trim().max(2000).optional(),
    // ไม่รับ reportedUserId จาก FE; ให้ BE อนุมานเอง
});

export async function createReportController(req: Request, res: Response) {
    try {
        const reporterId = Number((req as any).userId ?? (req as any).user?.id);

        // 🔍 DEBUG: log สิ่งที่เข้ามาในคำขอครั้งนี้ (ปลอดภัย ไม่มี token)
        console.log("[reports.controller] hit", {
            path: req.path,
            method: req.method,
            reporterId,
            body: req.body,
        });

        if (!reporterId) {
            return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
        }

        const parsed = CreateReportSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            const details = parsed.error.flatten();
            console.warn("[reports.controller] VALIDATION_ERROR", details);
            return res.status(400).json({ ok: false, error: "VALIDATION_ERROR", details });
        }

        const { conversationId, reason, detail } = parsed.data;

        const result = await createReport({
            conversationId,
            reporterId,
            reason,
            detail: detail ?? null,
        });

        return res.json({ ok: true, data: result });
    } catch (e: any) {
        const code = typeof e?.message === "string" ? e.message : "ERROR";
        console.warn("[reports.controller] service error:", code);

        // map error ที่คาดไว้ให้เป็น 400 เพื่อให้ FE แสดงผลได้เหมาะสม
        const known = new Set([
            "CONVERSATION_NOT_FOUND",
            "NOT_IN_CONVERSATION",
            "REPORTED_USER_NOT_FOUND",
            "CONVERSATION_NOT_ENDED",
        ]);
        if (known.has(code)) {
            return res.status(400).json({ ok: false, error: code });
        }
        // ไม่คาดคิด → 500
        return res.status(500).json({ ok: false, error: "ERROR" });
    }
}
