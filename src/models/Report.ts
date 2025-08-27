import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export type ReportReason = "spam" | "harassment" | "other"; // ← export ออกมาใช้ร่วมกัน

interface ReportAttrs {
    id: number;
    conversationId: number;
    reporterId: number;
    reportedUserId?: number | null;
    reason: ReportReason;
    detail?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}
type ReportCreation = Optional<
    ReportAttrs,
    "id" | "reportedUserId" | "detail" | "createdAt" | "updatedAt"
>;

class Report extends Model<ReportAttrs, ReportCreation> implements ReportAttrs {
    public id!: number;
    public conversationId!: number;
    public reporterId!: number;
    public reportedUserId!: number | null;
    public reason!: ReportReason;
    public detail!: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Report.init(
    {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        conversationId: { type: DataTypes.BIGINT, allowNull: false },
        reporterId: { type: DataTypes.INTEGER, allowNull: false },
        reportedUserId: { type: DataTypes.INTEGER, allowNull: true },
        reason: {
            type: DataTypes.ENUM("spam", "harassment", "other"),
            allowNull: false,
        },
        detail: { type: DataTypes.TEXT, allowNull: true },
    },
    {
        sequelize,
        tableName: "reports",
        indexes: [
            { fields: ["conversationId"] },
            { fields: ["reportedUserId", "reason"] },
            // ป้องกันการส่งซ้ำจากคนเดิมในห้องเดิม (จะรวม reportedUserId ด้วยก็ได้)
            { unique: true, fields: ["conversationId", "reporterId", "reason"] },
        ],
    }
);

export default Report;
