# open-chat-desktop

[中文](README.md) | [English](README.en.md)

OpenChat cross-platform desktop client (Electron + Vue 3 + TypeScript).

## Stack

Electron + electron-vite + Vue 3 + TypeScript + Pinia + Vue Router + Element Plus.

## Layout

- src/main: main process (windows, local node:sqlite, tray, notifications, auto-update)
- src/preload: preload bridge (safe IPC via contextBridge)
- src/renderer: renderer process (Vue 3 application)
- docs: engineering standards and business documents

## Development

- `pnpm install`
- `pnpm dev` — start development mode
- `pnpm build` — electron-vite build

## Contracts

Client contracts (REST / WS / E2EE / message model) are in `docs/contracts.md`; the authoritative baseline is the desktop-client-contract-spec in ai-team.
