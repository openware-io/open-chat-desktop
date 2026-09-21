# gv_chat_desktop 编码规范

## 1. 语言与格式

- 全仓 TypeScript strict；Vue 3 统一 <script setup lang="ts">。
- 合法 UTF-8；2 空格缩进、单引号、无分号尾随（与 electron-vite 模板一致）。

## 2. 目录与命名

- 文件 kebab-case；组件 PascalCase；store/服务 camelCase。
- 页面 views/、组件 components/、状态 stores/、服务 services/、仓储 repositories/、模型 models/。

## 3. 分层纪律

- 业务逻辑进 services/repositories，不堆在 views；Pinia 只放 UI 状态与用户意图。
- IO 边界加抽象：HTTP 客户端、WS、SQLite、E2EE、媒体、通知各自封装。

## 4. 文案与本地化

- 不硬编码用户可见文案；集中到 l10n（zh-CN / en），复用 App 端既有中英文文案基线。

## 5. 安全

- 严禁把密钥/口令/Token 写入任何文件；.env 只引用键名不引用值。
- 渲染进程 contextIsolation=true、nodeIntegration=false；IPC 仅走 preload 白名单桥。
- E2EE 私钥/共享密钥经主进程 Electron `safeStorage`（Windows DPAPI / macOS Keychain / Linux libsecret）加密后落盘到 `userData/e2ee-secrets.json`，渲染进程磁盘上无明文密钥；读取走内存缓存（`SafeStorageKeyValueStore.init()` 一次加载），写入经受限 IPC（preload 白名单桥）异步持久化。严禁把密钥写入 `localStorage`、日志或上传服务端。

## 6. 状态与数据

- 乐观发送：消息先进本地发件箱，回执后落库。
- 同步水位 MessageSyncStates.lastSyncedSyncSeq 驱动增量同步。

## 7. 沉淀

- 工程级约定/架构说明沉淀到 docs/；过程性报告放 ai-team reports/。
