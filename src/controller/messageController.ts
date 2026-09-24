import { Request, Response } from "express";
import { db } from "../db/postgresconfig";
import { messages } from "../model/message";
import { chatMembers } from "../model/chat_members";
import { eq, and, asc, desc, getTableColumns, isNull, lte, gte, ne } from "drizzle-orm";
import { users } from "../model/users";
import { messageStatuses } from "../model/messagestatus";
import { chats } from "../model/chats";



export const createMessage = async (
  req: Request,
  res: Response
) => {
  try {
    const senderId = req.user.id;
    const { chatId, type, message, caption } = req.body;

    // Validate required fields
    if (!chatId || !type || !message) {
      return res.status(400).json({
        success: false,
        message: "chatId, type and message are required",
      });
    }

    // Check whether user is a member of this chat
    const member = await db
      .select()
      .from(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, chatId),
          eq(chatMembers.userId, senderId),
          isNull(chatMembers.leftAt)
        )
      )
      .limit(1);

    if (member.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this chat",
      });
    }

    const [chat] = await db
      .select({
        totalMembers: chats.totalMembers,
      })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Get active recipients (excluding sender)
    const recipients = await db
      .select({
        userId: chatMembers.userId,
      })
      .from(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, chatId),
          ne(chatMembers.userId, senderId),
          isNull(chatMembers.leftAt)
        )
      );

    // Create message and statuses in a transaction
    const newMessage = await db.transaction(async (tx) => {
      // Create message
      const [createdMessage] = await tx
        .insert(messages)
        .values({
          chatId,
          senderId,
          type,
          message,
          caption: caption || null,
          totalRecipients: chat.totalMembers - 1,
                })
        .returning();

      // Create initial status records for recipients
      if (recipients.length > 0) {
        await tx.insert(messageStatuses).values(
          recipients.map((recipient) => ({
            messageId: createdMessage.id,
            userId: recipient.userId,
            status: "sent" as const,
          }))
        );
      }

      return createdMessage;
    });

    const io = req.app.get("io");

    io.to(`chat:${chatId}`).emit("new:message", newMessage);

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: newMessage,
    });
  } catch (error) {
    console.error("Create message error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send message",
    });
  }
};



// export const getMessages = async (
//   req: Request,
//   res: Response
// ) => {
//   try {
//     const userId = req.user.id;
//     const chatId = Number(req.params.chatId);

//     if (!chatId) {
//       return res.status(400).json({
//         success: false,
//         message: "Chat ID is required",
//       });
//     }

//     // Get user's membership history
//     const [member] = await db
//       .select({
//         joinedAt: chatMembers.joinedAt,
//         leftAt: chatMembers.leftAt,
//       })
//       .from(chatMembers)
//       .where(
//         and(
//           eq(chatMembers.chatId, chatId),
//           eq(chatMembers.userId, userId)
//         )
//       )
//       .limit(1);

//     if (!member) {
//       return res.status(403).json({
//         success: false,
//         message: "You are not a member of this chat",
//       });
//     }

//     let messageCondition;

//     if (member.leftAt !== null) {
//       // User has left/been removed.
//       // Show messages only between their join and leave time.
//       messageCondition = and(
//         eq(messages.chatId, chatId),
//         gte(messages.createdAt, member.joinedAt),
//         lte(messages.createdAt, member.leftAt)
//       );
//     } else {
//       // User is currently an active member.
//       // Show messages from when they joined until now.
//       messageCondition = and(
//         eq(messages.chatId, chatId),
//         gte(messages.createdAt, member.joinedAt)
//       );
//     }

//     const chatMessages = await db
//       .select({
//         ...getTableColumns(messages),
//         senderUsername: users.username,
//         profileimg: users.profileimg || null,
//       })
//       .from(messages)
//       .innerJoin(users, eq(messages.senderId, users.id))
//       .where(messageCondition)
//       .orderBy(asc(messages.createdAt));

//     return res.status(200).json({
//       success: true,
//       data: chatMessages,
//     });
//   } catch (error) {
//     console.error("Get messages error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch messages",
//     });
//   }
// };


export const getMessages = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user.id;
    const chatId = Number(req.params.chatId);

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID is required",
      });
    }

    // Get user's membership history
    const [member] = await db
      .select({
        joinedAt: chatMembers.joinedAt,
        leftAt: chatMembers.leftAt,
      })
      .from(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, chatId),
          eq(chatMembers.userId, userId)
        )
      )
      .limit(1);

    if (!member) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this chat",
      });
    }

    let messageCondition;

    if (member.leftAt !== null) {
      // User has left/been removed.
      // Show messages only between their join and leave time.
      messageCondition = and(
        eq(messages.chatId, chatId),
        gte(messages.createdAt, member.joinedAt),
        lte(messages.createdAt, member.leftAt)
      );
    } else {
      // User is currently an active member.
      // Show messages from when they joined until now.
      messageCondition = and(
        eq(messages.chatId, chatId),
        gte(messages.createdAt, member.joinedAt)
      );
    }

    const chatMessages = await db
      .select({
        ...getTableColumns(messages),
        senderUsername: users.username,
        profileimg: users.profileimg || null,
      })
      .from(messages)
      .innerJoin(
        users,
        eq(messages.senderId, users.id)
      )
      .where(messageCondition)
      .orderBy(asc(messages.createdAt));

    // Calculate status for messages sent by the current user
    const messagesWithStatus = await Promise.all(
      chatMessages.map(async (message) => {
        // Messages received from other users don't need
        // an outgoing status
        if (message.senderId !== userId) {
          return {
            ...message,
            status: null,
          };
        }

        // Private chat / group chat status
        if (message.totalRecipients === 0) {
          return {
            ...message,
            status: "read",
          };
        }

        // Get current status counts
        if (
          message.seenCount ===
          message.totalRecipients
        ) {
          return {
            ...message,
            status: "read",
          };
        }

        else if (message.deliveredCount =message.totalRecipients) {
          return {
            ...message,
            status: "delivered",
          };
        }

        return {
          ...message,
          status: "sent",
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: messagesWithStatus,
    });
  } catch (error) {
    console.error("Get messages error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
  }
};