import { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";

import { db } from "../db/postgresconfig";
import { chatMembers } from "../model/chat_members";

export const adminChatMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Current logged-in user
    const currentUserId = req.user?.id;

    // Chat whose admin access we are checking
    const { chatId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!chatId) {
      return res.status(400).json({
        message: "Chat ID is required",
      });
    }

    // Find current user's membership in this chat
    const member = await db
      .select({
        role: chatMembers.role,
      })
      .from(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, Number(chatId)),
          eq(chatMembers.userId, currentUserId)
        )
      )
      .limit(1);

    // User is not a member of this chat
    if (member.length === 0) {
      return res.status(403).json({
        message: "You are not a member of this chat",
      });
    }

    // User is a member but not an admin
    if (member[0].role !== "admin") {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    // User is admin → continue to controller
    next();
  } catch (error) {
    console.error("Admin authorization error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};