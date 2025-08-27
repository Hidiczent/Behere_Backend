// src/middlewares/requireAuth.ts
import { RequestHandler } from "express";
import jwt from "jsonwebtoken";

const requireAuth: RequestHandler = (req, res, next) => {
  const authz = req.headers.authorization;
  const bearer = authz?.startsWith("Bearer ") ? authz.slice(7) : null;

  const cookieToken =
    (req as any).cookies?.token || (req as any).signedCookies?.token;

  const token = bearer || cookieToken;

  // 🔍 Debug: log ทุกครั้ง
  console.log("[requireAuth] incoming request:", {
    path: req.path,
    method: req.method,
    hasHeader: !!authz,
    headerAuth: authz,
    hasCookie: !!cookieToken,
  });

  if (!token) {
    console.warn("[requireAuth] ❌ No token found");
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED: NO_TOKEN" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number };
    console.log("[requireAuth] ✅ Token verified:", payload);

    // เก็บเฉพาะ userId; ไม่แตะ req.user เพื่อเลี่ยงชนกับ passport types
    (req as any).userId = payload.id;
    next();
  } catch (err) {
    console.error("[requireAuth] ❌ JWT verify error:", err);
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED: INVALID_TOKEN" });
  }
};

export default requireAuth;
