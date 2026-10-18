import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { socketAuthMiddleware } from "./middleware/socketmiddleware";
import { updateLastSeen } from "./controller/authcontroller";
import { getLastSeen } from "./controller/chatController";
import { db } from "./db/postgresconfig";
import { chatMembers } from "./model/chat_members";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";
import { messageStatuses } from "./model/messagestatus";
import { messages } from "./model/message";
import {
    aggregateMessageStatus,
    getStatusTransition,
    type MessageStatus,
} from "./utils/messageStatus";

export const setupSocket = (httpServer: HttpServer) => {
    const onlineUsers = new Map<string, Set<string>>();

    const io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL,
            credentials: true,
        },
    });

    io.use(socketAuthMiddleware);

    const transitionRecipientStatus = async (
        messageId: number,
        recipientId: string,
        targetStatus: "delivered" | "read"
    ) =>
        db.transaction(async (tx) => {
            const previousStatuses: MessageStatus[] =
                targetStatus === "read" ? ["sent", "delivered"] : ["sent"];

            for (const previousStatus of previousStatuses) {
                const transition = getStatusTransition(previousStatus, targetStatus);
                if (!transition) {
                    continue;
                }

                const [updatedStatus] = await tx
                    .update(messageStatuses)
                    .set({
                        status: targetStatus,
                        updatedAt: new Date(),
                    })
                    .where(
                        and(
                            eq(messageStatuses.messageId, messageId),
                            eq(messageStatuses.userId, recipientId),
                            eq(messageStatuses.status, previousStatus)
                        )
                    )
                    .returning({ messageId: messageStatuses.messageId });

                if (!updatedStatus) {
                    continue;
                }

                await tx
                    .update(messages)
                    .set({
                        deliveredCount: sql`${messages.deliveredCount} + ${transition.deliveredCountDelta}`,
                        seenCount: sql`${messages.seenCount} + ${transition.seenCountDelta}`,
                    })
                    .where(eq(messages.id, messageId));

                return { status: targetStatus };
            }

            return null;
        });

    const emitRecipientStatus = async (
        chatId: number,
        senderId: string,
        messageId: number
    ) => {
        const [message] = await db
            .select({
                deliveredCount: messages.deliveredCount,
                seenCount: messages.seenCount,
                totalRecipients: messages.totalRecipients,
            })
            .from(messages)
            .where(eq(messages.id, messageId))
            .limit(1);

        if (!message) {
            return;
        }

        const status = aggregateMessageStatus(
            message.deliveredCount,
            message.seenCount,
            message.totalRecipients
        );

        io.to(`user:${senderId}`)
            .to(`chat:${chatId}`)
            .emit("message:status", { messageId, senderId, status });
    };

    const deliverPendingMessages = async (recipientId: string) => {
        const pendingMessages = await db
            .select({
                messageId: messageStatuses.messageId,
                chatId: messages.chatId,
                senderId: messages.senderId,
            })
            .from(messageStatuses)
            .innerJoin(messages, eq(messageStatuses.messageId, messages.id))
            .where(
                and(
                    eq(messageStatuses.userId, recipientId),
                    eq(messageStatuses.status, "sent")
                )
            );

        for (const pending of pendingMessages) {
            const updated = await transitionRecipientStatus(
                pending.messageId,
                recipientId,
                "delivered"
            );
            if (updated) {
                await emitRecipientStatus(
                    pending.chatId,
                    pending.senderId,
                    pending.messageId
                );
            }
        }
    };

    io.on("connection", (socket) => {
        const userId = socket.user.id;

        socket.join(`user:${userId}`);

        if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, new Set());
        }

        onlineUsers.get(userId)!.add(socket.id);

        socket.broadcast.emit("user:online", userId);

        void deliverPendingMessages(userId).catch((error) => {
            console.error("Pending message delivery error:", error);
        });

        socket.on("join:chat", async (chatId: string) => {
            try {
                const numericChatId = Number(chatId);

                if (!Number.isInteger(numericChatId) || numericChatId <= 0) {
                    socket.emit("chat:error", "Invalid chat id");
                    return;
                }

                const members = await db
                    .select({ userId: chatMembers.userId })
                    .from(chatMembers)
                    .where(
                        and(
                            eq(chatMembers.chatId, numericChatId),
                            isNull(chatMembers.leftAt)
                        )
                    );

                if (!members.some((member) => member.userId === userId)) {
                    socket.emit("chat:error", "You are not a member of this chat");
                    return;
                }

                const room = `chat:${numericChatId}`;
                socket.join(room);

                const memberStatuses = await Promise.all(
                    members
                        .filter((member) => member.userId !== userId)
                        .map(async (member) => {
                            const isOnline = onlineUsers.has(member.userId);

                            return {
                                userId: member.userId,
                                isOnline,
                                status: isOnline ? "online" : "offline",
                                last_seen: isOnline ? null : await getLastSeen(member.userId),
                            };
                        })
                );

                for (const status of memberStatuses) {
                    socket.emit("user:online:status", status);
                }

                socket.to(room).emit("user:online:status", {
                    userId,
                    isOnline: true,
                    status: "online",
                    last_seen: null,
                });
            } catch (error) {
                console.error("Join chat error:", error);
                socket.emit("chat:error", "Failed to join chat");
            }
        });

        socket.on("message:delivered", async ({ messageId }) => {
            try {
                if (!Number.isInteger(messageId) || messageId <= 0) {
                    return;
                }

                const [message] = await db
                    .select({
                        id: messages.id,
                        chatId: messages.chatId,
                        senderId: messages.senderId,
                    })
                    .from(messages)
                    .where(eq(messages.id, messageId))
                    .limit(1);

                if (!message) {
                    return;
                }

                const updated = await transitionRecipientStatus(
                    messageId,
                    userId,
                    "delivered"
                );
                if (updated) {
                    await emitRecipientStatus(
                        message.chatId,
                        message.senderId,
                        message.id
                    );
                }
            } catch (error) {
                console.error("Message delivered error:", error);
            }
        });

        socket.on("message:read", async ({ messageId }) => {
            try {
                if (!Number.isInteger(messageId) || messageId <= 0) {
                    return;
                }

                const [message] = await db
                    .select({
                        id: messages.id,
                        chatId: messages.chatId,
                        senderId: messages.senderId,
                    })
                    .from(messages)
                    .where(eq(messages.id, messageId))
                    .limit(1);

                if (!message) {
                    return;
                }

                const updated = await transitionRecipientStatus(
                    messageId,
                    userId,
                    "read"
                );
                if (updated) {
                    await emitRecipientStatus(
                        message.chatId,
                        message.senderId,
                        message.id
                    );
                }
            } catch (error) {
                console.error("Message read error:", error);
            }
        });

        socket.on("chat:opened", async ({ chatId }) => {
            try {
                const numericChatId = Number(chatId);
                if (!Number.isInteger(numericChatId) || numericChatId <= 0) {
                    socket.emit("chat:error", "Invalid chat id");
                    return;
                }

                const [membership] = await db
                    .select({
                        chatId: chatMembers.chatId,
                    })
                    .from(chatMembers)
                    .where(
                        and(
                            eq(chatMembers.chatId, numericChatId),
                            eq(chatMembers.userId, userId),
                            isNull(chatMembers.leftAt)
                        )
                    )
                    .limit(1);

                if (!membership) {
                    socket.emit("chat:error", "You are not a member of this chat");
                    return;
                }

                const unreadMessages = await db
                    .select({
                        messageId: messageStatuses.messageId,
                        senderId: messages.senderId,
                    })
                    .from(messageStatuses)
                    .innerJoin(
                        messages,
                        eq(messageStatuses.messageId, messages.id)
                    )
                    .where(
                        and(
                            eq(messages.chatId, numericChatId),
                            eq(messageStatuses.userId, userId),
                            inArray(messageStatuses.status, ["sent", "delivered"])
                        )
                    );

                for (const unread of unreadMessages) {
                    const updated = await transitionRecipientStatus(
                        unread.messageId,
                        userId,
                        "read"
                    );
                    if (updated) {
                        await emitRecipientStatus(
                            numericChatId,
                            unread.senderId,
                            unread.messageId
                        );
                    }
                }
            } catch (error) {
                console.error("Chat opened error:", error);
                socket.emit("chat:error", "Failed to mark chat messages as read");
            }
        });

        socket.on("typing", ({ chatId }) => {
            const room = `chat:${chatId}`;



            socket.to(room).emit("typing", {
                userId: socket.user.id,
                chatId,
            });
        });



        socket.on("stop-typing", ({ chatId }) => {
            const room = `chat:${chatId}`;

            socket.to(room).emit("stop-typing", {
                userId: socket.user.id,
                chatId,
            });
        });

        socket.on("check:user:online", async (targetUserId: string) => {
            const isOnline = onlineUsers.has(targetUserId);
            const last_seen = isOnline ? null : await getLastSeen(targetUserId);

            socket.emit("user:online:status", {
                userId: targetUserId,
                isOnline,
                status: isOnline ? "online" : "offline",
                last_seen,
            });
        });

        socket.on("disconnect", async (reason) => {

            const userSockets = onlineUsers.get(userId);

            if (!userSockets) return;

            userSockets.delete(socket.id);

            if (userSockets.size === 0) {
                onlineUsers.delete(userId);
                const last_seen = await updateLastSeen(userId);

                const offlineStatus = {
                    userId,
                    isOnline: false,
                    status: "offline",
                    last_seen,
                };

                socket.broadcast.emit("user:offline", offlineStatus);

                for (const room of socket.rooms) {
                    if (room.startsWith("chat:")) {
                        socket.to(room).emit("user:online:status", offlineStatus);
                    }
                }
            }
        });
    });

    return io;
};