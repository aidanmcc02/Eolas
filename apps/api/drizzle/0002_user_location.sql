CREATE TABLE IF NOT EXISTS "user_location" (
	"id" text PRIMARY KEY NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"label" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
