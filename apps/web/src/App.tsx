import { useEffect, useState } from 'react';
import type { Conversation, Message } from '@eolas/types';
import {
  createConversation,
  listConversations,
  listMessages,
  streamMessage,
} from './api/client.js';
import { AuthGate } from './components/AuthGate.js';
import { Sidebar } from './components/Sidebar.js';
import { MessageThread } from './components/MessageThread.js';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listConversations()
      .then(setConversations)
      .catch(() => setLoadError('Failed to load conversations'));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    listMessages(selectedId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [selectedId]);

  async function handleCreate() {
    setCreating(true);
    try {
      const c = await createConversation();
      setConversations((prev) => [c, ...prev]);
      setSelectedId(c.id);
    } finally {
      setCreating(false);
    }
  }

  async function handleSend(content: string) {
    if (!selectedId || isStreaming) return;

    const optimisticUser: Message = {
      id: `optimistic-${Date.now()}`,
      conversationId: selectedId,
      role: 'user',
      content,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setIsStreaming(true);
    setStreamingText('');

    try {
      let fullText = '';
      for await (const event of streamMessage(selectedId, content)) {
        if (event.type === 'delta') {
          fullText += event.text;
          setStreamingText(fullText);
        } else if (event.type === 'done') {
          // Replace optimistic user message with confirmed IDs, add assistant message
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== optimisticUser.id),
            {
              id: event.userMessageId,
              conversationId: selectedId,
              role: 'user',
              content,
              createdAt: optimisticUser.createdAt,
            },
            {
              id: event.assistantMessageId,
              conversationId: selectedId,
              role: 'assistant',
              content: fullText,
              createdAt: new Date(event.assistantCreatedAt),
            },
          ]);
          // Update conversation title if it changed (first message sets title)
          setConversations((prev) =>
            prev.map((c) =>
              c.id === selectedId
                ? { ...c, title: content.slice(0, 60), updatedAt: new Date() }
                : c,
            ),
          );
          setStreamingText(null);
        } else if (event.type === 'error') {
          setStreamingText(null);
        }
      }
    } catch {
      setStreamingText(null);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <AuthGate>
      <div className="flex h-screen bg-slate-950 text-slate-100">
        <Sidebar
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          creating={creating}
        />

        <main className="flex-1 overflow-hidden">
          {selectedId ? (
            <MessageThread
              messages={messages}
              streamingText={streamingText}
              isStreaming={isStreaming}
              onSend={handleSend}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
              {loadError ? (
                <p className="text-red-400 text-sm">{loadError}</p>
              ) : (
                <>
                  <p className="text-lg font-medium text-slate-300">Eolas</p>
                  <p className="text-sm">Select a conversation or start a new one</p>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </AuthGate>
  );
}
