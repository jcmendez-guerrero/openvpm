ALTER TABLE "practices" ADD COLUMN "default_language" varchar(8) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" varchar(8);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "preferred_language" varchar(8);--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "language" varchar(8);