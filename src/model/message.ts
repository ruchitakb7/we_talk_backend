import {
  pgEnum,
  pgTable,
  serial,
  integer,
  text,
  varchar,
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

  chatId: integer("chat_id")
    .notNull()
    .references(() => chats.id, {
      onDelete: "cascade",
    }),

  senderId: integer("sender_id")
    .notNull()
    .references(() => users.id),

  // Text content
  text: text("text"),

  messageType: messageTypeEnum("message_type")
    .notNull()
    .default("text"),

  mediaUrl: text("media_url"),

  mediaType: varchar("media_type", {
    length: 100,
  }),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),

  // Soft delete
  deletedAt: timestamp("deleted_at"),
});