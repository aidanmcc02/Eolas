# Eolas — CLAUDE.md

Eolas (Irish: "knowledge") is a personal AI assistant for one user (Aidan McCarthy).
This file is the source of truth for architecture decisions and conventions.
Read it at the start of every session.

---

## Three capability areas

| Area | Deployed where | LLM |
|---|---|---|
| Chat | Railway (cloud) | Anthropic Messages API |
| Scheduled agents | Railway (cloud) | Anthropic Messages API |
| Finance analysis | Local machine only | Ollama qwen2.5:14b |

---

## Desktop platform targets

`apps/desktop` must build and run on:
- **CachyOS** (Arch-based) — distribute as AppImage (`.deb`/`.rpm` won't install natively on Arch)
- **Fedora** — AppImage or `.rpm` both work; AppImage preferred for consistency
- **Windows 11** — NSIS installer (`.exe`) via Tauri's built-in bundler

Tauri 2's `"targets": "all"` already generates all formats. The cross-platform-safe distribution
format for Linux is **AppImage** — prefer it in any install docs you write.

Avoid Linux-specific syscalls or paths in Tauri commands (e.g. use `dirs` crate or Tauri's
`app_data_dir()` rather than hardcoding `/home/...`). On Windows, Ollama also runs at
`http://localhost:11434` so the finance module endpoint is the same across platforms.

---

## Non-negotiable privacy constraint

Finance data and its LLM inference are **100% local**. This includes storage.
- `packages/finance` is imported ONLY by `apps/desktop`.
- `apps/api` and `apps/agents` must never import `packages/finance`.
- No financial data ever reaches an external HTTP endpoint.
- **Financial data must never be written to the Railway PostgreSQL database.**
- This constraint must survive refactors. If you see a code path that could route
  finance data to Railway or Anthropic, flag it immediately.

---

## Deployed topology

```
Railway (cloud):
  apps/api      — Fastify REST API, PostgreSQL, Web Push sender
  apps/web      — Vite React PWA, served over HTTPS
  apps/agents   — node-cron jobs (weather, pollen, etc.)

Local (Fedora):
  apps/desktop  — Tauri 2 wrapper around apps/web build
  packages/finance — CSV parsing + Ollama client (never deployed)
  Ollama        — qwen2.5:14b, runs at http://localhost:11434
```

---

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript 5.x everywhere | User's primary ecosystem |
| Frontend | Vite + React 18 | Fast HMR, PWA plugin, reused in Tauri |
| Styling | Tailwind CSS | Utility-first, no runtime |
| Desktop shell | Tauri 2 | Smaller than Electron; wraps the same Vite build |
| API | Fastify 5 | Low overhead, TypeScript-native |
| Database | PostgreSQL (Railway) | Persistent across Railway redeploys |
| ORM | Drizzle | Lightweight, type-safe, migrations-first |
| Agents | node-cron (within apps/agents) | Simple enough for personal cron jobs |
| Notifications | Web Push (VAPID) | Native iOS push via PWA home-screen add |
| Finance LLM | Ollama qwen2.5:14b | 32 GB RAM → ~9 GB headroom; best structured extraction at this size |
| Finance charts | Recharts | React-native, good enough for personal use |
| Finance DB | SQLite via tauri-plugin-sql | Local-only; file in app_data_dir(), never synced to cloud |
| Monorepo | pnpm workspaces + Turborepo | Shared types, single lockfile |

---

## Monorepo layout

```
eolas/
  apps/
    web/          Vite React SPA — deployed as PWA on Railway
    desktop/      Tauri 2 shell  — wraps apps/web build
    api/          Fastify backend — deployed on Railway
    agents/       node-cron jobs  — deployed on Railway
  packages/
    types/        Shared TypeScript interfaces (no runtime code)
    ui/           Shared React components
    finance/      CSV parsing + Ollama client (LOCAL ONLY)
  CLAUDE.md
  turbo.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

---

## Feature gating: Tauri vs browser

The same React frontend runs in both contexts.
Gate finance features with:

```typescript
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
```

- In Tauri: Finance tab is visible; invoke Tauri commands for filesystem access + Ollama.
- In browser (PWA): Finance tab is hidden or shows "Desktop-only feature".

---

## Chat history

Eolas stores its own conversation history in PostgreSQL on Railway.
This is independent of claude.ai — it is a fresh, self-hosted Claude-powered chat.

---

## Finance data source

Manual CSV export from AIB / BoI web portal.
User drops files into a watched local directory.
No open-banking API, no third-party credentials.

## Finance local storage

All finance data is stored in a **local SQLite database** managed by `tauri-plugin-sql`.

- DB file lives at `app_data_dir()/eolas/finance.db` (resolves to `~/.local/share/eolas/` on
  Linux, `%APPDATA%\eolas\` on Windows — never inside the repo).
- The Railway PostgreSQL instance has no finance tables and no finance routes.
- Imported CSV rows, Ollama-assigned categories, and monthly summaries are all persisted
  locally in SQLite so re-running analysis doesn't require re-importing CSVs.
- SQLite schema migrations for finance live in `packages/finance/migrations/`.

---

## Security

Security is paramount. Follow these rules in every session — they are not negotiable.

### At-rest encryption (Railway PostgreSQL)

All user-generated content is encrypted at the **application layer** before it is written
to the database. If an attacker dumps the database, they see only ciphertext.

**Algorithm:** AES-256-GCM (authenticated encryption — also detects tampering).

**What is encrypted:**

| Column | Table | Reason |
|---|---|---|
| `content` | `messages` | Conversation text |
| `title` | `conversations` | May contain sensitive context |

**What is NOT encrypted** (metadata only, low sensitivity):

| Column | Reason |
|---|---|
| `id`, `created_at`, `updated_at` | Non-sensitive structural fields |
| `role` (`user`/`assistant`) | Enum, not personal data |
| `conversation_id` (FK) | UUID reference only |

**Key management:**
- One 32-byte random key, base64-encoded, stored as `ENCRYPTION_KEY` in Railway env vars.
- Never committed to the repo. Never logged.
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- The API server must fail fast on startup if `ENCRYPTION_KEY` is missing or malformed.

**Implementation location:** `apps/api/src/lib/crypto.ts`
- Exports `encrypt(plaintext: string): string` — returns `<base64-iv>:<base64-ciphertext>`
- Exports `decrypt(ciphertext: string): string` — reverses the above
- IV is randomly generated per encryption call (never reused) and prepended to the output.
- These functions are the ONLY place encryption/decryption happens — no inline crypto elsewhere.

**In-transit encryption:** Enforced by Railway's HTTPS termination. All API traffic is TLS.

### Local SQLite (finance)

The finance SQLite DB is not encrypted at rest today (the privacy guarantee comes from the
data never leaving the machine). If this changes in the future, use SQLCipher
(`tauri-plugin-sql` supports it via the `sqlite-cipher` feature flag).

### General rules

- No financial data in logs, error messages, or external services — ever.
- No conversation content in logs. Log route names and status codes only.
- Rotate `ENCRYPTION_KEY` only with a migration that re-encrypts existing rows — document
  the rotation procedure before implementing it.
- Push subscriptions (`endpoint`, `keys`) are not conversation content but should also be
  treated as sensitive — do not log them.

---

## Railway deployment

Each Railway service sets its Root Directory to the repo root and uses the
Dockerfile in the relevant app directory.
- API service:    Dockerfile at apps/api/Dockerfile
- Agents service: Dockerfile at apps/agents/Dockerfile
- Web service:    Dockerfile at apps/web/Dockerfile

Environment variables are set per-service in the Railway dashboard.

---

## Conventions

- All packages use `@eolas/<name>` as the npm package name.
- No `any` in TypeScript except where a third-party type is genuinely unknown.
- All API routes are versioned: `/v1/...`
- Never commit `.env` files. Use `.env.example` with placeholder values.
- Drizzle migrations live in `apps/api/drizzle/`.
- Finance analysis runs are never logged to any external service.

---

## Phase roadmap

| Phase | Scope |
|---|---|
| 0 | Repo skeleton + tooling (done) |
| 1 | Chat MVP: apps/api + apps/web, Anthropic integration, Railway deploy |
| 2 | Desktop: apps/desktop wraps Phase 1 frontend, finance tab stubbed |
| 3 | Agents + Push: weather/pollen cron jobs, Web Push on iPhone |
| 4 | Finance: CSV import, Ollama categorisation, Recharts dashboard |
