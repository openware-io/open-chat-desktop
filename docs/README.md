# gv_chat_desktop 文档索引

桌面端工程规范与业务文档（沉淀性，随需求持续维护）。

- architecture.md：架构总览（技术栈 / 进程模型 / 分层 / 契约 / 本地库 / 隔离约定）
- coding-guidelines.md：编码规范
- contracts.md：客户端契约（REST / WS / E2EE / 消息模型，字节级基线）
- feature-list.md：功能实现清单
- release-notes.md：发版记录（版本基线 / 产物 / 步骤 / 待验证清单）
- business/：产品业务文档（会话空间与隐私、功能清单、扫码登录等，逐步沉淀）

> 约定：沉淀性文档放本目录；过程性产出（体检/评审/交付报告）放 ai-team 的 projects/gv_chat/reports/。


corepack pnpm typecheck

ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
corepack pnpm build:mas
/Users/lee/gv_chat_desktop/dist/*.pkg
corepack pnpm build:win