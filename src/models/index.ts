// src/models/index.ts
import sequelize from "../config/database";
import User from "./User";
import Conversation from "./Conversation";
import Message from "./Message";

Conversation.hasMany(Message, { foreignKey: "conversationId", onDelete: "CASCADE" });
Message.belongsTo(Conversation, { foreignKey: "conversationId" });
Message.belongsTo(User, { foreignKey: "senderId", as: "sender", onDelete: "CASCADE" });

export { sequelize, User, Conversation, Message };
export default sequelize;
