import {
  pgEnum,
  pgTable,
  serial,
  integer,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { messages } from "./message";
import { users } from "./users";

// Message status enum
export const messageStatusEnum = pgEnum(
  "message_status",
  ["sent", "delivered", "read"]
);

export const messageStatuses = pgTable(
  "message_statuses",
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

    status: messageStatusEnum("status")
      .notNull()
      .default("sent"),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
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