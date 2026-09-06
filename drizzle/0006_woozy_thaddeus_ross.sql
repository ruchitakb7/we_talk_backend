ALTER TABLE "messages" ADD COLUMN "type" "message_type" DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "message" text NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "text";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "message_type";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "media_url";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "media_type";