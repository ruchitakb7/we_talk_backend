
import { Request, Response } from "express";
import { eq, and, isNull , sql} from "drizzle-orm";

import { db } from "../db/postgresconfig";
import { chatMembers } from "../model/chat_members";
import { messages } from "../model/message";
import { users } from "../model/users";
import { chats } from "../model/chats";

export const removeChatMember = async (
  req: Request,
  res: Response
) => {
  try {
    const { chatId} = req.params;
    const userId = req.params.userId as string;

    console.log("Chat ID:", chatId, "User ID:", userId);

    if (!chatId || !userId) {
      return res.status(400).json({
        message: "Chat ID and user ID are required",
      });
    }

    const numericChatId = Number(chatId);

    // Get the user who is being removed
    const [user] = await db
      .select({
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Check whether the user is currently an active member
    const member = await db
      .select()
      .from(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, numericChatId),
          eq(chatMembers.userId, userId),
          isNull(chatMembers.leftAt)
        )
      )
      .limit(1);

    if (member.length === 0) {
      return res.status(404).json({
        message: "User is not a member of this chat",
      });
    }


    await db
      .update(chatMembers)
      .set({
        leftAt: new Date(),
      })
      .where(
        and(
          eq(chatMembers.chatId, numericChatId),
          eq(chatMembers.userId, userId),
          isNull(chatMembers.leftAt)
        )
      );

    await db
      .update(chats)
      .set({
        totalMembers: sql`${chats.totalMembers} - 1`,
      })
      .where(eq(chats.id, numericChatId));

    const [systemMessage] = await db
      .insert(messages)
      .values({
        chatId: numericChatId,
        senderId: req.user.id,
        type: "system",
        message: `${user.fullName} was removed from the group`,
      })
      .returning();


    const io = req.app.get("io");

    io.to(`chat:${numericChatId}`).emit(
      "new:message",
      systemMessage
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

    const numericChatId = Number(chatId);

    // Get the user who is being added
    const [user] = await db
      .select({
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Check if the user has a membership record
    const existingMember = await db
      .select()
      .from(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, numericChatId),
          eq(chatMembers.userId, userId)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      const member = existingMember[0];

      // User is currently an active member
      if (member.leftAt === null) {
        return res.status(409).json({
          message: "User is already a member of this chat",
        });
      }

      // User was a member before but has left.
      // Re-activate the membership.
      const [updatedMember] = await db
        .update(chatMembers)
        .set({
          joinedAt: new Date(),
          leftAt: null,
          role: "member",
        })
        .where(
          and(
            eq(chatMembers.chatId, numericChatId),
            eq(chatMembers.userId, userId)
          )
        )
        .returning();

      await db
        .update(chats)
        .set({
          totalMembers: sql`${chats.totalMembers} + 1`,
        })
        .where(eq(chats.id, numericChatId));

      // Create system message
      const [systemMessage] = await db
        .insert(messages)
        .values({
          chatId: numericChatId,
          senderId: req.user.id,
          type: "system",
          message: `${user.fullName} was added to the group`,
        })
        .returning();

      // Broadcast system message
      const io = req.app.get("io");

      io.to(`chat:${numericChatId}`).emit(
        "new:message",
        systemMessage
      );

      return res.status(200).json({
        message: "Member added successfully",
        member: updatedMember,
      });
    }

    // User has never been a member of this chat
    const [newMember] = await db
      .insert(chatMembers)
      .values({
        chatId: numericChatId,
        userId,
        role: "member",
      })
      .returning();

    await db
      .update(chats)
      .set({
        totalMembers: sql`${chats.totalMembers} + 1`,
      })
      .where(eq(chats.id, numericChatId));

    // Create system message
    const [systemMessage] = await db
      .insert(messages)
      .values({
        chatId: numericChatId,
        senderId: req.user.id,
        type: "system",
        message: `${user.fullName} was added to the group`,
      })
      .returning();

    // Broadcast system message
    const io = req.app.get("io");

    io.to(`chat:${numericChatId}`).emit(
      "new:message",
      systemMessage
    );

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
    const { chatId } = req.params;
    const userId = req.params.userId as string;

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
    const newRole =member[0].role === "admin"
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

    console.log("Current User ID:", currentUserId, chatId);

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

    const numericChatId = Number(chatId);

    // Check whether current user is currently an active member
    const member = await db
      .select({
        userId: chatMembers.userId,
        fullName: users.fullName,
      })
      .from(chatMembers)
      .innerJoin(
        users,
        eq(chatMembers.userId, users.id)
      )
      .where(
        and(
          eq(chatMembers.chatId, numericChatId),
          eq(chatMembers.userId, currentUserId),
          isNull(chatMembers.leftAt)
        )
      )
      .limit(1);

    if (member.length === 0) {
      return res.status(404).json({
        message: "You are not a member of this group",
      });
    }

    const userName = member[0].fullName;

    // Mark membership as ended
    await db
      .update(chatMembers)
      .set({
        leftAt: new Date(),
      })
      .where(
        and(
          eq(chatMembers.chatId, numericChatId),
          eq(chatMembers.userId, currentUserId),
          isNull(chatMembers.leftAt)
        )
      );

    await db
      .update(chats)
      .set({
        totalMembers: sql`${chats.totalMembers} - 1`,
      })
      .where(eq(chats.id, numericChatId));


    // Create system message
    const [systemMessage] = await db
      .insert(messages)
      .values({
        chatId: numericChatId,
        senderId: currentUserId,
        type: "system",
        message: `${userName} left the group`,
      })
      .returning();

    // Send system message to group in real time
    const io = req.app.get("io");

    io.to(`chat:${numericChatId}`).emit(
      "new:message",
      systemMessage
    );

    return res.status(200).json({
      message: "You left the group successfully",
      data: systemMessage,
    });
  } catch (error) {
    console.error("Leave group error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
