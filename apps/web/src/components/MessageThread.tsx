import { useEffect, useRef, useState } from 'react';
import type { Message } from '@eolas/types';

interface Props {
  messages: Message[];
  streamingText: string | null;
  isStreaming: boolean;
  onSend: (content: string) => void;
}

export function MessageThread({ messages, streamingText, isStreaming, onSend }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && !isStreaming && (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-500 text-sm">Send a message to start</p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}
        {streamingText !== null && (
          <MessageBubble role="assistant" content={streamingText} streaming />
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={submit}
        className="border-t border-slate-800 p-4 flex gap-3 items-end"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message Eolas…"
          rows={1}
          className="flex-1 resize-none rounded-xl bg-slate-800 border border-slate-700 text-white text-sm px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-40 overflow-y-auto"
          style={{ height: 'auto' }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = 'auto';
            t.style.height = `${t.scrollHeight}px`;
          }}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 transition-colors shrink-0"
        >
          {isStreaming ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  streaming = false,
}: {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-slate-800 text-slate-100 rounded-bl-sm'
        }`}
      >
        {content}
        {streaming && (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-slate-400 animate-pulse rounded-sm align-middle" />
        )}
      </div>
    </div>
  );
}
