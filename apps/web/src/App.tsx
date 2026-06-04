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
import { WeatherTab } from './components/WeatherTab.js';
import { isTauri } from './lib/tauri.js';

type Tab = 'chat' | 'weather' | 'finance';

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const p = new URLSearchParams(window.location.search).get('tab');
    return (p === 'weather' || p === 'finance') ? p : 'chat';
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPushBanner, setShowPushBanner] = useState(() => needsPushPrompt());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [guestLimitHit, setGuestLimitHit] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'navigate-tab') setTab(e.data.tab as Tab);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    listConversations()
      .then(setConversations)
      .catch(() => setLoadError('Failed to load conversations'));
  }, []);

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
    if (!selectedId) { setMessages([]); return; }
    listMessages(selectedId).then(setMessages).catch(() => setMessages([]));
  }, [selectedId]);

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const c = await createConversation();
      setConversations((prev) => [c, ...prev]);
      setSelectedId(c.id);
      setSidebarOpen(false);
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
          setConversations((prev) =>
            prev.map((c) =>
              c.id === selectedId
                ? { ...c, title: content.slice(0, 60), updatedAt: new Date() }
                : c,
            ),
          );
          setStreamingText(null);
        } else if (event.type === 'guest_limit') {
          // Message was never stored — remove the optimistic entry and show banner
          setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
          setStreamingText(null);
          setGuestLimitHit(true);
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
      <div className="flex flex-col h-screen bg-[#080808] text-[#00ff41] animate-flicker">

        {/* Push notification banner */}
        {showPushBanner && (
          <button
            onClick={handleEnableNotifications}
            className="shrink-0 w-full bg-[#00ff4110] hover:bg-[#00ff4118] text-[#00ff41] text-xs py-2 px-4 text-center transition-colors border-b border-[#00ff4130] tracking-widest"
          >
            [!] TAP TO ENABLE WEATHER &amp; POLLEN ALERTS
          </button>
        )}

        {/* Tab navigation */}
        <nav className="shrink-0 flex items-center border-b border-[#00ff4118] bg-[#0a0a0a] px-1">
          {/* Hamburger — mobile only, only on chat tab */}
          {tab === 'chat' && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-[#00ff4165] hover:text-[#00ff41] px-3 py-3 transition-colors text-base select-none"
              aria-label="Open sessions"
            >
              ≡
            </button>
          )}

          <TerminalTab active={tab === 'chat'} onClick={() => setTab('chat')}>CHAT</TerminalTab>
          <TerminalTab active={tab === 'weather'} onClick={() => setTab('weather')}>WEATHER</TerminalTab>
          {isTauri && (
            <TerminalTab active={tab === 'finance'} onClick={() => setTab('finance')}>FINANCE</TerminalTab>
          )}

          {/* Status indicator */}
          <div className="ml-auto flex items-center gap-2 pr-3">
            <span className="text-[#00ff4135] text-xs hidden sm:block tracking-wider">EOLAS v2</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse shrink-0" />
          </div>
        </nav>

        {/* Content area */}
        {tab === 'weather' ? (
          <WeatherTab />
        ) : tab === 'finance' ? (
          <FinanceTab />
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <Sidebar
              conversations={conversations}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setSidebarOpen(false); setGuestLimitHit(false); }}
              onCreate={handleCreate}
              creating={creating}
              createError={createError}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />

            <main className="flex-1 overflow-hidden flex flex-col">
              {guestLimitHit && (
                <div className="flex-shrink-0 px-4 py-2 border-b border-[#ffaa0033] bg-[#ffaa0008] flex items-center justify-between gap-4">
                  <p className="text-xs text-[#ffaa00] tracking-wide">
                    GUEST LIMIT — one message per conversation.
                    Start a new conversation to send another message.
                  </p>
                  <button
                    onClick={() => setGuestLimitHit(false)}
                    className="text-[#ffaa0066] hover:text-[#ffaa00] text-xs flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              )}
              {selectedId ? (
                <MessageThread
                  messages={messages}
                  streamingText={streamingText}
                  isStreaming={isStreaming}
                  onSend={handleSend}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 px-4">
                  {loadError ? (
                    <p className="text-[#ff0040] text-xs">ERR: {loadError}</p>
                  ) : (
                    <>
                      <p className="text-[#00ff41] text-xl tracking-widest animate-glitch select-none">
                        EOLAS
                      </p>
                      <p className="text-[#00ff4140] text-xs tracking-widest text-center">
                        SELECT SESSION OR INITIALIZE NEW
                      </p>
                      {/* Mobile shortcut to open sidebar */}
                      <button
                        onClick={() => setSidebarOpen(true)}
                        className="md:hidden mt-3 border border-[#00ff4138] text-[#00ff41] text-xs px-6 py-2 tracking-widest hover:bg-[#00ff410d] hover:border-[#00ff4165] transition-all duration-150"
                      >
                        [ OPEN SESSIONS ]
                      </button>
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

function TerminalTab({
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
      className={`px-3 py-3 text-xs tracking-widest border-b-2 transition-all duration-150 ${
        active
          ? 'border-[#00ff41] text-[#00ff41] shadow-[0_4px_14px_rgba(0,255,65,0.12)]'
          : 'border-transparent text-[#00ff4148] hover:text-[#00ff41a0] hover:border-[#00ff4130]'
      }`}
    >
      [{children}]
    </button>
  );
}
