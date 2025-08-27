import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import User from "./User";

interface ConversationAttrs {
    id: number;
    talkerId: number;
    listenerId: number;
    status: "active" | "ended" | "dropped";
    startedAt: Date;
    endedAt?: Date | null;
}

type ConversationCreation = Optional<
    ConversationAttrs,
    "id" | "status" | "startedAt" | "endedAt"
>;

class Conversation
    extends Model<ConversationAttrs, ConversationCreation>
    implements ConversationAttrs {
    public id!: number;
    public talkerId!: number;
    public listenerId!: number;
    public status!: "active" | "ended" | "dropped";
    public startedAt!: Date;
    public endedAt!: Date | null;
}

Conversation.init(
    {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        talkerId: {
            type: DataTypes.INTEGER, // ✅ แก้ให้ตรงกับ users.id
            allowNull: false,
        },
        listenerId: {
            type: DataTypes.INTEGER, // ✅ แก้ให้ตรงกับ users.id
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM("active", "ended", "dropped"),
            defaultValue: "active",
        },
        startedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        endedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
        sequelize,
        tableName: "conversations",
        timestamps: false,
        indexes: [
            { fields: ["talkerId"] },
            { fields: ["listenerId"] },
            { fields: ["status", "startedAt"] },
        ],
    }
);

// Associations
User.hasMany(Conversation, {
    foreignKey: "talkerId",
    as: "talks",
    onDelete: "CASCADE",
    constraints: true,
});
User.hasMany(Conversation, {
    foreignKey: "listenerId",
    as: "listens",
    onDelete: "CASCADE",
    constraints: true,
});
Conversation.belongsTo(User, {
    foreignKey: "talkerId",
    as: "talker",
    onDelete: "CASCADE",
    constraints: true,
});
Conversation.belongsTo(User, {
    foreignKey: "listenerId",
    as: "listener",
    onDelete: "CASCADE",
    constraints: true,
});

export default Conversation;
