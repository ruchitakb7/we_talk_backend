CREATE TYPE "public"."chat_member_role" AS ENUM('member', 'admin');--> statement-breakpoint
ALTER TABLE "chat_members" ADD COLUMN "role" "chat_member_role" DEFAULT 'member' NOT NULL;