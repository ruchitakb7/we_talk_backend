import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  uuid,
  unique,
} from "drizzle-orm/pg-core";

import { messages } from "./message";
import { users } from "./users";

export const messageReactions = pgTable(
  "message_reactions",
  {
    id: serial("id").primaryKey(),

    messageId: integer("message_id")
      .notNull()
      .references(() => messages.id, {
        onDelete: "cascade",
      }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    emoji: varchar("emoji", {
      length: 20,
    }).notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueUserReaction: unique().on(
      table.messageId,
      table.userId,
      table.emoji
    ),
  })
);