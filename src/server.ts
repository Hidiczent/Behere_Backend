import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import http from "http";

import sequelize from "./models"; // <-- ไฟล์นี้ต้อง import User/Conversation/Message และประกาศ associations แล้ว
import passport from "./config/passport";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import { initWs } from "./ws/index";

dotenv.config();

const app = express();
const isProd = process.env.NODE_ENV === "production";

// ====== CORS (รองรับหลาย origin ผ่านคอมมา) ======
const ORIGINS = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

if (!ORIGINS.length) {
    console.warn("⚠️ FRONTEND_URL is not set. Set it in .env (can be comma-separated).");
}


app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin) return cb(null, true); // เช่น Postman/health check
            if (ORIGINS.includes(origin)) return cb(null, true);
            return cb(null, false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// ====== Security ======
if (isProd) app.set("trust proxy", 1);
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    })
);

// ====== Rate limit ======
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.method === "OPTIONS" || req.path === "/health",
    })
);

// ====== Parsers ======
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

// ====== Passport ======
app.use(passport.initialize());

// ====== Routes ======
app.use("/auth", authRoutes);
app.use("/", userRoutes);

// ====== Cookie options helper ======
export const cookieOpts = () =>
    ({
        httpOnly: true,
        sameSite: "lax",
        secure: isProd, // ต้องเป็น true เมื่ออยู่หลัง HTTPS
    }) as const;

// ====== Boot ======
(async () => {
    try {
        await sequelize.authenticate();
        console.log("✅ Database connected");

        if (!isProd) {
            await sequelize.sync(); // ชั่วคราวเพื่อดู SQL
            console.log("🛠️ Models synced (dev)");
        }

        const server = http.createServer(app);
        initWs(server); // attach WebSocket

        const PORT = Number(process.env.PORT || 5000);
        server.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
    } catch (err) {
        console.error("DB error:", err);
        process.exit(1);
    }
})();
