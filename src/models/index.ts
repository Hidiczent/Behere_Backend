// src/models/index.ts (เวอร์ชันแก้แล้ว)
import sequelize from "../config/database";
import User from "./User";
import Conversation from "./Conversation";
import Message from "./Message";
import Rating from "./Rating";
import Report from "./Report";

/** Conversation ↔ Message */
Conversation.hasMany(Message, {
    foreignKey: "conversationId",
    as: "messages",
    onDelete: "CASCADE",
});
Message.belongsTo(Conversation, {
    foreignKey: "conversationId",
    as: "conversation",
    onDelete: "CASCADE",
});

/** User ↔ Message (sender) */
User.hasMany(Message, {
    foreignKey: "senderId",
    as: "sentMessages",
    onDelete: "CASCADE",
});
Message.belongsTo(User, {
    foreignKey: "senderId",
    as: "sender",
    onDelete: "CASCADE",
});

/** Conversation ↔ User (reverse only; belongsTo อยู่ใน Conversation.ts แล้ว) */
User.hasMany(Conversation, { foreignKey: "talkerId", as: "talkerConversations" });
User.hasMany(Conversation, { foreignKey: "listenerId", as: "listenerConversations" });

/** Rating ↔ User/Conversation */
Rating.belongsTo(User, { foreignKey: "raterId", as: "rater" });
Rating.belongsTo(User, { foreignKey: "partnerId", as: "partner" });
Rating.belongsTo(Conversation, { foreignKey: "conversationId", as: "conversation" });

User.hasMany(Rating, { foreignKey: "raterId", as: "givenRatings" });
User.hasMany(Rating, { foreignKey: "partnerId", as: "receivedRatings" });
Conversation.hasMany(Rating, { foreignKey: "conversationId", as: "ratings" });

/** Report ↔ User/Conversation */
Report.belongsTo(User, { foreignKey: "reporterId", as: "reporter" });
Report.belongsTo(User, { foreignKey: "reportedUserId", as: "reported" });
Report.belongsTo(Conversation, { foreignKey: "conversationId", as: "conversation" });

User.hasMany(Report, { foreignKey: "reporterId", as: "reportsMade" });
User.hasMany(Report, { foreignKey: "reportedUserId", as: "reportsReceived" });
Conversation.hasMany(Report, { foreignKey: "conversationId", as: "reports" });

export { sequelize, User, Conversation, Message, Rating, Report as ConversationReport };
export default sequelize;
