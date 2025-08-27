// src/models/index.ts
import sequelize from "../config/database";

/* ===== Models ===== */
import User from "./User";
import Conversation from "./Conversation";
import Message from "./Message";
import Rating from "./Rating";
import ConversationReport from "./Report"; // ✅ ถูกไฟล์แล้ว

/* ===== Associations (ที่ยังไม่ตั้งไว้ในแต่ละโมเดล) ===== */

// Message ↔ Conversation/User
Conversation.hasMany(Message, {
    foreignKey: "conversationId",
    onDelete: "CASCADE",
});
Message.belongsTo(Conversation, {
    foreignKey: "conversationId",
});

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

// Rating ↔ User/Conversation
Rating.belongsTo(User, { foreignKey: "raterId", as: "rater" });
Rating.belongsTo(User, { foreignKey: "partnerId", as: "partner" });
Rating.belongsTo(Conversation, {
    foreignKey: "conversationId",
    as: "conversation",
});

// Report ↔ User/Conversation
ConversationReport.belongsTo(User, {
    foreignKey: "reporterId",
    as: "reporter",
});
ConversationReport.belongsTo(User, {
    foreignKey: "reportedUserId",
    as: "reportedUser",
});
ConversationReport.belongsTo(Conversation, {
    foreignKey: "conversationId",
    as: "conversation",
});

/* ===== Debug (เลือกเปิดตอน dev) ===== */
// console.log("Registered models:", Object.keys(sequelize.models));

/* ===== Exports ===== */
export {
    sequelize,
    User,
    Conversation,
    Message,
    Rating,
    ConversationReport, // ✅ export ออกไปด้วย
};
export default sequelize;
