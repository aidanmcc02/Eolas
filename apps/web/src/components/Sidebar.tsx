import type { Conversation } from '@eolas/types';

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  creating: boolean;
  createError: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  conversations, selectedId, onSelect, onCreate, creating, createError, isOpen, onClose,
}: Props) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className={`md:hidden fixed inset-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sidebar panel — drawer on mobile, static on desktop */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full
          md:relative md:translate-x-0 md:z-auto
          w-64 flex flex-col bg-[#080808] border-r border-[#00ff4118]
          transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#00ff4118]">
          <span className="text-[#00ff4160] text-xs tracking-[0.2em]">// SESSIONS</span>
          <button
            onClick={onClose}
            className="md:hidden text-[#00ff4150] hover:text-[#00ff41] text-xl leading-none transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* New session button */}
        <div className="px-3 py-3 border-b border-[#00ff4112]">
          <button
            onClick={onCreate}
            disabled={creating}
            className="w-full border border-[#00ff4138] text-[#00ff41] text-xs py-2 tracking-[0.15em] disabled:opacity-40 hover:bg-[#00ff410a] hover:border-[#00ff4165] hover:shadow-[0_0_10px_rgba(0,255,65,0.14)] active:scale-[0.99] transition-all duration-150"
          >
            {creating ? '[ INITIALIZING... ]' : '[+ NEW SESSION ]'}
          </button>
          {createError && (
            <p className="text-[#ff0040] text-xs mt-1.5 text-center">
              ERR: {createError}
            </p>
          )}
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 && (
            <p className="text-center text-[#00ff4135] text-xs mt-8 px-3">
              // NO SESSIONS FOUND
            </p>
          )}
          {conversations.map((c) => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full text-left px-3 py-2.5 text-xs truncate border-l-2 transition-all duration-150 ${
                  active
                    ? 'border-l-[#00ff41] bg-[#00ff410a] text-[#00ff41] shadow-[inset_0_0_12px_rgba(0,255,65,0.05)]'
                    : 'border-l-transparent text-[#00cc33] hover:text-[#00ff41] hover:bg-[#00ff4107] hover:border-l-[#00ff4140]'
                }`}
              >
                <span className="mr-2 select-none text-[#00ff4155]">
                  {active ? '►' : '·'}
                </span>
                {c.title}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
