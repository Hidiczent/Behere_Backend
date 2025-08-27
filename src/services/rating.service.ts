// src/services/rating.service.ts
import { Transaction } from "sequelize";
import sequelize from "../config/database";
import Conversation from "../models/Conversation";
import Rating from "../models/Rating";
import User from "../models/User";

/**
 * ตรวจสิทธิ์การให้คะแนน
 * - ห้องต้องถูกปิดแล้ว (status='ended' และมี endedAt)
 * - ผู้ให้คะแนนต้องเป็นหนึ่งในสมาชิกของห้อง
 * - ถ้าส่ง partnerId มาด้วย จะเช็คว่า partnerId ตรงกับอีกฝั่งจริง
 */
export async function canUserRate(
    conversationId: number,
    raterId: number,
    partnerId?: number
) {
    const conv = await Conversation.findByPk(conversationId);
    if (!conv || conv.status !== "ended" || !conv.endedAt) {
        return { ok: false, reason: "CONVERSATION_NOT_ENDED" as const };
    }

    const isMember = conv.talkerId === raterId || conv.listenerId === raterId;
    if (!isMember) return { ok: false, reason: "NOT_IN_CONVERSATION" as const };

    if (typeof partnerId === "number") {
        const expectedPartner =
            conv.talkerId === raterId ? conv.listenerId : conv.talkerId;
        if (partnerId !== expectedPartner) {
            return { ok: false, reason: "NOT_IN_CONVERSATION" as const };
        }
    }

    return { ok: true as const };
}

/**
 * บันทึก/อัปเดตคะแนนของ rater ต่อ partner ในห้องที่จบแล้ว
 * - หา partnerId จากข้อมูลห้องโดยอัตโนมัติ
 * - upsert คะแนน
 * - คำนวณ COUNT/AVG ของ partner แล้วอัปเดตที่ตาราง users
 */
export async function upsertRating(input: {
    conversationId: number;
    raterId: number;
    rating: number;
    feedback?: string | null;
}) {
    const { conversationId, raterId, rating, feedback } = input;

    if (rating < 1 || rating > 5) throw new Error("INVALID_RATING");

    return await sequelize.transaction(async (t: Transaction) => {
        // 1) ตรวจห้อง และหา partnerId
        const conv = await Conversation.findByPk(conversationId, { transaction: t });
        if (!conv || conv.status !== "ended" || !conv.endedAt) {
            throw new Error("CONVERSATION_NOT_ENDED");
        }

        const talkerId = Number((conv as any).talkerId);
        const listenerId = Number((conv as any).listenerId);

        const isMember = talkerId === Number(raterId) || listenerId === Number(raterId);
        if (!isMember) throw new Error("NOT_IN_CONVERSATION");

        const partnerId = talkerId === Number(raterId) ? listenerId : talkerId;

        // 2) upsert คะแนน (unique ต่อ conversationId + raterId + partnerId ตามที่ออกแบบ)
        await Rating.upsert(
            { conversationId, raterId, partnerId, rating, feedback: feedback ?? null },
            { transaction: t }
        );

        // 3) คำนวณ COUNT / AVG ของ partner แบบ type-safe (ไม่ใช้ Rating.avg)
        const [stats] = await Rating.findAll({
            where: { partnerId },
            attributes: [
                [sequelize.fn("COUNT", sequelize.col("id")), "count"],
                [sequelize.fn("AVG", sequelize.col("rating")), "avg"],
            ],
            transaction: t,
            raw: true,
        });

        const count = Number((stats as any)?.count ?? 0);
        const avg = Number((stats as any)?.avg ?? 0);

        // 4) อัปเดตโปรไฟล์ของ partner
        await User.update(
            { rating: avg || null, ratingsCount: count },
            { where: { id: partnerId }, transaction: t }
        );

        return { ok: true as const, count, avg };
    });
}
