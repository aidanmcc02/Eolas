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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#080808]">

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 md:px-5">
        {messages.length === 0 && !isStreaming && (
          <div className="h-full flex items-center justify-center">
            <p className="text-[#00ff4128] text-xs tracking-widest select-none">
              // AWAITING INPUT
            </p>
          </div>
        )}
        {messages.map((m) => (
          <TerminalMessage key={m.id} role={m.role} content={m.content} />
        ))}
        {streamingText !== null && (
          <TerminalMessage role="assistant" content={streamingText} streaming />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-[#00ff4118] bg-[#0a0a0a] px-3 py-3 md:px-4">
        <form onSubmit={submit} className="flex items-end gap-2">
          <div className="flex-1 flex items-end gap-2 border border-[#00ff4125] px-3 py-2 focus-within:border-[#00ff4160] focus-within:shadow-[0_0_10px_rgba(0,255,65,0.1)] transition-all duration-200">
            <span className="text-[#00ff41] text-sm shrink-0 pb-px select-none">$</span>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="enter command..."
              rows={1}
              className="t-input flex-1 text-sm max-h-32 overflow-y-auto"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = `${t.scrollHeight}px`;
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="border border-[#00ff4138] text-[#00ff41] text-xs px-3 py-2 shrink-0 disabled:opacity-30 hover:bg-[#00ff410d] hover:border-[#00ff4165] hover:shadow-[0_0_8px_rgba(0,255,65,0.18)] active:scale-[0.97] transition-all duration-150"
          >
            {isStreaming ? '[···]' : '[ >> ]'}
          </button>
        </form>
      </div>
    </div>
  );
}

function TerminalMessage({
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
    <div className={`flex gap-2 text-sm animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Role indicator */}
      <span className={`text-xs mt-0.5 shrink-0 select-none ${isUser ? 'text-[#00ff4155]' : 'text-[#00ff4140]'}`}>
        {isUser ? '>' : '»'}
      </span>

      {/* Message content */}
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words leading-relaxed text-sm ${
          isUser
            ? 'text-right text-[#00ff41]'
            : 'text-left text-[#00cc33]'
        }`}
      >
        {content}
        {streaming && (
          <span className="animate-blink text-[#00ff41] ml-0.5 select-none">█</span>
        )}
      </div>
    </div>
  );
}
