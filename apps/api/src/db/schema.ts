import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull(),
  keys: text('keys').notNull(), // encrypted JSON: { p256dh, auth }
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [unique('push_subscriptions_endpoint_unique').on(t.endpoint)]);
