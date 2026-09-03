import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/postgresconfig";
import { users } from "../model/users";
import { eq } from "drizzle-orm";

export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // 1. Get token from cookie
        const token = req.cookies?.accessToken || req.cookies?.token;
        // console.log("Token from cookie:", token);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        // 2. Verify token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET!
        ) as { userId: string };


        const u = await db
            .select({
                id: users.id,
                email: users.email,
                username: users.username,
                fullName: users.fullName,
                profileimg: users.profileimg,
            })
            .from(users)
            .where(eq(users.id, decoded.userId))
            .limit(1);

        const { ...user } = u[0];

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }


        req.user = user;

        next();
    } catch (error) {
        console.error("Auth middleware error:", error);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
};