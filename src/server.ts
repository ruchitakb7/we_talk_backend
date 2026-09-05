import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import passport from "./config/passport";
import authRoutes from "./routes/authRoutes";
import chatRoutes from "./routes/chatRoutes";
import cors from "cors";
import { setupSocket } from "./socket";
const app = express();
import { createServer } from "http";
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

setupSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});