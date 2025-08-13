import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface UserAttributes {
    id: number;
    email: string;
    name: string;
    googleId: string;
    picture?: string | null;

    role?: "listener" | "talker" | null;                 // ✅ optional
    status: "offline" | "online" | "in_queue" | "in_chat";
    lastSeen?: Date | null;
    lang?: string | null;
    allowAnonymous: boolean;

    rating?: number | null;
    ratingsCount?: number;
    reportsCount?: number;
    blockedUntil?: Date | null;

    createdAt?: Date;
    updatedAt?: Date;
}

type UserCreationAttributes = Optional<
    UserAttributes,
    | "id" | "picture"
    | "role"                           // ✅ optional
    | "lastSeen" | "lang" | "allowAnonymous"
    | "rating" | "ratingsCount" | "reportsCount" | "blockedUntil"
    | "status" | "createdAt" | "updatedAt"
>;

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
    public id!: number;
    public email!: string;
    public name!: string;
    public googleId!: string;
    public picture!: string | null;

    public role!: "listener" | "talker" | null;
    public status!: "offline" | "online" | "in_queue" | "in_chat";
    public lastSeen!: Date | null;
    public lang!: string | null;
    public allowAnonymous!: boolean;

    public rating!: number | null;
    public ratingsCount!: number;
    public reportsCount!: number;
    public blockedUntil!: Date | null;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

User.init(
    {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(255), allowNull: false },
        googleId: { type: DataTypes.STRING(255), allowNull: false, unique: true },
        picture: { type: DataTypes.STRING(255), allowNull: true },

        // ✅ ใช้ STRING + validate ให้ตรงกับ TEXT+CHECK ของ DB
        role: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: { isIn: [["listener", "talker"]] },
            // ไม่มี default → สมัครใหม่ไม่ต้องมี role
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "offline",
            validate: { isIn: [["offline", "online", "in_queue", "in_chat"]] },
        },

        // ✅ map field ให้ตรงชื่อคอลัมน์จริง
        lastSeen: { type: DataTypes.DATE, allowNull: true, field: "lastseen" },
        lang: { type: DataTypes.STRING(5), allowNull: true, defaultValue: "la" },
        allowAnonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "allowanonymous" },

        rating: { type: DataTypes.FLOAT, allowNull: true },
        ratingsCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "ratingscount" },
        reportsCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "reportscount" },
        blockedUntil: { type: DataTypes.DATE, allowNull: true, field: "blockeduntil" },
    },
    {
        sequelize,
        tableName: "users",
        indexes: [
            { fields: ["email"], unique: true },
            { fields: ["googleId"], unique: true },
            // { fields: ["role"] },  // ถ้าจะเก็บ role ไว้เป็น optional จะสร้าง index ไว้ก็ได้ แต่ไม่จำเป็น
            { fields: ["status"] },
            { fields: ["lang"] },
        ],
    }
);

export default User;
