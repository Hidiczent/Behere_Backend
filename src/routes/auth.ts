import { Router, Request, Response, NextFunction } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User";
import requireAuth from "../middlewares/requireAuth";

const router = Router();
const isProd = process.env.NODE_ENV === "production";

// ช่วยเลือกลิงก์ FE ตัวแรกในกรณีที่ FRONTEND_URL เป็นคอมมา
function firstFrontend(): string {
    const list = (process.env.FRONTEND_URL || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
    return list[0] || "http://localhost:5173";
}

// ช่วยตั้งคุกกี้ให้ปลอดภัยตาม env
function cookieOpts() {
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax" as const,
        path: "/",
    };
}

/** สร้าง state แล้วเก็บใน signed cookie (อายุสั้น) */
router.get("/google", (req: Request, res: Response, next: NextFunction) => {
    const state = crypto.randomBytes(16).toString("base64url");
    res.cookie("oauth_state", state, {
        ...cookieOpts(),
        signed: true,
        maxAge: 5 * 60 * 1000, // 5 นาที
    });
    return passport.authenticate("google", {
        scope: ["profile", "email"],
        state,
    })(req, res, next);
});

/** callback: ตรวจ state จาก cookie ก่อน แล้วค่อยออก JWT ใส่ httpOnly cookie */
router.get(
    "/google/callback",
    (req, res, next) => {
        const cookieState = req.signedCookies?.oauth_state;
        const queryState = req.query.state;
        if (!cookieState || !queryState || cookieState !== queryState) {
            // เคลียร์ state ทิ้งเพื่อไม่ให้ค้าง
            res.clearCookie("oauth_state", { path: "/" });
            return res.status(400).send("Invalid OAuth state");
        }
        // ลบคุกกี้ state ทิ้ง (ใช้แล้วทิ้ง)
        res.clearCookie("oauth_state", { path: "/" });
        next();
    },
    passport.authenticate("google", { session: false, failureRedirect: "/auth/fail" }),
    async (req: any, res) => {
        const user = req.user as User;

        // ✨ ทำ payload ให้ "สอดคล้องทั้งระบบ" → ใช้ uid แทน id
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, {
            expiresIn: "7d",
        });

        // ใส่ token ลง httpOnly cookie
        res.cookie("token", token, {
            ...cookieOpts(),
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 วัน
        });

        // redirect กลับ FE โดย "ไม่" แปะ token ใน URL
        return res.redirect(`${firstFrontend()}/auth/callback`);
    }
);

router.get("/fail", (_req, res) => {
    // กัน state ค้างหากมี
    res.clearCookie("oauth_state", { path: "/" });
    return res.status(401).json({ ok: false, message: "Authentication failed" });
});

/** ตรวจว่า logged-in อยู่ไหม */
router.get("/check", requireAuth, (_req, res) => {
    return res.sendStatus(204); // 204 = OK ไม่มีเนื้อหา
});

/** logout: ลบคุกกี้ token */
router.post("/logout", (_req, res) => {
    res.clearCookie("token", cookieOpts());
    res.sendStatus(204);
});

export default router;
