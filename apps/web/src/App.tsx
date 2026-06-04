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
import { subscribeToPush, needsPushPrompt } from './lib/push.js';
import { MessageThread } from './components/MessageThread.js';
import { FinanceTab } from './components/FinanceTab.js';
import { isTauri } from './lib/tauri.js';

type Tab = 'chat' | 'finance';

export default function App() {
  const [tab, setTab] = useState<Tab>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPushBanner, setShowPushBanner] = useState(() => needsPushPrompt());

  useEffect(() => {
    listConversations()
      .then(setConversations)
      .catch(() => setLoadError('Failed to load conversations'));
  }, []);

  // If permission was already granted (e.g. from a previous session), re-subscribe
  // silently so the subscription is saved to the API — no user gesture needed.
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      subscribeToPush().catch(() => {});
    }
  }, []);

  async function handleEnableNotifications() {
    setShowPushBanner(false);
    await subscribeToPush().catch(() => {});
  }

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
    setCreateError(null);
    try {
      const c = await createConversation();
      setConversations((prev) => [c, ...prev]);
      setSelectedId(c.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create conversation');
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
      <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
        {showPushBanner && (
          <button
            onClick={handleEnableNotifications}
            className="shrink-0 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2 px-4 text-center transition-colors"
          >
            Tap to enable daily weather &amp; pollen notifications
          </button>
        )}

        {isTauri && (
          <nav className="shrink-0 flex border-b border-slate-800 bg-slate-900 px-2">
            <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>
              Chat
            </TabButton>
            <TabButton active={tab === 'finance'} onClick={() => setTab('finance')}>
              Finance
            </TabButton>
          </nav>
        )}

        {tab === 'finance' ? (
          <FinanceTab />
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <Sidebar
              conversations={conversations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreate={handleCreate}
              creating={creating}
              createError={createError}
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
        )}
      </div>
    </AuthGate>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-indigo-500 text-white'
          : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}
