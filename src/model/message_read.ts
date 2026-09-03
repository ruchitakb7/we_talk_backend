import {
  pgTable,
  serial,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { messages } from "./message";
import { users } from "./users";

export const messageReads = pgTable(
  "message_reads",
  {
    id: serial("id").primaryKey(),

    messageId: integer("message_id")
      .notNull()
      .references(() => messages.id, {
        onDelete: "cascade",
      }),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    readAt: timestamp("read_at")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueMessageUser: unique().on(
      table.messageId,
      table.userId
    ),
  })
);