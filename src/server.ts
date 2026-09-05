import express from "express";
import "dotenv/config";
import { socketAuthMiddleware } from "./middleware/socketmiddleware";
import cookieParser from "cookie-parser";
import passport from "./config/passport";
import authRoutes from "./routes/authRoutes";
import chatRoutes from "./routes/chatRoutes";
import cors from "cors";
const app = express();
import { createServer } from "http";
import { Server } from "socket.io";
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(passport.initialize());
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);


const httpServer = createServer(app);

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

  console.log("User connected:", userId);

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId)!.add(socket.id);

  // Tell other users this user is online
  socket.broadcast.emit("user:online", userId);

  socket.on("check:user:online", (targetUserId: string) => {
    const isOnline = onlineUsers.has(targetUserId);

    socket.emit("user:online:status", {
      userId: targetUserId,
      isOnline,
    });
  });

  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", userId);
    console.log("Reason:", reason);

    const userSockets = onlineUsers.get(userId);

    if (!userSockets) return;

    userSockets.delete(socket.id);

    if (userSockets.size === 0) {
      onlineUsers.delete(userId);

      console.log("User offline:", userId);

      // Tell other users this user is offline
      socket.broadcast.emit("user:offline", userId);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});