# gv_chat_desktop Windows 发版规范

统一规范见 [`gv_im_server/docs/RELEASE_RUNBOOK.md`](../../gv_im_server/docs/RELEASE_RUNBOOK.md) 第 5.6 节；本文件仅说明桌面端必须遵守的发布约束。

## 发布完成的定义

**本地构建或上传 EXE 不等于发布完成。** 每次 Windows 桌面端发版，必须在管理后台「客户端发布」创建并提交一条 Windows `stable` 发布记录。未有已发布记录，安装包不得视为已上线。

## 版本与制品

- `package.json` 的 `version` 是桌面端版本的唯一权威来源，默认 PATCH +1。
- Windows `buildNumber` 必须比后台 `windows/stable` 当前最大 buildNumber 严格 +1；不能与 Android 或其他平台共用、推断或复用构建号。
- 构建命令：`npm run build:win`。
- 产物：`dist/WV Chat Setup <version>.exe`；发布制品类型为 `exe`，架构为 `x64`。

## 后台发布与验收

1. 在管理后台「客户端发布」创建记录：平台 `Windows`、渠道 `stable`，填写版本、Windows buildNumber 与更新说明，上传 EXE。
2. 上传完成后确认对象存储已回填下载 URL、SHA-256 与文件大小；选择直接发布，或按定时/灰度流程提交，最终状态必须为 `released`。
3. 通过 `GET /api/v1/client/releases/latest?platform=windows&channel=stable` 验证本次版本、构建号和 `released` 状态；返回的下载 URL 必须可访问（HTTP `200`）。

也可用管理 API 执行相同流程：上传会话 `POST /admin/client-releases/artifacts/upload-sessions` → complete → 创建草稿 `POST /admin/client-releases` → 提交 `POST /admin/client-releases/{id}/submit`。

当前最新正式记录：Windows `stable` `2.0.3+5`（EXE / x64）。
