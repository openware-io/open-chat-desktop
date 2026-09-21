# gv_chat_desktop

WV Chat 跨平台桌面客户端（Electron + Vue 3 + TypeScript）。

## 技术栈

Electron + electron-vite + Vue 3 + TypeScript + Pinia + Vue Router + Element Plus。

## 目录结构

- src/main：主进程（窗口、本地库 node:sqlite、托盘、通知、自动更新）
- src/preload：预加载桥（contextBridge 暴露安全 IPC）
- src/renderer：渲染进程（Vue 3 应用）
- docs：工程规范与业务文档（持续沉淀）

## 开发

- pnpm install
- pnpm dev（启动开发模式）
- pnpm build（electron-vite 构建）

## 相关契约

客户端契约（REST / WS / E2EE / 消息模型）见 docs/contracts.md，权威基线见 ai-team 的 desktop-client-contract-spec.md。
