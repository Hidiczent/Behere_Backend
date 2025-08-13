import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface ConversationAttrs {
    id: number;
    talkerId: number;
    listenerId: number;
    status: 'active' | 'ended' | 'dropped';
    startedAt: Date;
    endedAt?: Date | null;
}
type ConversationCreation = Optional<ConversationAttrs, 'id' | 'status' | 'startedAt' | 'endedAt'>;

class Conversation extends Model<ConversationAttrs, ConversationCreation> implements ConversationAttrs {
    public id!: number;
    public talkerId!: number;
    public listenerId!: number;
    public status!: 'active' | 'ended' | 'dropped';
    public startedAt!: Date;
    public endedAt!: Date | null;
}

Conversation.init({
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    talkerId: { type: DataTypes.BIGINT, allowNull: false },
    listenerId: { type: DataTypes.BIGINT, allowNull: false },
    status: { type: DataTypes.ENUM('active', 'ended', 'dropped'), defaultValue: 'active' },
    startedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    endedAt: { type: DataTypes.DATE, allowNull: true }
}, { sequelize, tableName: 'conversations', timestamps: false });

User.hasMany(Conversation, { foreignKey: 'talkerId', as: 'talks' });
User.hasMany(Conversation, { foreignKey: 'listenerId', as: 'listens' });
Conversation.belongsTo(User, { foreignKey: 'talkerId', as: 'talker' });
Conversation.belongsTo(User, { foreignKey: 'listenerId', as: 'listener' });

export default Conversation;
