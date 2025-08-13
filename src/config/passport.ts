import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import dotenv from "dotenv";
import User from "../models/User";

dotenv.config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            callbackURL: "http://localhost:5050/auth/google/callback",
        },
        async (_accessToken, _refreshToken, profile: Profile, done) => {
            try {
                const email = profile.emails?.[0]?.value || "";
                const name = profile.displayName || email || "Unknown";
                const picture = profile.photos?.[0]?.value ?? null;

                // หา/สร้างผู้ใช้ด้วย googleId (ถ้าเคยมี email ซ้ำก็อัปเดต googleId ให้)
                let user = await User.findOne({ where: { googleId: profile.id } });
                if (!user && email) {
                    user = await User.findOne({ where: { email } });
                }

                if (user) {
                    await user.update({
                        name, email, picture, googleId: profile.id,
                        status: "online",
                        lastSeen: new Date(),
                    });
                    return done(null, user);
                }

                const newUser = await User.create({
                    name,
                    email,
                    googleId: profile.id,
                    picture,
                    status: "online",      // ✅ เข้าใช้งานแล้วเป็น online
                    allowAnonymous: true,  // ถ้าต้องการ default
                    lang: "la",
                    lastSeen: new Date(),
                });
                return done(null, newUser);
            } catch (err) {
                done(err as Error);
            }
        }
    )
);

// (เราไม่ใช้ session ของ passport เพราะจะออก JWT เอง)
export default passport;
