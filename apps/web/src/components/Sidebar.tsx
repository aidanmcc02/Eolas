import type { Conversation } from '@eolas/types';

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  creating: boolean;
  createError: string | null;
}

export function Sidebar({ conversations, selectedId, onSelect, onCreate, creating, createError }: Props) {
  return (
    <aside className="w-60 shrink-0 flex flex-col bg-slate-900 border-r border-slate-800 h-full">
      <div className="p-3 border-b border-slate-800 space-y-2">
        <button
          onClick={onCreate}
          disabled={creating}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          New conversation
        </button>
        {createError && (
          <p className="text-xs text-red-400 text-center">{createError}</p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {conversations.length === 0 && (
          <p className="text-center text-xs text-slate-500 mt-8">No conversations yet</p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
              c.id === selectedId
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {c.title}
          </button>
        ))}
      </nav>
    </aside>
  );
}
