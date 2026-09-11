import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { socketAuthMiddleware } from "./middleware/socketmiddleware";
import { updateLastSeen } from "./controller/authcontroller";
import { getLastSeen } from "./controller/chatController";
import { db } from "./db/postgresconfig";
import { chatMembers } from "./model/chat_members";
import { eq } from "drizzle-orm";


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

        socket.on("typing", ({ chatId }) => {
            const room = `chat:${chatId}`;

            console.log("Typing event received:", {
                userId,
                chatId,
                socketId: socket.id,
                recipients: Math.max((io.sockets.adapter.rooms.get(room)?.size ?? 0) - 1, 0),
            });

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