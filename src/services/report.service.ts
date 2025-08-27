// src/services/report.service.ts
import { Transaction } from "sequelize";
import sequelize from "../config/database";
import Conversation from "../models/Conversation";
import Report from "../models/Report"; // ← ต้องมีโมเดลนี้

type Reason = "spam" | "harassment" | "other";

export async function createReport(input: {
    conversationId: number;
    reporterId: number;
    reason: Reason;
    detail?: string | null;
}) {
    const { conversationId, reporterId, reason, detail } = input;

    return await sequelize.transaction(async (t: Transaction) => {
        const conv = await Conversation.findByPk(conversationId, { transaction: t });
        console.log("[report.service] conv:", {
            id: conv?.id,
            talkerId: conv?.talkerId,
            listenerId: conv?.listenerId,
            reporterId,
        });
        if (!conv) throw new Error("CONVERSATION_NOT_FOUND");

        // ให้รายงานได้เฉพาะสมาชิกในห้อง
        const talkerId = Number((conv as any).talkerId);
        const listenerId = Number((conv as any).listenerId);

        console.log("[report.service] conv.toJSON()", conv.toJSON(), "reporterId:", reporterId);
        console.log("[report.service] types:", {
            talkerIdType: typeof (conv as any).talkerId,
            listenerIdType: typeof (conv as any).listenerId,
            reporterIdType: typeof reporterId,
        });

        const isMember = talkerId === Number(reporterId) || listenerId === Number(reporterId);
        if (!isMember) throw new Error("NOT_IN_CONVERSATION");

        const reportedUserId = talkerId === Number(reporterId) ? listenerId : talkerId;


        if (!reportedUserId) throw new Error("REPORTED_USER_NOT_FOUND");

        const r = await Report.create(
            {
                conversationId,
                reporterId,
                reportedUserId,
                reason,
                detail: detail ?? null,
            },
            { transaction: t }
        );

        // (ทางเลือก) อัปเดต flag ผู้ถูกรายงาน เช่นเพิ่มตัวนับ
        // await User.increment({ reportedCount: 1 }, { where: { id: reportedUserId }, transaction: t });

        return {
            id: r.id,
            conversationId,
            reporterId,
            reportedUserId,
            reason,
        };
    });
}
