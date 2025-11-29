# Time Logger App

A standalone Electron + React build of the DocuFrame floating task timer, extracted so it can run independently. The renderer keeps Chakra UI for styling, lucide-react for icons, and reuses the original timer/services logic where possible.

## Key Dependencies & Inputs

- **Renderer libraries**: React 18, Chakra UI, Emotion, Framer Motion, lucide-react.
- **Timer services**: Reused `taskTimerService` (localStorage state, duration helpers) and `settingsService` (IPC-backed config store).
- **Electron bridge**:
  - `getConfig` / `setConfig` to persist settings (shift hours, productivity target, client CSV path, shortcuts, etc.).
  - `getTaskLogs`, `saveTaskLog`, `deleteTaskLog` for per-day JSON task logs.
  - `readCsv` to surface client names from the configured CSV.
  - `getActiveWindowTitle` (via `get-windows`) so running tasks still log foreground apps.
  - `resizeFloatingTimer`, `sendToMainWindow`, `onMessage`, `removeListener` are stubbed so the existing UI logic can run without the original host window.

## Settings Covered

The compact settings modal focuses on the fields the timer actually needs:
- Work shift start/end (hh:mm 24h).
- Productivity target hours.
- Client CSV path (used for search/presets).
- Optional toggle for window tracking + tracking interval.
- Shortcut presets for quick task selection (pulled directly from the CSV / internal list).

All settings persist inside `userData/time-logger-config.json` and are hot-reloaded by the renderer after saves.

## Structure

```
Time Logger App/
  electron/        # Main + preload scripts, IPC handlers
  renderer/        # Vite-powered React UI
  package.json     # Combined Electron + renderer scripts
  vite.config.ts   # Vite config for renderer (ts/react)
```

See `package.json` for dev/build scripts.

## Development & Build

1. `npm install`
2. `npm run dev` – starts Vite (renderer) and Electron together.  
   - This app now defaults to `http://localhost:5183` to avoid conflicts.  
   - If that port is already taken, set `VITE_DEV_SERVER_PORT` before starting:
       - PowerShell: `$env:VITE_DEV_SERVER_PORT=5190; npm run dev`
       - Command Prompt: `set VITE_DEV_SERVER_PORT=5190 && npm run dev`
3. `npm run build` – bundles the renderer UI and compiles the Electron main/preload scripts (`dist/` + `dist-electron/`).

The preload bridge mirrors the original floating timer API (`getTaskLogs`, `saveTaskLog`, `deleteTaskLog`, `readCsv`, etc.), so the renderer code can keep calling `window.electronAPI.*` without worrying about the host environment.

