# gv_chat_desktop 架构总览

> 桌面端（Electron）工程架构，随需求演进持续维护。

## 1. 定位

WV Chat 跨平台桌面客户端，对移动端 App（gv_chat_app，Flutter）已实现功能 1:1 复刻，并补部分高频缺口。唯一后端为 gv_im_server（Java 微服务），桌面端只连 gateway，不直连业务服务。

## 2. 技术栈

- 运行时：Electron（主进程 Node + 渲染进程 Chromium）
- 构建：electron-vite
- 语言：TypeScript 全栈
- UI：Vue 3 + Pinia + Vue Router + Element Plus + 自定义聊天组件（虚拟滚动）
- 本地库：node:sqlite（Electron 44 内置 Node 24 自带，主进程，零原生依赖），对应 Drift 四表（会话/消息/发件箱/同步水位）
- E2EE：libsodium（X25519 + AES-256-GCM，与 Flutter 端字节级互操作）
- 音视频：Electron 内置 Chromium getUserMedia + RTCPeerConnection
- 通知/托盘：Electron Notification + Tray
- 打包/更新：electron-builder + electron-updater

## 3. 进程模型

- 主进程（src/main）：窗口管理、本地库（better-sqlite3）、系统托盘、通知、自动更新、文件系统（保存到本地文件夹）。
- 预加载（src/preload）：contextBridge 暴露白名单 IPC，渲染进程不直接触碰 Node。
- 渲染进程（src/renderer）：Vue 3 应用，负责全部 UI 与业务逻辑；HTTP/WS/E2EE 在此层，通过 Web API 与主进程桥接。

## 4. 渲染进程分层

views（页面） → stores（Pinia，UI 状态） → services（HTTP/WS/E2EE/媒体/通知编排） → repositories（数据访问：本地 SQLite + 远端 API） → models。

约定：业务逻辑进 services/repositories，不堆在 views；Pinia 只放 UI 状态与用户意图，不做 IO 编排。

## 5. 契约（权威基线见 contracts.md）

- REST：gateway /api/v1/**，Bearer token，X-Client-Contract: im-v1，写方法 Idempotency-Key，data 信封解包。
- WS：ws(s)://host/ws/im/v1?ticket=...（票据 POST /auth/ws-ticket 一次性），帧信封 {event,data}，事件全集 24+。
- E2EE：X25519 原始 32B 直接作 AES-256 密钥（无 HKDF/salt/AAD），密文 base64(nonce[12B] + ciphertext + tag[16B])，安全码 SHA-256(pubA:pubB) 前 8 字节大写十六进制。
- E2EE 密钥存储：私钥/共享密钥由主进程 `safeStorage` 加密落盘（`userData/e2ee-secrets.json`），渲染进程经 `SafeStorageKeyValueStore` 内存缓存 + 受限 IPC 读写，磁盘上无明文。
- 消息模型：MsgType 11 种、ChatType 5 种，消息体 content + media + msgType（无 payload 字段）。

## 6. 本地库

node:sqlite（内置 DatabaseSync）建 4 表：conversations / messages / outbox / sync_states + 2 索引，对齐 Flutter Drift schemaVersion=5 的列语义。

## 7. 登录

- 用户名 + 密码登录（1:1 复刻 App）。
- 扫码登录（新增）：桌面端展示登录二维码，手机 App 扫码确认（需后端二维码登录会话 + App 扫码确认入口）。

## 8. 隔离约定

- 桌面端独立 git 仓库，不依赖其它仓库的构建产物。
- 对 gv_im_server / gv_chat_app 的改动走各自 worktree 独立分支，不 merge、不碰其它 agent 分支。
