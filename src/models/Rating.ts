import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface RatingAttrs {
    id: number;
    conversationId: number;   // BIGINT -> conversations.id
    raterId: number;          // INTEGER -> users.id
    partnerId: number;        // INTEGER -> users.id
    rating: number;           // 1..5
    feedback?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}
type RatingCreation = Optional<RatingAttrs, "id" | "feedback" | "createdAt" | "updatedAt">;

class Rating extends Model<RatingAttrs, RatingCreation> implements RatingAttrs {
    public id!: number;
    public conversationId!: number;
    public raterId!: number;
    public partnerId!: number;
    public rating!: number;
    public feedback!: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Rating.init(
    {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        conversationId: { type: DataTypes.BIGINT, allowNull: false },
        raterId: { type: DataTypes.INTEGER, allowNull: false },
        partnerId: { type: DataTypes.INTEGER, allowNull: false },
        rating: {                      // ✅ แก้เป็น SMALLINT
            type: DataTypes.SMALLINT,
            allowNull: false,
            validate: { min: 1, max: 5 },
        },
        feedback: { type: DataTypes.TEXT, allowNull: true },
    },
    {
        sequelize,
        tableName: "ratings",
        indexes: [
            { unique: true, fields: ["conversationId", "raterId", "partnerId"], name: "uq_rating_conversation_rater_partner" },
            { fields: ["partnerId"] },
        ],
    }
);

export default Rating;
