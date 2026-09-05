import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { db } from "../db/postgresconfig";
import { users } from "../model/users";
import { eq } from "drizzle-orm";

export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    // Get token from cookies
    const cookie = socket.handshake.headers.cookie;

    if (!cookie) {
      return next(new Error("Authentication required"));
    }

    // Extract accessToken from cookie
    const cookies = Object.fromEntries(
      cookie.split("; ").map((item) => {
        const [key, ...value] = item.split("=");
        return [key, value.join("=")];
      })
    );

    const token = cookies.accessToken || cookies.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    // Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as { userId: string };

    // Get user
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        fullName: users.fullName,
        profileimg: users.profileimg,
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      return next(new Error("User not found"));
    }

    // Attach user to socket
    socket.user = user;

    next();
  } catch (error) {
    console.error("Socket authentication error:", error);

    next(new Error("Invalid or expired token"));
  }
};