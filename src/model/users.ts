import {
  pgTable,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: varchar("email", {
    length: 255,
  }).notNull().unique(),

  fullName:varchar("fullName", {
    length: 255,
  }).notNull().default("User"),

  password: varchar("password", {
    length: 255,
  }),

  username: varchar("username", {
    length: 30,
  }).unique(),

  profileimg: varchar("profileimg", {
    length: 255,
  }),

  googleId: varchar("google_id", {
    length: 255,
  }).unique(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),

  last_seen: timestamp("last_seen"),
});