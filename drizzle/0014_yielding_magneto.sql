CREATE TYPE "public"."message_status" AS ENUM('sent', 'delivered', 'read');--> statement-breakpoint
CREATE TABLE "message_statuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "message_status" DEFAULT 'sent' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_statuses_message_id_user_id_unique" UNIQUE("message_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "message_statuses" ADD CONSTRAINT "message_statuses_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_statuses" ADD CONSTRAINT "message_statuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;