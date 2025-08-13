// src/models/Message.ts
import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface MessageAttrs {
    id: number;
    conversationId: number;   // FK -> conversations.id (BIGINT)
    senderId: number;         // FK -> users.id (INTEGER)  ✅ เปลี่ยนตรงนี้
    content: string;
    sentAt: Date;
}
type MessageCreation = Optional<MessageAttrs, 'id' | 'sentAt'>;

class Message extends Model<MessageAttrs, MessageCreation> implements MessageAttrs {
    public id!: number;
    public conversationId!: number;
    public senderId!: number;
    public content!: string;
    public sentAt!: Date;
}

Message.init(
    {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        conversationId: { type: DataTypes.BIGINT, allowNull: false }, // BIGINT ↔ conversations.id
        senderId: { type: DataTypes.INTEGER, allowNull: false },      // INTEGER ↔ users.id ✅
        content: { type: DataTypes.TEXT, allowNull: false },
        sentAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
        sequelize,
        tableName: 'messages',
        timestamps: false,
        indexes: [
            { fields: ['conversationId', 'sentAt'] },
            { fields: ['senderId', 'sentAt'] },
        ],
    }
);

export default Message;
