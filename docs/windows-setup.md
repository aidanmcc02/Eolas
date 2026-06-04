# Eolas — Windows 11 Setup Guide

## What you need

| Component | Purpose |
|---|---|
| **Eolas installer** (`.exe`) | The desktop app |
| **Ollama** | Runs the local AI model for the Finance tab |
| **API key** | Connects to the Eolas cloud backend (chat, weather) |

---

## Step 1 — Install Ollama

1. Go to [ollama.com](https://ollama.com) and download the Windows installer.
2. Run the installer. Ollama installs as a background service and starts automatically with Windows.
3. Open **PowerShell** or **Command Prompt** and pull the finance model:

```
ollama pull qwen2.5:7b
```

This downloads ~4.7 GB. You only need to do this once.

> **Verify it worked:** run `ollama list` — you should see `qwen2.5:7b` in the output.

---

## Step 2 — Install Eolas

1. Run the `Eolas_x.x.x_x64-setup.exe` installer.
2. Windows SmartScreen may show a warning — click **More info → Run anyway**. This happens because the app is not code-signed.
3. The app installs to `%LOCALAPPDATA%\eolas\` and creates a Start Menu shortcut.

---

## Step 3 — First launch

1. Open **Eolas** from the Start Menu.
2. You will be prompted for an **API key** — enter the key provided to you.  
   *(This authenticates against the Eolas cloud backend for chat and weather.)*
3. The app will connect and load your conversation history.

---

## Step 4 — Finance tab

The Finance tab is powered entirely by Ollama running locally — no data leaves your machine.

**Requirements:**
- Ollama must be running (it starts automatically with Windows, but you can check via the system tray icon)
- The `qwen2.5:7b` model must be pulled (done in Step 1)

**Workflow:**
1. Log in to your AIB account at [aib.ie](https://aib.ie)
2. Go to **Accounts → Download transactions** and export as CSV
3. Open the **Finance** tab in Eolas and click **IMPORT CSV**
4. Select the downloaded CSV — Eolas automatically filters to last month's transactions
5. Review categories, fix any that are wrong, then click **SAVE MONTH**

**Finance data location:**  
All data is stored locally at `%APPDATA%\eolas\finance.db` — it is never uploaded anywhere.

---

## Troubleshooting

### "ERR: Ollama error: 404"
The model isn't pulled. Open PowerShell and run:
```
ollama pull qwen2.5:7b
```

### "ERR: Failed to fetch" on the Finance tab
Ollama isn't running. Open the system tray and look for the Ollama icon, or run:
```
ollama serve
```

### "ERR: sql.execute not allowed"
This means you're running an older build of Eolas that is missing the SQL permissions. Download the latest installer and reinstall.

### Windows SmartScreen blocks the installer
Click **More info** then **Run anyway**. The app is safe but unsigned.

### Chat / weather not loading
Check that your API key is correct. You can re-enter it via the lock icon in the sidebar.

---

## Keeping Eolas up to date

When a new version is released, download the new `.exe` installer and run it — it will update the existing installation in place. Your saved finance data and conversation history are not affected.

---

## Building the installer yourself

The Windows `.exe` is built automatically by GitHub Actions whenever a version tag is pushed. The resulting installer is attached to the GitHub Release.

### Triggering a release build

```bash
# Tag the commit you want to release
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will:
1. Spin up a `windows-latest` runner
2. Install Rust, Node 20, and pnpm
3. Build the web frontend (`pnpm --filter @eolas/web build`)
4. Run `tauri build` to produce `Eolas_1.0.0_x64-setup.exe`
5. Create a GitHub Release with the installer attached

The workflow file is at [`.github/workflows/build-windows.yml`](../.github/workflows/build-windows.yml).

### Required GitHub secret

Before the first build, add this secret in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `VITE_API_URL` | Your Railway API URL e.g. `https://eolas-api.up.railway.app` |

`GITHUB_TOKEN` is provided automatically by GitHub — no setup needed.

### Triggering a build manually (without a tag)

Go to **GitHub → Actions → Build Windows Installer → Run workflow** and click the button. The installer will be uploaded as a build artifact instead of a release.

### Building locally on Windows

If you want to build on a Windows machine directly:

1. Install [Rust](https://rustup.rs/) (stable toolchain)
2. Install [Node 20+](https://nodejs.org/) and [pnpm](https://pnpm.io/installation)
3. Install the [WebView2 runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually already present on Windows 11)
4. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **C++ build tools** workload

Then from the repo root:

```powershell
pnpm install
pnpm --filter @eolas/desktop build
```

The installer will be at:
```
apps\desktop\src-tauri\target\release\bundle\nsis\Eolas_*_x64-setup.exe
```

---

## Data locations

| Data | Location |
|---|---|
| Finance database | `%APPDATA%\eolas\finance.db` |
| App binaries | `%LOCALAPPDATA%\eolas\` |
| Ollama models | `%USERPROFILE%\.ollama\models\` |

Chat history is stored in the cloud (Railway PostgreSQL) and is available on any device.
