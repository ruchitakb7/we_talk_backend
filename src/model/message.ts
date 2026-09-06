import {
  pgEnum,
  pgTable,
  serial,
  integer,
  text,
  uuid,
  timestamp,
} from "drizzle-orm/pg-core";

import { chats } from "./chats";
import { users } from "./users";

export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "image",
  "video",
  "file",
  "audio",
]);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),

  // Personal chat OR group chat
  chatId: integer("chat_id")
    .notNull()
    .references(() => chats.id, {
      onDelete: "cascade",
    }),

  // User who sent the message
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id),

  // Type of message
  type: messageTypeEnum("type")
    .notNull()
    .default("text"),

  caption: text("caption"),

  // Text content OR media file path/name
  message: text("message").notNull(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),

  // Soft delete
  deletedAt: timestamp("deleted_at"),
});