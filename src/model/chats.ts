import {
  pgEnum,
  pgTable,
  serial,
  varchar,
  integer,
  uuid,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const chatTypeEnum = pgEnum("chat_type", [
  "private",
  "group",
]);

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),

  type: chatTypeEnum("type").notNull(),

  // Used only for group chats
  name: varchar("name", { length: 100 }),

  createdBy: uuid("created_by")
    .references(() => users.id),

  grpprofile: varchar("grpprofile", {
    length: 255,
  }),


  createdAt: timestamp("created_at",{
  withTimezone: true,})
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at",{
  withTimezone: true,})
    .defaultNow()
    .notNull(),
});