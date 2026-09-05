import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { socketAuthMiddleware } from "./middleware/socketmiddleware";
import { updateLastSeen } from "./controller/authcontroller";
import {getLastSeen} from "./controller/chatController";


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

        socket.on("check:user:online", async (targetUserId: string) => {
            const isOnline = onlineUsers.has(targetUserId);
            console.log(onlineUsers);
            console.log(`User ${targetUserId} online status:`, isOnline);

             const last_seen = await getLastSeen(targetUserId);
            //  console.log("last_seen in socket:", last_seen);

            socket.emit("user:online:status", {
                userId: targetUserId,
                isOnline,
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

                socket.broadcast.emit("user:offline", {
                    userId,
                    last_seen,
                });
            }
        });
    });

    return io;
};