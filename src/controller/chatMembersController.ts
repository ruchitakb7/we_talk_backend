
import { Request, Response } from "express";
import { eq, and } from "drizzle-orm";

import { db } from "../db/postgresconfig";
import { chatMembers } from "../model/chat_members";

export const removeChatMember = async (
  req: Request,
  res: Response
) => {
  try {
    const { chatId, userId } = req.params;
    console.log("Chat ID:", chatId, "User ID:", userId);

    if (!chatId || !userId) {
      return res.status(400).json({
        message: "Chat ID and user ID are required",
      });
    }

    // Check whether the user is actually a member of this chat
    const member = await db
      .select()
      .from(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, Number(chatId)),
          eq(chatMembers.userId, userId)
        )
      )
      .limit(1);

    if (member.length === 0) {
      return res.status(404).json({
        message: "User is not a member of this chat",
      });
    }

    // Remove member
    await db
      .delete(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, Number(chatId)),
          eq(chatMembers.userId, userId)
        )
      );

    return res.status(200).json({
      message: "Member removed successfully",
    });
  } catch (error) {
    console.error("Remove chat member error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


export const addChatMember = async (
  req: Request,
  res: Response
) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({
        message: "Chat ID and user ID are required",
      });
    }

    // Check if user is already a member
    const existingMember = await db
      .select()
      .from(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, Number(chatId)),
          eq(chatMembers.userId, userId)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      return res.status(409).json({
        message: "User is already a member of this chat",
      });
    }

    // Add member
    const [newMember] = await db
      .insert(chatMembers)
      .values({
        chatId: Number(chatId),
        userId,
        role: "member",
      })
      .returning();

    return res.status(201).json({
      message: "Member added successfully",
      member: newMember,
    });
  } catch (error) {
    console.error("Add chat member error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const toggleMemberRole = async (
  req: Request,
  res: Response
) => {
  try {
    const { chatId, userId } = req.params;

    if (!chatId || !userId) {
      return res.status(400).json({
        message: "Chat ID and user ID are required",
      });
    }

    // Find member
    const member = await db
      .select()
      .from(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, Number(chatId)),
          eq(chatMembers.userId, userId)
        )
      )
      .limit(1);

    if (member.length === 0) {
      return res.status(404).json({
        message: "User is not a member of this chat",
      });
    }

    // Toggle role
    const newRole =
      member[0].role === "admin"
        ? "member"
        : "admin";

    const [updatedMember] = await db
      .update(chatMembers)
      .set({
        role: newRole,
      })
      .where(
        and(
          eq(chatMembers.chatId, Number(chatId)),
          eq(chatMembers.userId, userId)
        )
      )
      .returning();

    return res.status(200).json({
      message: `Member role changed to ${newRole}`,
      member: updatedMember,
    });
  } catch (error) {
    console.error("Toggle member role error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


export const leaveGroup = async (
  req: Request,
  res: Response
) => {
  try {
    const currentUserId = req.user?.id;
    const { chatId } = req.params;
    console.log("Current User ID:", currentUserId,chatId);

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

    // Check whether current user is a member of the group
    const member = await db
      .select()
      .from(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, Number(chatId)),
          eq(chatMembers.userId, currentUserId)
        )
      )
      .limit(1);

    if (member.length === 0) {
      return res.status(404).json({
        message: "You are not a member of this group",
      });
    }

    // Remove current user from the group
    await db
      .delete(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, Number(chatId)),
          eq(chatMembers.userId, currentUserId)
        )
      );

    return res.status(200).json({
      message: "You left the group successfully",
    });
  } catch (error) {
    console.error("Leave group error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};