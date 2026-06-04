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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Eolas</h1>
          <p className="mt-1 text-sm text-slate-400">Enter your API key to continue</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            placeholder="API key"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
