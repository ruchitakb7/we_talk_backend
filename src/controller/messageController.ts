import { Request, Response } from "express";
import { db } from "../db/postgresconfig";
import { messages } from "../model/message";
import { chatMembers } from "../model/chat_members";
import { eq, and, asc, desc, getTableColumns } from "drizzle-orm";
import { users } from "../model/users";



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
                    eq(chatMembers.userId, senderId)
                )
            )
            .limit(1);

        if (member.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this chat",
            });
        }

        // Create message
        const [newMessage] = await db
            .insert(messages)
            .values({
                chatId,
                senderId,
                type,
                message,
                caption: caption || null,
            })
            .returning();

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

        // Check if user is a member of the chat
        const member = await db
            .select()
            .from(chatMembers)
            .where(
                and(
                    eq(chatMembers.chatId, chatId),
                    eq(chatMembers.userId, userId)
                )
            )
            .limit(1);

        if (member.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this chat",
            });
        }

        // Fetch messages
        const chatMessages = await db
            .select({
                ...getTableColumns(messages),
                senderUsername: users.username,
                profileimg: users.profileimg||null
            })
            .from(messages)
            .innerJoin(users, eq(messages.senderId, users.id))
            .where(eq(messages.chatId, chatId))
            .orderBy(asc(messages.createdAt));

        return res.status(200).json({
            success: true,
            data: chatMessages,
        });
    } catch (error) {
        console.error("Get messages error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch messages",
        });
    }
};