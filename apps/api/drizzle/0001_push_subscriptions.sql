CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"keys" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
