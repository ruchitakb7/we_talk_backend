ALTER TABLE "messages" ADD COLUMN "totalRecipients" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deliveredCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "seenCount" integer DEFAULT 0 NOT NULL;