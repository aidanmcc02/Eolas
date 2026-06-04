// Shared types used across apps/api, apps/web, apps/agents.
// Finance types live in packages/finance — do NOT import them here.

export type Conversation = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Message = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
};

export type PushSubscription = {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: Date;
};
