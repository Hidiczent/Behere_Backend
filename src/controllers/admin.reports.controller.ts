// src/controllers/admin.reports.controller.ts
import { Request, Response } from "express";
import ConversationReport from "../models/Report";
import User from "../models/User";
import Conversation from "../models/Conversation";

export async function listReports(req: Request, res: Response) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
    const reason = req.query.reason as "spam" | "harassment" | "other" | undefined;

    const where: any = {};
    if (reason) where.reason = reason;

    const { rows, count } = await ConversationReport.findAndCountAll({
        where,
        include: [
            { model: User, as: "reporter", attributes: ["id", "email", "displayName"] },
            { model: User, as: "reportedUser", attributes: ["id", "email", "displayName"] },
            {
                model: Conversation,
                as: "conversation",
                attributes: ["id", "status", "startedAt", "endedAt"],
            },
        ],
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset: (page - 1) * pageSize,
    });

    // ทำ DTO ง่าย ๆ ให้ FE ใช้สะดวก
    const data = rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        reason: r.reason,
        detail: r.detail,
        reporter: r.get("reporter"),
        reported: r.get("reportedUser"),
        conversation: r.get("conversation"),
    }));

    res.json({
        ok: true,
        data,
        meta: { page, pageSize, total: count, pages: Math.ceil(count / pageSize) },
    });
}
