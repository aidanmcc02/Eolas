import { useState, type ReactNode } from 'react';

const KEY = 'eolas_api_key';

function isKeyStored(): boolean {
  return Boolean(localStorage.getItem(KEY));
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(isKeyStored);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    localStorage.setItem(KEY, trimmed);
    setAuthed(true);
    setError('');
  }

  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4 animate-flicker">
      <div className="w-full max-w-md animate-fade-in">

        {/* Terminal window chrome */}
        <div className="border border-[#00ff4128] rounded-sm overflow-hidden shadow-[0_0_40px_rgba(0,255,65,0.06)]">

          {/* Title bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#0d0d0d] border-b border-[#00ff4120]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff000055] inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffaa0055] inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#00ff4155] inline-block" />
            <span className="text-[#00ff4155] text-xs ml-2">eolas — secure terminal</span>
          </div>

          {/* Terminal body */}
          <div className="p-5 bg-[#080808] min-h-60">

            {/* Title with glitch */}
            <p className="text-[#00ff41] text-sm mb-1 animate-glitch">
              EOLAS SECURE TERMINAL v2.0.4
            </p>
            <p className="text-[#00ff4125] text-xs mb-5 select-none">
              {'═'.repeat(34)}
            </p>

            {/* Boot sequence — pure CSS staggered delays, no React state */}
            <div className="space-y-1 text-xs mb-5">
              <p className="t-boot-1 text-[#00cc33]">
                {'>'} INITIALIZING SYSTEM CORE
                <span className="text-[#00ff41]"> [OK]</span>
              </p>
              <p className="t-boot-2 text-[#00cc33]">
                {'>'} LOADING ENCRYPTION MODULE
                <span className="text-[#00ff41]"> [OK]</span>
              </p>
              <p className="t-boot-3 text-[#00cc33]">
                {'>'} ESTABLISHING SECURE CHANNEL
                <span className="text-[#00ff41]"> [OK]</span>
              </p>
              <p className="t-boot-4 text-[#00cc33]">
                {'>'} VERIFYING INTEGRITY CHECK
                <span className="text-[#00ff41]"> [OK]</span>
              </p>
              <p className="t-boot-5 text-[#00cc33]">
                {'>'} AUTHENTICATION REQUIRED.
              </p>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[#ff0040] text-xs mb-3 animate-fade-in">
                ✗ ACCESS DENIED — {error}
              </p>
            )}

            {/* Password prompt — appears after boot sequence */}
            <form onSubmit={submit} className="t-boot-6 space-y-3">
              <div className="flex items-center gap-2 border border-[#00ff4130] px-3 py-2.5 focus-within:border-[#00ff4165] focus-within:shadow-[0_0_10px_rgba(0,255,65,0.12)] transition-all duration-200">
                <span className="text-[#00ff41] text-sm shrink-0">$ Password:</span>
                <input
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="t-input flex-1 text-sm min-w-0"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
                {!input && (
                  <span className="animate-blink text-[#00ff41] text-sm shrink-0 select-none">█</span>
                )}
              </div>

              <button
                type="submit"
                className="w-full border border-[#00ff4140] text-[#00ff41] text-xs py-2.5 tracking-[0.18em] hover:bg-[#00ff410c] hover:border-[#00ff4175] hover:shadow-[0_0_14px_rgba(0,255,65,0.18)] active:scale-[0.99] transition-all duration-150"
              >
                [ AUTHENTICATE ]
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-[#00ff4128] text-xs mt-3 select-none">
          ENCRYPTED CHANNEL · TLS 1.3
        </p>
      </div>
    </div>
  );
}
