import type { Conversation, Message } from '@eolas/types';

// In dev: set VITE_API_URL=http://localhost:3001 in apps/web/.env.local
// In prod: leave unset — nginx proxies /v1/ to the internal API service
const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';

function getApiKey(): string {
  return localStorage.getItem('eolas_api_key') ?? '';
}

function headers(withBody = false): Record<string, string> {
  return {
    ...(withBody ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${getApiKey()}`,
  };
}

export async function createConversation(): Promise<Conversation> {
  const res = await fetch(`${BASE_URL}/v1/conversations`, {
    method: 'POST',
    headers: headers(true),
    body: '{}',
  });
  if (!res.ok) throw new Error(`Failed to create conversation: ${res.status}`);
  const data = await res.json() as { id: string; title: string; createdAt: string; updatedAt: string };
  return { ...data, createdAt: new Date(data.createdAt), updatedAt: new Date(data.updatedAt) };
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(`${BASE_URL}/v1/conversations`, { headers: headers() });
  if (!res.ok) throw new Error(`Failed to list conversations: ${res.status}`);
  const data = await res.json() as Array<{ id: string; title: string; createdAt: string; updatedAt: string }>;
  return data.map((c) => ({ ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) }));
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const res = await fetch(`${BASE_URL}/v1/conversations/${conversationId}/messages`, {
    headers: headers(),
  });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`);
  const data = await res.json() as Array<{ id: string; conversationId: string; role: string; content: string; createdAt: string }>;
  return data.map((m) => ({
    ...m,
    role: m.role as 'user' | 'assistant',
    createdAt: new Date(m.createdAt),
  }));
}

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; userMessageId: string; assistantMessageId: string; assistantCreatedAt: string }
  | { type: 'error'; message: string }
  | { type: 'guest_limit' };

export async function* streamMessage(
  conversationId: string,
  content: string,
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${BASE_URL}/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ content }),
  });

  if (res.status === 403) {
    const data = await res.json() as { error: string };
    if (data.error === 'guest_limit') {
      yield { type: 'guest_limit' };
      return;
    }
  }

  if (!res.ok || !res.body) {
    throw new Error(`Failed to send message: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6)) as StreamEvent;
      }
    }
  }
}
