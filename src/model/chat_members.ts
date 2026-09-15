import {
  pgTable,
  serial,
  integer,
  timestamp,
  uuid,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";

import { chats } from "./chats";
import { users } from "./users";


export const chatMemberRoleEnum = pgEnum("chat_member_role", [
  "member",
  "admin",
]);

export const chatMembers = pgTable(
  "chat_members",
  {
    id: serial("id").primaryKey(),

    chatId: integer("chat_id")
      .notNull()
      .references(() => chats.id, {
        onDelete: "cascade",
      }),
    role: chatMemberRoleEnum("role")
      .notNull()
      .default("member"),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    leftAt: timestamp("left_at",{
      withTimezone: true,}),

    joinedAt: timestamp("joined_at",{
      withTimezone: true,})
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