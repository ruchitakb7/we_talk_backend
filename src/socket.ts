import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { socketAuthMiddleware } from "./middleware/socketmiddleware";
import { updateLastSeen } from "./controller/authcontroller";
import { getLastSeen } from "./controller/chatController";
import { db } from "./db/postgresconfig";
import { chatMembers } from "./model/chat_members";
import { eq, and, sql } from "drizzle-orm";
import { messageStatuses } from "./model/messagestatus";
import { messages } from "./model/message";

export const setupSocket = (httpServer: HttpServer) => {
    const onlineUsers = new Map<string, Set<string>>();

    const io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL,
            credentials: true,
        },
    });

    io.use(socketAuthMiddleware);

    io.on("connection", (socket) => {
        const userId = socket.user.id;

        if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, new Set());
        }

        onlineUsers.get(userId)!.add(socket.id);

        socket.broadcast.emit("user:online", userId);


        socket.on("join:chat", async (chatId: string) => {
            const numericChatId = Number(chatId);

            if (!Number.isInteger(numericChatId)) {
                socket.emit("chat:error", "Invalid chat id");
                return;
            }

            const members = await db
                .select({ userId: chatMembers.userId })
                .from(chatMembers)
                .where(eq(chatMembers.chatId, numericChatId));

            if (!members.some((member) => member.userId === userId)) {
                socket.emit("chat:error", "You are not a member of this chat");
                return;
            }

            const room = `chat:${numericChatId}`;
            socket.join(room);

            // console.log(
            //     `User ${userId} joined chat: ${numericChatId}`
            // );

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
        });

        socket.on("message:delivered", async ({ messageId }) => {
            try {
                const [message] = await db
                    .select({
                        id: messages.id,
                        chatId: messages.chatId,
                        senderId: messages.senderId,
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

                const [statusRecord] = await db
                    .select()
                    .from(messageStatuses)
                    .where(
                        and(
                            eq(messageStatuses.messageId, messageId),
                            eq(messageStatuses.userId, userId)
                        )
                    )
                    .limit(1);

                if (!statusRecord) {
                    return;
                }

                // Prevent duplicate delivery events
                if (statusRecord.status !== "sent") {
                    return;
                }

                await db
                    .update(messageStatuses)
                    .set({
                        status: "delivered",
                        updatedAt: new Date(),
                    })
                    .where(
                        and(
                            eq(messageStatuses.messageId, messageId),
                            eq(messageStatuses.userId, userId)
                        )
                    );

                const [updatedMessage] = await db
                    .update(messages)
                    .set({
                        deliveredCount: sql`${messages.deliveredCount} + 1`,
                    })
                    .where(eq(messages.id, messageId))
                    .returning({
                        id: messages.id,
                        senderId: messages.senderId,
                        deliveredCount: messages.deliveredCount,
                        seenCount: messages.seenCount,
                        totalRecipients: messages.totalRecipients,
                    });

                if (!updatedMessage) {
                    return;
                }

                io.to(`chat:${message.chatId}`).emit(
                    "message:status",
                    {
                        messageId: message.id,
                        senderId: message.senderId,
                        status: "delivered",
                    }
                );

            } catch (error) {
                console.error("Message delivered error:", error);
            }
        });

        socket.on("message:read", async ({ messageId }) => {
            try {


                const [message] = await db
                    .select({
                        id: messages.id,
                        chatId: messages.chatId,
                        senderId: messages.senderId,
                        totalRecipients: messages.totalRecipients,
                        deliveredCount: messages.deliveredCount,
                        seenCount: messages.seenCount,
                    })
                    .from(messages)
                    .where(eq(messages.id, messageId))
                    .limit(1);



                if (!message) {
                    console.log("Message not found");
                    return;
                }

                const [status] = await db
                    .select({
                        id: messageStatuses.id,
                        userId: messageStatuses.userId,
                        status: messageStatuses.status,
                    })
                    .from(messageStatuses)
                    .where(
                        and(
                            eq(messageStatuses.messageId, messageId),
                            eq(messageStatuses.userId, userId)
                        )
                    )
                    .limit(1);



                if (!status) {
                    console.log(
                        "No message status found for this user"
                    );
                    return;
                }

                if (status.status === "read") {
                    console.log("Already read");
                    return;
                }

                // sent -> read
                if (status.status === "sent") {
                    console.log("Changing SENT -> READ");

                    await db
                        .update(messageStatuses)
                        .set({
                            status: "read",
                            updatedAt: new Date(),
                        })
                        .where(eq(messageStatuses.id, status.id));

                    const [updatedMessage] = await db
                        .update(messages)
                        .set({
                            deliveredCount:
                                sql`${messages.deliveredCount} + 1`,
                            seenCount:
                                sql`${messages.seenCount} + 1`,
                        })
                        .where(eq(messages.id, messageId))
                        .returning({
                            deliveredCount:
                                messages.deliveredCount,
                            seenCount:
                                messages.seenCount,
                        });



                    io.to(`chat:${message.chatId}`).emit(
                        "message:status",
                        {
                            messageId: message.id,
                            senderId: message.senderId,
                            status: "read",
                        }
                    );

                    return;
                }

                // delivered -> read
                if (status.status === "delivered") {


                    await db
                        .update(messageStatuses)
                        .set({
                            status: "read",
                            updatedAt: new Date(),
                        })
                        .where(eq(messageStatuses.id, status.id));

                    const [updatedMessage] = await db
                        .update(messages)
                        .set({
                            seenCount:
                                sql`${messages.seenCount} + 1`,
                        })
                        .where(eq(messages.id, messageId))
                        .returning({
                            deliveredCount:
                                messages.deliveredCount,
                            seenCount:
                                messages.seenCount,
                        });


                    io.to(`chat:${message.chatId}`).emit(
                        "message:status",
                        {
                            messageId: message.id,
                            senderId: message.senderId,
                            status: "read",
                        }
                    );
                }
            } catch (error) {
                console.error(
                    "Message read error:",
                    error
                );
            }
        });

        socket.on("chat:opened", async ({ chatId }) => {
            try {
                const userId = socket.user.id;

                // Find all delivered messages for this user in this chat
                const deliveredMessages = await db
                    .select({
                        statusId: messageStatuses.id,
                        messageId: messageStatuses.messageId,
                    })
                    .from(messageStatuses)
                    .innerJoin(
                        messages,
                        eq(messageStatuses.messageId, messages.id)
                    )
                    .where(
                        and(
                            eq(messages.chatId, Number(chatId)),
                            eq(messageStatuses.userId, userId),
                            eq(messageStatuses.status, "delivered")
                        )
                    );

                // Nothing to mark as read
                if (deliveredMessages.length === 0) {
                    return;
                }

                // Mark each message as read
                for (const item of deliveredMessages) {
                    await db
                        .update(messageStatuses)
                        .set({
                            status: "read",
                            updatedAt: new Date(),
                        })
                        .where(eq(messageStatuses.id, item.statusId));

                    // Increase seenCount
                    await db
                        .update(messages)
                        .set({
                            seenCount: sql`${messages.seenCount} + 1`,
                        })
                        .where(eq(messages.id, item.messageId));
                }

                console.log(
                    `Marked ${deliveredMessages.length} messages as read for user ${userId}`
                );
            } catch (error) {
                console.error("Chat opened error:", error);
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