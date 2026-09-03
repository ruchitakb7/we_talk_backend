import {
  pgTable,
  serial,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { chats } from "./chats";
import { users } from "./users";

export const chatMembers = pgTable(
  "chat_members",
  {
    id: serial("id").primaryKey(),

    chatId: integer("chat_id")
      .notNull()
      .references(() => chats.id, {
        onDelete: "cascade",
      }),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    joinedAt: timestamp("joined_at")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueChatUser: unique().on(
      table.chatId,
      table.userId
    ),
  })
);