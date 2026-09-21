# gv_chat IM 客户端契约规范（桌面端 / 移动端共用权威基线）

> 版本：v1.0（契约基线）
> 适用：Electron 桌面客户端（TypeScript）与 Flutter 移动端（gv_chat_app）
> 后端：gv_im_server（Java 微服务，唯一后端；REST 经 gateway 暴露于 `/api/v1/**`，WS 暴露于 `/ws/im/v1`）
> 状态：基于真实代码逐条核对；未 100% 确认的细节以「待二次核对」标注，见文末「核对清单」。
>
> 硬性约束：
> - 本文档**不含任何真实密钥 / 口令 / Token 值**；E2EE 部分只描述协议与字节布局。
> - 结论逐条附相对路径证据（相对工程根 cnb，路径统一用正斜杠）。
> - 权威来源优先级：Flutter 端 `generated_im_api_client.dart` + 后端 Controller（REST）、后端 `ImWebSocketHandler`/协议 DTO（WS）、`e2ee_crypto.dart`（E2EE 字节级）、`MsgType.java`/域模型（消息模型）；OpenAPI 仅作对照。

---

# 一、REST API 面

## 1.0 通用约定（客户端必须遵守）

证据：`gv_chat_app/lib/services/api_client.dart`（L26-L77）、`gv_chat_app/lib/core/config.dart`（L24-L29）

- **Base URL**：`{apiBase}/api/v1`（`apiPrefix = apiBase 去尾斜杠 + "/api/v1"`）。
  - dev 默认 `http://192.168.1.3:3002`；prod 默认 `https://api.dev.example.com`（`gv_chat_app/lib/core/env_config.dart` L19-L35，可被 `--dart-define=GV_API_BASE` 覆盖）。桌面端应保留等价可配置项，**不要硬编码域名**。
- **认证**：`Authorization: Bearer <token>`（token 来自登录响应，非空才注入，api_client.dart L36-L39）。
- **登录/注册响应 TokenResponse**：`{ "access_token": string, "user": {...} }`（`TokenResponse.java` L5 明确 `@JsonProperty("access_token")`；字段名是 `access_token` 而非 `token`）。
- **公共请求头**（api_client.dart L40-L43）：`x-lang`、`X-Client-Contract: im-v1`、`X-Client-Platform`（桌面端建议 `windows`/`macos`）。
- **幂等键**：所有写方法（POST/PUT/PATCH/DELETE）自动加 `Idempotency-Key: <UUID v4>`（api_client.dart L47-L50）。媒体上传会话接口在服务端**强制要求** UUID 格式 Idempotency-Key（`gv_im_server/services/support/im-support-service/.../MediaUploadSessionController.java` L26-L29、L50-L56）。
- **响应信封**：多数接口为 `{ code?, message?, data, requestId? }`；客户端在拦截器里解包 `data`（api_client.dart L54-L62）。桌面端 HTTP 层需实现同款「`data` 解包 + `requestId` 存在性判定」逻辑，否则解析错位。
- **HTTP 查询参数里 ChatType/MsgType 一律大写**（Spring `Enum.valueOf` 大小写敏感）：`chatTypeToHttpQuery(value).toUpperCase()`（`gv_chat_app/lib/core/chat_type_wire.dart` L13、L15）。JSON/WS 里则用 @JsonValue 的小写值（`PRIVATE → private` 等）。

## 1.1 认证 Auth（服务：user）

证据：`gv_chat_app/lib/services/generated_im_api_client.dart`（L14-L27）、`gv_im_server/services/user/im-user-service/.../api/controller/AuthController.java`

| Method | Path | 请求要点 | 响应要点 |
|---|---|---|---|
| POST | /auth/register | `username, password, email, nickname?, phone?` | TokenResponse（`access_token, user`） |
| POST | /auth/login | `username, password` | TokenResponse |
| POST | /auth/ws-ticket | 无 body（需登录） | `{ ticket, expiresAt }`（WS 一次性票据，见二.2） |
| POST | /auth/password/forgot | `{ email }` | `{ ok: true }`（无论邮箱是否存在均返回成功） |
| POST | /auth/password/reset | `{ token, newPassword }` | `{ ok: true }` |
| POST | /auth/password/forgot-sms | `{ phone }` | `{ ok: false }`（预留未开放） |

> 密码相关字段只做透传，不落盘明文；access_token 只存安全存储。

## 1.2 用户 User / 设备 Device（服务：user）

证据：generated_im_api_client.dart L29-L63、L413-L483、L467-L474；`DeviceTokenController.java`、`DeviceKeyController.java`、`UserProfileController.java`

| Method | Path | 请求要点 | 响应要点 |
|---|---|---|---|
| GET | /users/me | — | UserProfileResponse |
| PUT | /users/me | `nickname, avatar, email, phone, signature` 等部分更新 | UserProfileResponse |
| PUT | /users/me/password | `currentPassword, newPassword` | 无 |
| DELETE | /users/me | `{ password }`（注销，需登录密码） | 无 |
| GET | /users/me/notification-settings | — | `{ notifyPrivate, notifyGroup, notifyChannel }` |
| PUT | /users/me/notification-settings | 三开关 | 同上 |
| GET | /users/me/privacy-settings | — | `{ allowGroupFriendRequest, hideGroupMemberInfo }`（见下方说明） |
| PUT | /users/me/privacy-settings | `allowGroupFriendRequest` | 同上 |
| GET | /users/me/self-destruct | — | `{ policy, selfDestructAt?, lastLoginAt? }`（policy: off/1mo/3mo/6mo/1yr） |
| PUT | /users/me/self-destruct | `{ policy }` | 同上 |
| GET | /users/{id} | 路径 id | UserProfileResponse |
| GET | /users/search | `keyword` | 用户列表 |
| POST | /device-tokens | `token, platform, pushProvider, deviceId?` | DeviceTokenResponse（移动端统一 `jpush`；桌面端通常不需要） |
| DELETE | /device-tokens | `{ token, pushProvider? }` | `{ ok: true }` |
| POST | /device-keys | `{ deviceId, publicKey }` | DeviceKeyResult（E2EE，见三.5） |
| GET | /device-keys/me | — | `[DeviceKeyResult]` |
| GET | /user-stickers | — | 贴纸列表 |
| POST | /user-stickers | `url, thumbnail?` | 贴纸 |
| DELETE | /user-stickers/{id} | 路径 id | 无 |

> **群成员隐私保护**：平台级开关 `feature.hideGroupMemberInfo`（admin 后台「功能开关」配置，经 `GET /config/client` 下发到 ClientFeatureBlock，默认 true）。注意 `GET /users/me/privacy-settings` 的响应 DTO **仍包含** `hideGroupMemberInfo` 字段（`PrivacySettingsResponse.java` L4），属历史残留；权威判定以 `/config/client` 为准，不要混淆（见核对清单 11）。

## 1.3 好友 Friend（服务：user）

证据：generated_im_api_client.dart L65-L99；`FriendController.java`

| Method | Path | 请求要点 | 响应要点 |
|---|---|---|---|
| GET | /friends | — | `[FriendItem]` |
| GET | /friends/requests/pending | — | 待处理好友申请 |
| POST | /friends/request | `toUserId, message?, source?, groupId?` | FriendRequestResponse |
| PUT | /friends/request/{id} | `{ action }` | 无 |
| DELETE | /friends/{friendId} | 路径 friendId | 无 |
| PUT | /friends/{friendId} | `remark, groupName` 等 | 无 |
| POST | /friends/{friendId}/block | 路径 friendId | 无 |
| POST | /friends/{friendId}/unblock | 路径 friendId | 无 |
| GET | /friends/groups | — | 好友分组名列表 |
| GET | /friends/blocked | — | `[FriendItem]` 黑名单 |

## 1.4 会话 / 群 / 频道（服务：conversation）

证据：generated_im_api_client.dart L101-L108、L122-L174、L235-L266；`ConversationMuteController.java`、`GroupController.java`、`ChannelController.java`、`RtcController.java`

| Method | Path | 请求要点 | 响应要点 |
|---|---|---|---|
| PUT | /conversations/{conversationId}/mute | `{ muted }` | `{ conversationId, muted }` |
| GET | /conversations/muted | — | `[{ conversationId }]` |
| POST | /groups | `{ name, avatar?, memberIds }` | ConversationGroup |
| GET | /groups/mine | — | 群列表 |
| GET | /groups/{id} | 路径 id | 群详情 |
| GET | /groups/{id}/members | 路径 id | `[{ userId, nickname, username, role, avatar }]` |
| PUT | /groups/{id} | `name, avatar, announcement, allowMemberInvite, allowMemberFriendRequest` | 无 |
| POST | /groups/{id}/members | `{ userIds }` | 无 |
| DELETE | /groups/{id}/members/{userId} | 路径 | 无 |
| POST | /groups/{id}/mute | `{ userId, duration }`（duration=0 取消禁言） | — |
| POST | /groups/{id}/role | `{ userId, role }`（admin/member） | — |
| PUT | /groups/{id}/members/me/nickname | `{ nickname }` | — |
| POST | /groups/{id}/leave | 路径 id | 无 |
| DELETE | /groups/{id} | 路径 id（解散） | 无 |
| POST | /channels | `{ name, avatar?, announcement? }` | ChannelResult（`id, code, ownerId, ...subscribed, memberCount`） |
| GET | /channels/mine | — | 频道列表 |
| GET | /channels/{id} | 路径 id | ChannelResult |
| POST | /channels/{id}/subscribe | 路径 id | ChannelResult |
| DELETE | /channels/{id}/subscribe | 路径 id | 无 |
| PUT | /channels/{id} | `name?, avatar?, announcement?` | ChannelResult |
| DELETE | /channels/{id} | 路径 id（硬删，仅 owner） | 无 |
| GET | /channels/search | `keyword?, limit?` | 频道列表 |
| GET | /channels/by-code/{code} | 路径 code（分享码） | ChannelResult |

## 1.5 私密聊天 Secret Chats（E2EE，服务：conversation）

证据：generated_im_api_client.dart L270-L292；`SecretChatController.java`

| Method | Path | 请求要点 | 响应要点 |
|---|---|---|---|
| POST | /secret-chats | `{ userB, publicKey? }`（publicKey 为发起方本端设备公钥） | SecretChatResult |
| GET | /secret-chats/mine | — | `[SecretChatResult]` |
| GET | /secret-chats/{id} | 路径 id | SecretChatResult |
| POST | /secret-chats/{id}/handshake | `{ publicKey }` | SecretChatResult |
| POST | /secret-chats/{id}/destroy-policy | `{ policy }` | SecretChatResult |
| DELETE | /secret-chats/{id} | 路径 id（任意一方删除即终止） | `{ deleted: true }` |

## 1.6 私密群聊 Secret Group Chats（逐成员 E2EE，服务：conversation）

证据：generated_im_api_client.dart L296-L372；`SecretGroupChatController.java`

| Method | Path | 请求要点 | 响应要点 |
|---|---|---|---|
| POST | /secret-group-chats | `{ memberUserIds }`（不含群主） | SecretGroupChatResult |
| GET | /secret-group-chats/mine | — | 列表 |
| GET | /secret-group-chats/{id} | 路径 id | SecretGroupChatResult |
| POST | /secret-group-chats/{id}/members | `{ userId }` | SecretGroupChatResult |
| POST | /secret-group-chats/{id}/handshake | `{ publicKey }` | SecretGroupChatResult |
| POST | /secret-group-chats/{id}/destroy-policy | `{ policy }` | SecretGroupChatResult |
| POST | /secret-group-chats/{id}/anonymous | `{ enabled }` | SecretGroupChatResult |
| POST | /secret-group-chats/{id}/pin | `{ msgId }` | SecretGroupChatResult |
| POST | /secret-group-chats/{id}/unpin | — | SecretGroupChatResult |
| POST | /secret-group-chats/{id}/invite | — | SecretGroupChatResult（含 inviteToken） |
| POST | /secret-group-chats/join | `{ token }` | SecretGroupChatResult |
| POST | /secret-group-chats/{id}/owner-only-post | `{ enabled }` | SecretGroupChatResult |
| POST | /secret-group-chats/{id}/name | `{ name }` | SecretGroupChatResult |
| POST | /secret-group-chats/{id}/announcement | `{ announcement }` | SecretGroupChatResult |
| DELETE | /secret-group-chats/{id}/members/{userId} | 路径 | SecretGroupChatResult |
| POST | /secret-group-chats/{id}/leave | 路径 id | `{ left: true }` |
| DELETE | /secret-group-chats/{id} | 路径 id（解散，仅群主） | `{ deleted: true }` |

## 1.7 消息 Message（服务：message）

证据：generated_im_api_client.dart L176-L231、L110-L120（favorites）；`MessageController.java`、`FavoriteController.java`

| Method | Path | 请求要点 | 响应要点 |
|---|---|---|---|
| GET | /messages/history | `peerId, chatType, beforeMsgId?, afterMsgId?, date?, pageSize`；中心分页加 `centerMsgId, beforeCount, afterCount` | `[MessageResponse]`（旧→新） |
| GET | /messages/history/dates | `peerId, chatType` | `["yyyy-MM-dd", ...]`（UTC 倒序） |
| GET | /messages/channel/{channelId} | `afterSeq, limit` | `[MessageResponse]`（频道游标） |
| GET | /messages/search | `keyword, msgType, peerId?, chatType?, page, pageSize, beforeMsgId?` | `{ items, total, page, pageSize }` |
| GET | /messages/sync | `afterSyncSeq, limit` | `{ items:[{syncSeq,message,readAt}], nextSyncSeq, hasMore }` |
| GET | /messages/unread-count | — | `{ count }` |
| POST | /messages/read | `{ msgIds: [] }` | `{ ok, count }` |
| POST | /messages/recall | `{ msgId }` | DeleteMessageResponse |
| POST | /messages/delete-for-everyone | `{ msgId }` | DeleteMessageResponse |
| POST | /messages/clear-private | `{ peerId }` | `{ ok: true }` |
| POST | /messages/clear-group | `{ groupId }` | `{ ok: true }` |
| POST | /favorites | `{ msgId, peerId, chatType }` | `{ ok }` |
| DELETE | /favorites/{msgId} | 路径 msgId | `{ ok }` |
| GET | /favorites | `page, pageSize` | `{ items, total, page, pageSize }` |

## 1.8 私密消息 Secret Messages（E2EE 密文，服务：message）

证据：generated_im_api_client.dart L421-L462；`SecretMessageController.java`

| Method | Path | 请求要点 | 响应要点 |
|---|---|---|---|
| POST | /secret-messages | `{ secretChatId, msgId, ciphertext, mediaObjectIds? }` | SecretMessageResult |
| GET | /secret-messages | `secretChatId, afterSeq, limit` | `[SecretMessageResult]` |
| POST | /secret-messages/media/access-urls | `{ secretChatId, msgId, objectIds }` | 媒体访问 URL 列表（手写，im_api.dart L1382-L1399） |
| POST | /secret-messages/{secretChatId}/read | `{ afterSeq }` | `{ secretChatId, counted, destroyAt }` |
| GET | /secret-messages/{secretChatId}/status | 路径 | `{ secretChatId, earliestDestroyAt }` |
| GET | /secret-messages/{secretChatId}/states | `afterDestroyAt?, limit` | `{ secretChatId, destroyed:[{msgId,destroyAt,reason}] }` |
| POST | /secret-messages/{secretChatId}/recall/{msgId} | 路径（仅发送方，窗口内） | `{ secretChatId, msgId, reason:"recalled" }` |
| DELETE | /secret-messages/{secretChatId}/{msgId} | 路径（任意参与方） | `{ secretChatId, msgId, reason:"deleted" }` |

## 1.9 私密群聊消息 Secret Group Messages（逐成员密文，服务：message）

证据：generated_im_api_client.dart L376-L409；`SecretGroupMessageController.java`

| Method | Path | 请求要点 | 响应要点 |
|---|---|---|---|
| POST | /secret-group-messages | `{ secretGroupId, msgId, recipients:[{userId,ciphertext}], mediaObjectIds?, atUserIds? }` | `[SecretGroupMessageResult]` |
| POST | /secret-group-messages/edit | 同上（保留 msgId，逐成员替换密文） | `[SecretGroupMessageResult]` |
| GET | /secret-group-messages | `secretGroupId, afterSeq, limit` | `[SecretGroupMessageResult]`（只返回接收方=当前用户） |
| POST | /secret-group-messages/media/access-urls | `{ secretGroupId, msgId, objectIds }` | 媒体访问 URL 列表 |
| POST | /secret-group-messages/read | `{ secretGroupId, afterSeq }` | `{ secretGroupId, counted, destroyAt }` |
| GET | /secret-group-messages/destroyed-states | `secretGroupId, afterDestroyAt?, limit` | `{ secretGroupId, destroyed:[...] }` |
| POST | /secret-group-messages/recall/{msgId} | `secretGroupId`（query） | `{ secretGroupId, msgId, reason:"recalled" }` |
| DELETE | /secret-group-messages/{msgId} | `secretGroupId`（query） | `{ secretGroupId, msgId, reason:"deleted" }` |

## 1.10 媒体 Media（服务：support）

证据：`gv_chat_app/lib/services/im_api.dart` L535-L906（手写上传/下载）；`MediaUploadSessionController.java`、`MediaMultipartUploadController.java`、`MediaObjectController.java`

- **上传会话（≤20MB 单段直传）**：
  - POST /media/upload-sessions `{ scope, mediaKind, fileName, contentType, size, sha256, durationMs? }` → `{ uploadSessionId, objectId, uploadUrl, requiredHeaders? }`（要求 Idempotency-Key）
  - PUT uploadUrl（直传对象存储，带 Content-Length + contentType，可带服务端下发的 requiredHeaders）
  - POST /media/upload-sessions/{sessionId}/complete `{ size, sha256 }`
  - GET /media/upload-sessions/{sessionId}；DELETE /media/upload-sessions/{sessionId}
- **分片上传（>20MB）**：
  - POST /media/multipart-upload-sessions（同 create，返回另含 `partSize, partCount`）
  - POST /media/multipart-upload-sessions/{sessionId}/parts/signatures `{ partNumbers }` → `{ partUrls:[{partNumber,uploadUrl}] }`
  - 逐片 PUT partUrl（响应头取 ETag）→ POST /media/multipart-upload-sessions/{sessionId}/parts/{partNumber}/complete `{ etag }`
  - POST /media/multipart-upload-sessions/{sessionId}/complete `{ parts:[{partNumber,etag}], size, sha256 }`
- **对象访问**：
  - GET /media/{objectId} → `{ status, ... }`（status: active/rejected/deleted 轮询）
  - GET /media/{objectId}/access → `{ url, contentType, size }`
  - POST /media/access-urls `{ objectIds }` → 批量访问 URL
  - DELETE /media/{objectId}
- **scope** 取值：`chat`（聊天媒体）、`avatar`（头像；客户端把 `profile` 映射为 `avatar`，im_api.dart L822-L826）。
- **mediaKind** 取值：`image / audio / video / attachment`（由 contentType 推断，im_api.dart L828-L833）。
- 客户端校验上传 URL 的 origin 必须等于受管媒体 host（`_requireManagedMediaUrl`，im_api.dart L841-L860）。

## 1.11 RTC

证据：generated_im_api_client.dart L464-L465；`RtcController.java`

| Method | Path | 响应要点 |
|---|---|---|
| GET | /rtc/ice-servers | 直接返回 `[{ urls, username, credential }]`；客户端包成 `{ iceServers, iceTransportPolicy:'relay' }`（纯 TURN relay，im_api.dart L503-L533） |

> 信令本身不走 REST，走 WS `rtc:signal`（见二.7）。

## 1.12 配置 / 客户端发布 / 生态杂项

证据：generated_im_api_client.dart L485-L543；`ClientReleaseController.java`

| Method | Path | 请求要点 | 响应要点 |
|---|---|---|---|
| GET | /config/client | — | ClientFeatureBlock（含 `hideGroupMemberInfo` 等特性开关） |
| POST | /client/release-check | `platform, channel, version, buildNumber, architecture, protocolVersion, installationId` | ClientReleaseCheckResult（桌面端版本更新检查/静默升级） |
| GET | /client/releases/latest | 客户端最新版本查询 | 发布信息 |
| GET | /miniapp/services | — | 服务分组列表 |
| GET | /points/balance | — | `{ userId, balance }` |
| GET | /points/ledger | `page, pageSize, entryType?, businessType?` | 积分流水 |
| GET | /coins/info | — | `{ name }` |
| GET | /coins/balance | — | `{ userId, balance }` |
| GET | /coins/ledger | `page, pageSize, entryType?` | 代币流水 |
| GET | /reservations/service-types | — | 预约服务类型 |
| GET | /reservations/stores | `serviceTypeId` | 门店 |
| GET | /reservations/config | — | 预约配置 |
| POST | /reservations | `serviceTypeId, storeId, contactName, contactPhone, reserveDate, reserveTimePeriod, personNum, remark, voucherObjectId` | CreateReservationResult |
| GET | /reservations/me | `page, pageSize, status?, serviceTypeId?` | 我的预约分页 |
| GET | /reservations/me/{orderNo} | 路径 orderNo | 预约详情 |
| POST | /reports | `targetId, reason, description?, evidence?` | 举报结果 |

## 1.13 OpenAPI 5 份 JSON 的覆盖缺口（对照结论）

5 份 OpenAPI：`gv_im_server/docs/contracts/openapi/{admin,conversation,message,order,user}.json`。

**完全无 OpenAPI 覆盖的域（以 generated_im_api_client.dart + 后端 Controller 为准，属契约必须，但 JSON 无文档）：**

1. **E2EE 全链路**：`/secret-chats`、`/secret-group-chats`、`/secret-messages`、`/secret-group-messages`、`/device-keys` —— 无任何 OpenAPI 文件描述。
2. **代币 coins**：`/coins/info`、`/coins/balance`、`/coins/ledger` —— 无文档（区别于 points 积分）。
3. **RTC 信令**：仅有 `/rtc/ice-servers`，offer/answer/candidate 走 WS，无 REST 文档。

**已有 JSON 但滞后/缺失端点：**

4. **message.json 仅 6 端点**（sync/read/history/search/unread-count/delete-for-everyone），缺：`/messages/history/dates`、`/messages/channel/{channelId}`、`/messages/recall`、`/messages/clear-private`、`/messages/clear-group`、`/favorites`（favorites 在 message 服务但未入 JSON）。
5. **conversation.json 缺**：`/conversations/{id}/mute`、`/conversations/muted`、`/channels/**` 全部、`/secret-*` 全部。
6. **media 部分覆盖**：conversation.json 只有 `/upload`、`/media/{objectId}`、`/media/{objectId}/access`；缺 `/media/upload-sessions`、`/media/multipart-upload-sessions`、`/media/access-urls`。
7. **user.json 缺**：`/users/me/notification-settings`、`/users/me/privacy-settings`、`/users/me/self-destruct`、`/auth/password/forgot-sms`。

---

# 二、WS 协议

## 2.1 连接地址

证据：`gv_im_server/gateways/im-access-ws/.../config/WebSocketConfig.java` L45（注册路径 `/ws/im/v1`）；`gv_chat_app/lib/core/env_config.dart` L25-L29。

- 端点：`ws(s)://{host}/ws/im/v1?ticket=<ticket>`
  - dev 默认 `ws://192.168.1.3:3002/ws/im/v1`；prod `wss://api.dev.example.com/ws/im/v1`。
- 认证方式：URL query `ticket`（**不是** `Authorization` 头）。握手拦截器解析 query 中的 `ticket`，校验失败返回 HTTP 401 拒绝握手（`WebSocketAuthInterceptor.java` L47-L87）。

## 2.2 票据获取与校验语义

证据：`AuthController.java` L74-L82；`WebSocketAuthInterceptor.java` L49-L78。

- 客户端先 `POST /auth/ws-ticket`（需登录）→ 响应 `{ ticket, expiresAt }`（`WebSocketTicketResponse(String ticket, Instant expiresAt)`）。
- 票据是**一次性**的：握手时 `redisTemplate.opsForValue().getAndDelete(WS_TICKET + ticket)`（L58），取后即删。
- 票据 value 格式（Redis 内，客户端不可见）：`"<userId>|<authenticationVersion>"`（按竖线 split 成 2 段）。服务端校验：用户存在、active、authenticationVersion 一致（L63-L75）。
- 校验通过后把 `userId`、`username` 写入 session attributes（L76-L77）。

## 2.3 帧信封（双向一致）

证据：`ImWebSocketHandler.java` L92-L96（收）、`WsBroadcastService.java` L30-L37（发）、`RedisClusterBroadcast.java` L91-L94（集群转发最终帧）。

- 客户端 → 服务端：`{ "event": string, "data": object }`（`data` 可为空 Map）。
- 服务端 → 客户端：`{ "event": string, "data": object }`（`data` 可能缺省，WsBroadcastService L34-L36）。
- 服务端处理异常不关连接，回 `error` 帧（`{code, event, message}`，ImWebSocketHandler L124-L132）。

## 2.4 事件名全集

证据：`gv_im_server/platform/im-protocol-ws/.../constant/WsEvents.java`（L8-L48）。

| 事件 | 方向 | 语义 |
|---|---|---|
| `chat:send` | C→S | 发送消息（普通聊天） |
| `chat:receive` | S→C | 新消息投递 |
| `chat:ack` | S→C | 发送受理回执（含 msgId） |
| `chat:read` | 双向 | C→S 已读上报；S→C 上报受理回执 |
| `chat:read_notify` | S→C | 对端已读通知 |
| `chat:recall` | 双向 | 撤回（C→S 请求；S→C 受理回执） |
| `chat:recall_notify` | S→C | 撤回通知（对端渲染墓碑） |
| `chat:delete_notify` | S→C | 删除（delete-for-everyone）通知 |
| `chat:secret_destroyed` | S→C | 密聊/密群消息销毁事件 |
| `chat:secret_stored` | S→C | 密文已存储通知 |
| `chat:secret_created` | S→C | 私密会话已创建（促对方握手/同步列表） |
| `chat:secret_deleted` | S→C | 私密会话已删除 |
| `chat:secret_group_stored` | S→C | 密群密文已存储 |
| `chat:clear_private_notify` | S→C | 私聊记录被清空通知 |
| `chat:clear_group_notify` | S→C | 群聊记录被清空通知 |
| `chat:typing` | C→S | 正在输入（**已声明但服务端按未实现处理，端到端不可用**，见 2.6） |
| `user:online` / `user:offline` | S→C | 上下线 |
| `user:status_change` | S→C | 在线状态变化（含前后台） |
| `friend:request` / `friend:request_notify` | 双向/通知 | 好友申请及其通知 |
| `friend:accept` / `friend:accept_notify` | 双向/通知 | 接受好友及其通知 |
| `group:join` / `group:leave` | C→S | 群房间进出（**已声明但服务端按未实现处理**） |
| `group:notify` | S→C | 群事件通知 |
| `rtc:signal` | 双向 | WebRTC 信令中继 |
| `heartbeat` | 双向 | 心跳（S 回 `{timestamp}`） |
| `app:state` | C→S | 设备前后台状态上报 |
| `error` | S→C | 错误帧 |
| `authentication_invalidated` | S→C（内部） | 认证失效，服务端关闭会话（RedisClusterBroadcast L64-L69） |

## 2.5 关键载荷结构

证据：`platform/im-protocol-ws/.../dto/` 各 DTO；`StoredMessageWsPayloadFactory.java`。

**chat:send（SendMessageDto L24-L36）**：`{ toId, chatType, msgType, content, clientMsgId?, replyMsgId?, atUsers?:string[], mediaObjectIds?:string[] }`
- `chatType` / `msgType` 用小写 @JsonValue（`private/group/channel`；`text/image...`）。
- **私密聊天（chatType=secret）禁止经 WS 发送**：服务端回 `error`（code `SECRET_VIA_WS_NOT_SUPPORTED`），须走 `POST /secret-messages`（ImWebSocketHandler L154-L170）。

**chat:ack（ImWebSocketHandler L186-L191）**：`{ clientMsgId, msgId, content, timestamp }`（`timestamp`=受理时间 `acceptedAt`）。

**chat:receive（StoredMessageWsPayloadFactory.java L24-L53）**：
`{ msgId, from, fromUsername, toId, chatType, msgType, content, media:[{objectId,url}], seq, syncSeq, conversationId, timestamp, clientMsgId?, replyMsgId?, atUsers?:string[] }`
- 注意：该载荷字段名是 `from`（不是 `fromUserId`）、`media`（不是 `mediaObjectIds`）；ChatMessage DTO 解析时兼容两者（`chat_message.dart` L18、L58-L69）。

**chat:read（ReadReceiptDto）**：C→S `{ msgIds: [] }`；S→C 回 `{ commandId, acceptedAt }`（ImWebSocketHandler L194-L204）。

**chat:recall（RecallMessageDto）**：C→S `{ msgId }`；S→C 回 `{ msgId, commandId, acceptedAt }`（L206-L217）。

**app:state**：`{ appState: "foreground"|"background", activeConversationId: string }`（L143-L149）。

## 2.6 同步游标（syncMessages）与已读/撤回/typing/在线状态

- **离线补偿 / 游标同步**：`GET /messages/sync?afterSyncSeq&limit` → `{ items:[{syncSeq, message, readAt}], nextSyncSeq, hasMore }`（`MessageController.java` L85-L91；`MessageSyncResponse`/`SyncedMessageResponse`）。客户端持久化 `nextSyncSeq` 作水位（本地 `MessageSyncStates` 表，见四.7），`readAt != null` 时把消息 status 置 `read`（`message_sync.dart` L26-L28）。
- **已读**：C→S `chat:read`（WS）或 `POST /messages/read`（REST，`{msgIds}`）。已读粒度为**逐条**（`MessageReadStatus(msgId,userId,readAt)`），服务端对每条 saveIfAbsent（`MessageApplicationService.java` L102）。
- **撤回**：WS `chat:recall` 或 REST `POST /messages/recall`（`{msgId}`）。撤回后消息被改写为 `msgType=RECALL`、`content="消息已撤回"`、`status=RECALLED`（`Message.java` L77-L81），并经 `chat:recall_notify` 广播对端。
- **typing**：`chat:typing` 载荷 `WsTypingDto{toId, chatType}`，但 `ImWebSocketHandler` 把它和 `group:join`/`group:leave` 一起按「未实现业务事件」处理，回 `error`（code `AUTHORITATIVE_CONTRACT_UNAVAILABLE`，L106-L107、L219-L222）。**桌面端不得依赖 typing 生效**。
- **在线状态**：`user:status_change` / `user:online` / `user:offline`；设备前后台由 `app:state` 上报，服务端据此决定「在线但后台」时是否走离线推送（DevicePresenceRegistry，见 `StoredMessageEventListener.java` L153）。

## 2.7 RTC 信令（rtc:signal）

证据：`WsRtcSignalDto.java`；`ImWebSocketHandler.handleRtcSignal` L224-L255。

- C→S 载荷（WsRtcSignalDto）：`{ action, targetUserId, mediaType?, sdp?, candidate?, callId? }`
  - `action`：信令动作（`call`/`ring`/`answer`/`candidate`/`hangup`/`reject`/`busy` 等；服务端只对非空、非本机、非自呼做转发校验）。
- S→C 转发：服务端把 `fromUserId` 注入后原样转发给 targetUserId（L236-L237）。
- `call` / `ring` 且被叫不在前台时，服务端补发极光离线来电推送（L242-L247）。
- 转发失败（Redis 发布失败）回 `unavailable` 信号：`{ action:"unavailable", reason:"delivery_unavailable", callId }`（L251-L253）。
- ICE：`GET /rtc/ice-servers`（见一.11），纯 TURN relay。

---

# 三、E2EE 契约（字节级，最关键）

> 权威来源：`gv_chat_app/lib/services/e2ee/e2ee_crypto.dart`、`e2ee_manager.dart`、`e2ee_session_store.dart`；后端 `SecretChat.java`、`SecretGroupChat.java`、`DeviceKeyController.java`、`SecretMessageController.java`。
> 桌面端用 libsodium 实现时必须与 Flutter 端（`package:cryptography` 的 X25519 + AesGcm）**字节级一致**。

## 3.1 X25519 ECDH 密钥协商

证据：`e2ee_crypto.dart` L18、L23-L51。

- 密钥对：X25519，私钥 32 字节、公钥 32 字节，均以 **base64** 编码持久化与上报（L27-L30）。
- 派生共享密钥：`sharedSecret = X25519(私钥32B, 对端公钥32B)`，输出 **32 字节原始 X25519 结果**（L36-L51）。
  - **无 HKDF、无 salt、无额外密钥派生**：共享密钥的 32 字节原始值**直接作为 AES-256 的 256-bit 密钥**使用。
  - 桌面端 libsodium 等价：`crypto_scalarmult`（或 `crypto_box_beforenm` 得到的 32B 共享密钥），取原始 32 字节，勿再 KDF。
- 注意：X25519 私钥即 32 字节种子（Flutter `newKeyPairFromSeed` 的 seed = 私钥字节，见 L35 注释）。

## 3.2 AES-256-GCM 加密格式（字节布局，最关键）

证据：`e2ee_crypto.dart` L53-L92。

- **算法**：AES-256-GCM（`AesGcm.with256bits()`，L19），密钥 = 3.1 的共享密钥（32B）。
- **nonce**：12 字节随机（每次加密独立随机，`_randomBytes(12)`，L58、L108-L114）。
- **AAD**：**无**（encrypt 未传 aad，L60-L64）。桌面端 libsodium `crypto_aead_aes256gcm_encrypt` 的 `ad` 传空。
- **密文拼接布局（加密输出）**：`payload = nonce(12B) || cipherText || tag(16B)`，再整体 **base64**（L65-L69）。
  - 即：`base64( nonce[0..12) ++ ciphertext ++ tag[16B] )`。
- **解密输入解析**（L78-L92）：
  - `payload = base64Decode(ciphertextBase64)`；长度必须 ≥ `12 + 16 = 28`（L79）。
  - `nonce = payload[0..12)`；`cipherText = payload[12 .. len-16)`；`tag = payload[len-16 .. len)`（L80-L82）。
  - 用 `SecretBox(cipherText, nonce, tag)` 解密，失败返回 null（L84-L91）。
- **libsodium 等价注意（待字节级互操作验证）**：libsodium 的 `crypto_aead_aes256gcm_encrypt` 输出为 `ciphertext || tag`（nonce 由调用方单独提供），需自行拼接为 `nonce || ciphertext || tag` 后 base64，与 Flutter 端布局一致（布局已从 e2ee_crypto.dart 确认，但两端从未实际互测，列入核对清单 1）。

## 3.3 安全码（指纹）计算

证据：`e2ee_crypto.dart` L94-L106；后端 `SecretChat.java` L92-L107；`SecretChatApplicationService.java` L50-L51。

- **1:1 私聊安全码**：`SHA-256( utf8( userAPublicKey + ":" + userBPublicKey ) )` 的**前 8 字节**，逐字节 `%02X` **大写十六进制**，字节间**空格分隔**（8 组，7 个空格）。
  - **规范化顺序**：`userA = min(userId)`、`userB = max(userId)`（后端 `left=Math.min`/`right=Math.max`，L50-L51）；`userAPublicKey`/`userBPublicKey` 对应地按 userA/userB 排位（`createWithKeys` L77-L80）。
  - 客户端本地重算并与服务端下发的 `safeCode` 比对（`e2ee_manager.dart` L74-L80、L195-L196）。
- **群安全码**：服务端计算，`SHA-256( join(":", sorted(成员公钥)) )` 前 8 字节、大写十六进制、空格分隔（`SecretGroupChat.java` L57-L81）。公钥**字典序排序**（`.sorted()`）。**Flutter 客户端不重算，仅展示**（`secret_group_chat_models.dart` L42 注释）。桌面端若需本地核验群安全码，须复刻「字典序排序 + 冒号拼接 + SHA-256 前 8 字节」语义（见核对清单 4）。

## 3.4 SessionStore 本地存储格式

证据：`e2ee_session_store.dart` L13-L88（Flutter 用 SharedPreferences，key 语义即契约）。

| 概念 | 存储 key（Flutter） | 值格式 |
|---|---|---|
| 本机私钥 | `e2ee_private_key` | base64(32B) |
| 本机公钥 | `e2ee_public_key` | base64(32B) |
| 设备 id | `e2ee_device_id` | 字符串（注册设备公钥时同传） |
| 1:1 会话共享密钥 | `e2ee_shared_<secretChatId>` | base64(32B 共享密钥) |
| 1:1 会话安全码 | `e2ee_safe_code_<secretChatId>` | 安全码字符串 |
| 密群成员共享密钥 | `e2ee_group_shared_<groupId>_<peerUserId>` | base64(32B 共享密钥) |

- **每设备一对密钥对**（全局唯一，不随会话变），换账号/登出时由上层调用 `clearForAccount` 清空（e2ee_session_store.dart L76-L88；e2ee_manager.dart L157-L160）。
- 桌面端用安全存储（如 Electron safeStorage 或 OS 钥匙串 + libsodium secretbox）等价持久化上述 6 类条目，key 语义与 base64 编码保持一致即可，**私钥/共享密钥绝不上报服务端**。
- **多端同步硬约束**：密聊/密群密钥为**设备级**，不随账号跨设备同步（Flutter 有 `secretChatNoSyncHint` 提示）。桌面端新设备需重新注册设备公钥并重新完成各会话握手。

## 3.5 设备公钥登记（/device-keys）

证据：`DeviceKeyController.java`；`DeviceKeyApplicationService.java`；`RegisterDeviceKeyRequest.java`；`DeviceKeyResult.java`

- `POST /device-keys`：`{ deviceId: string, publicKey: base64 }`（均 @NotBlank）。
- 同 (userId, deviceId) 已存在时 `renew`（更新公钥），否则新建 `status="active"`（DeviceKeyApplicationService L20-L28）。
- `GET /device-keys/me` → `[DeviceKeyResult]`，字段：`{ id, userId, deviceId, publicKey, status, createdBy, createdAt, updatedBy, updatedAt }`。
- 服务端**只存公钥**，私钥永不离开客户端（`DeviceKey.java` L5 注释）。
- 创建私密聊天时服务端用「对方最新一条 active 设备公钥」预填对端公钥（`findDeviceKeySummaries` L35-L47），实现「无需对方接受即可加密发送」。

## 3.6 密聊握手流程

证据：`e2ee_manager.dart` L27-L62；`SecretChat.java` L42-L73；`SecretChatApplicationService.java` L42-L87、L110-L118。

1. `ensureDeviceKey(deviceId)`：无本机密钥则生成 X25519 密钥对并 `POST /device-keys` 注册（L28-L44）。
2. 发起 `POST /secret-chats { userB, publicKey }`：
   - 服务端 `left=min`/`right=max` 定 userA/userB；预填双方公钥（发起方本端 + 对端已注册设备公钥）；双方齐备即 `ready` 并计算安全码（SecretChatApplicationService L69-L81）。
   - 一对用户唯一会话，重复发起复用（幂等，L55-L67）。
3. 对方（或补充握手）`POST /secret-chats/{id}/handshake { publicKey }`（L59-L72）；双方公钥齐备 → `handshakeState="ready"`。
4. 客户端拉 `GET /secret-chats/{id}` 拿到 `userAPublicKey`/`userBPublicKey`，本地派生共享密钥 + 重算安全码并持久化（e2ee_manager.dart L57-L61、L183-L197）。
- 字段语义（`SecretChatResult`）：`{ id, userA, userB, peerUserId, status, safeCode, destroyPolicy, userAPublicKey, userBPublicKey, handshakeState, createdBy, createdAt, updatedBy, updatedAt }`；`status` 取 `handshake`/`ready`；`handshakeState` 取 `pending`/`ready`。

## 3.7 密聊消息加密收发

证据：`e2ee_manager.dart` L82-L95；`SecretMessageController.java`；`SecretMessageResult.java`；`im_api.dart` L1350-L1450。

- 发送：明文 → `encryptForChat(secretChatId, plaintext)`（3.2 布局）→ `POST /secret-messages { secretChatId, msgId, ciphertext, mediaObjectIds? }`。
  - `msgId` 由客户端生成（@NotBlank）；`ciphertext` 为 base64 密文；`mediaObjectIds` 为非加密媒体对象 id（媒体走对象存储，E2EE 只保护文本；媒体元数据/URL 由服务端授权换取）。
- 接收：`GET /secret-messages?secretChatId&afterSeq&limit` → `[SecretMessageResult]`，字段 `{ id, secretChatId, msgId, fromUserId, ciphertext, seq, status, destroyAt, createdAt }`；客户端按 `fromUserId` 取共享密钥解密（`decryptFromChat`）。
- 密文 wire 形态（客户端解析兼容，`e2ee_manager.dart` L201-L237 `SecretMessageWire`）：`secretChatId / msgId / fromUserId / ciphertext / seq / status(默认 active) / destroyAt / createdAt`；字段兼容 snake_case 与 camelCase。

## 3.8 密群逐成员密钥与逐成员密文

证据：`e2ee_manager.dart` L102-L181；`SecretGroupChatController.java`；`SecretGroupMessageController.java`；`PostSecretGroupMessageRequest.java`

- 群握手：`POST /secret-group-chats/{id}/handshake { publicKey }`；全员提交后群 `safeCode` 由服务端生成。
- 派生：对群内**每个非我成员**，用「我的私钥 + 该成员 `devicePublicKey`」分别 `deriveSharedSecret`，存 `e2ee_group_shared_<groupId>_<peerUserId>`（`_deriveGroupSecrets` L166-L181）。
- 发送：同一明文对每个成员各加密一份 → `POST /secret-group-messages { secretGroupId, msgId, recipients:[{userId,ciphertext}], mediaObjectIds?, atUserIds? }`（`encryptForGroupMember` L132-L141；`postSecretGroupMessage` im_api.dart L1218-L1234）。
  - `recipients` **不含发送方**；`atUserIds` 是明文元数据（仅用于通知/角标路由，不含内容）。
- 接收：`GET /secret-group-messages?secretGroupId&afterSeq&limit` 只返回 `recipientUserId=当前用户` 的密文（`SecretGroupMessageResult` 含 `recipientUserId`）；用「我的私钥 + 发送方公钥」派生的共享密钥解密（`decryptFromGroupMember` L143-L152）。

## 3.9 销毁策略（阅后即焚）字段

证据：`secret_chat_models.dart` L4-L38（`SecretChatDestroyPolicy`）；`SecretChatApplicationService.java` L35（白名单）；`SecretMessageController.java` L56-L106。

- **destroyPolicy 取值（契约值，全小写）**：`off, 1s, 2s, 5s, 10s, 30s, 1m, 5m, 1h, 1d, 1w`（11 值；后端白名单 L35）。
- 客户端做归一化：兼容后端可能返回的变体（`30_SECONDS`/`30_sec`/`none`/`60s` 等 → 契约值），见 `SecretChatDestroyPolicy.normalize` L20-L37。
- **销毁计时语义**（关键）：
  - 接收方调用 `POST /secret-messages/{secretChatId}/read { afterSeq }` 或 `POST /secret-group-messages/read { secretGroupId, afterSeq }`，对 `seq <= afterSeq` 且由对方发送、尚未计时的密文**开始销毁倒计时**；响应 `{ counted, destroyAt }`（destroyAt = 本次计时截止 UTC）。
  - 销毁计时与执行**由服务端控制**；客户端靠 `GET .../status`（`{ earliestDestroyAt }`）与 `GET .../states?afterDestroyAt`（`{ destroyed:[{msgId,destroyAt,reason}] }`）增量同步并本地移除（reason: `recalled`/`deleted`）。
  - 密聊/密群「仅当真正解密展示后才上报已读」——未查阅/解密失败的消息不进计时（`im_api.dart` L1402、SecretMessageController L56-L62）。
- 账号级自毁（区别于会话级）：`/users/me/self-destruct` 的 policy 为 `off/1mo/3mo/6mo/1yr`，仅清聊天记录、不注销账号（`self_destruct_policy.dart` L1-L5）。

---

# 四、消息模型

## 4.1 MsgType 11 种枚举

证据：`gv_im_server/platform/im-common/.../enums/MsgType.java` L9-L23（@JsonValue 小写）。

| 枚举常量 | 线上值（@JsonValue） |
|---|---|
| TEXT | `text` |
| IMAGE | `image` |
| FILE | `file` |
| VOICE | `voice` |
| VIDEO | `video` |
| LOCATION | `location` |
| NAMECARD | `namecard` |
| CALL | `call` |
| SYSTEM | `system` |
| RECALL | `recall` |
| EMOJI | `emoji` |

## 4.2 ChatType 5 种枚举

证据：`ChatType.java` L9-L17。

| 枚举常量 | 线上值（@JsonValue） | HTTP query 值（Enum.valueOf） |
|---|---|---|
| PRIVATE | `private` | `PRIVATE` |
| GROUP | `group` | `GROUP` |
| CHANNEL | `channel` | `CHANNEL` |
| SECRET | `secret` | `SECRET` |
| SECRET_GROUP | `secret_group` | `SECRET_GROUP` |

> HTTP 查询参数用大写（`chatTypeToHttpQuery` → `toUpperCase()`）；JSON/WS 用小写 @JsonValue。

## 4.3 消息 JSON 字段（服务端权威：MessageResponse + WS chat:receive）

证据：`MessageResponse.java` L10-L13（REST）；`StoredMessageWsPayloadFactory.java` L24-L53（WS）；`Message.java` L11-L28（领域）；客户端 `ChatMessage`（`gv_chat_app/packages/gv_core/lib/src/models/chat_message.dart` L135-L167）。

**REST `MessageResponse` 字段**：`id, msgId, conversationId, seq, fromUserId, senderUsername, toId, chatType, msgType, content, clientMsgId, replyMsgId, atUsers, status, createdBy, createdAt, updatedBy, updatedAt, media`
- `media`：`[{ objectId, url }]`（`MessageMedia` record，`MessageMedia.java`）。

**WS `chat:receive` 字段**：`msgId, from, fromUsername, toId, chatType, msgType, content, media, seq, syncSeq, conversationId, timestamp, clientMsgId?, replyMsgId?, atUsers?`（见二.5）。

**客户端 `ChatMessage` DTO 字段（读值兼容）**：`msgId, from, fromUsername, fromAvatar, toId, chatType, msgType, content, timestamp, clientMsgId, replyMsgId, atUsers, seq, mediaObjectIds, status`（`chat_message.dart` L135-L167；字段读取兼容 camelCase/snake_case 与 `from`/`fromUserId`）。

> **重要更正**：任务说明中的「payload」字段名**不存在**。消息体统一用 **`content`**（字符串），媒体走 **`media`**（对象数组，含 `objectId`/`url`）而非内嵌 payload。桌面端照 `content` + `media` + `msgType` 实现，勿臆造 payload 字段。

## 4.4 content 按 msgType 的结构（渲染/解析契约）

证据：`gv_chat_app/packages/gv_core/lib/src/media/media_url.dart`（image/video）；`gv_chat_app/lib/core/namecard_message.dart`（namecard）；`gv_chat_app/lib/core/call_trace_display.dart`（call）；`chat_message.dart` L71-L100（收包归一）；`chat_room_message_tile.dart` L380-L646（渲染分支）。

| msgType | content 结构 |
|---|---|
| `text` | 纯文本；内联表情用 `[emoji]<数字>[/emoji]` 占位（`message_preview.dart` L16-L23） |
| `emoji` | 媒体 URL（表情包图片，`resolveMediaUrl`） |
| `image` | 新版 JSON `{ "v":1, "url", "w"?, "h"?, "caption"? }`；旧消息为纯 URL（`parseImageForChat` media_url.dart L70-L118） |
| `video` | 新版 JSON `{ "url", "p"?, "w"?, "h"? }`；旧消息纯 URL（`parseVideoForChat` L120-L160；`p` 为封面 poster 路径） |
| `file` | JSON `{ "name", "url" }`（`message_preview.dart` L30-L38；`chat_message.dart` L91-L98） |
| `voice` | 媒体 URL（时长经 URL query `?d=<秒>` 携带，`parseMediaDurationSecondsFromUrl` media_url.dart L35-L39） |
| `location` | **待二次核对**：后端有 LOCATION，客户端渲染无对应分支（`chat_room_message_tile.dart` 无 location case，落到 default 纯文本），未见 lat/lng schema 证据 |
| `namecard` | JSON `{ userId, displayName, username, avatar? }`（`namecard_message.dart` L17-L24） |
| `call` | JSON `{ media:"audio"|"video", kind/endReason:"completed"|"cancelled"|"rejected"|"busy"|"failed"|"resolved", durationSec: int }`（`call_trace_display.dart` L32-L42） |
| `system` | 系统文案（纯文本） |
| `recall` | 固定 `"消息已撤回"`（服务端撤回时置 `content="消息已撤回"`，`Message.java` L79） |

## 4.5 MsgStatus 与已读粒度

证据：`MsgStatus.java` L8-L15；`MessageReadStatus.java`（record `(msgId,userId,readAt)`）；客户端 `chat_database.dart` L28-L49。

- **MsgStatus**（@JsonValue 小写）：`sent` / `delivered` / `read` / `recalled`。
  - 客户端本地额外用 `sending`（乐观发送中，`chat_database.dart` L393）、`recalled`（本地判定 `status=='recalled' || msgType=='recall'`，`chat_message.dart` L172）。
- **已读粒度**：`MessageReadStatus` 是**逐条**（msgId × userId × readAt），服务端 `saveIfAbsent` 去重（`MessageApplicationService.java` L102）。即「已读」是消息级，不是会话级水位。
  - 同步响应里 `readAt != null` → 客户端把该消息 status 置 `read`（`message_sync.dart` L26-L28）。

## 4.6 RECALL 语义

证据：`Message.java` L77-L81；`MessageController.java` L99-L113；`ImWebSocketHandler` L206-L217；`message_preview.dart` L116-L130。

- 撤回后消息**原地改写**：`msgType → RECALL`、`content → "消息已撤回"`、`status → RECALLED`、`atUsers → []`、`mediaObjectIds → []`（`Message.recalled` L77-L81）。
- 触发：WS `chat:recall { msgId }` 或 REST `POST /messages/recall { msgId }`（内部走 `deleteForEveryone(..., recall=true)`）。
- 广播：`chat:recall_notify`（对端渲染撤回墓碑）。
- 客户端可撤回判定：仅自己发送、非 `recall`/`call` 类型、非 `sending` 状态（`canRecallMessage` message_preview.dart L116-L129，注释「撤回不限时」）。
- 密聊/密群的撤回/删除走独立端点（见一.8/一.9），reason 为 `recalled`/`deleted`，通过 `.../states` 增量同步移除。

## 4.7 本地库表结构（桌面端 better-sqlite3 需对齐的基线）

证据：`gv_chat_app/lib/database/chat_database.dart`（Drift，4 表，schemaVersion=5）。

| 表 | 主键 | 关键列 |
|---|---|---|
| CachedConversations | (scopeId, peerId, chatType) | name, avatar, lastMessage, lastTime, unread, pinned, muted, draftText |
| CachedMessages | (scopeId, msgId) | peerId, fromUserId, fromUsername, fromAvatar, toId, chatType, msgType, content, timestamp, seq, clientMsgId, replyMsgId, atUsersJson, mediaObjectIdsJson, status |
| ChatOutboxEntries | (scopeId, clientMsgId) | peerId, toId, chatType, msgType, content, replyMsgId, atUsersJson, mediaObjectIdsJson, createdAt |
| MessageSyncStates | (scopeId) | lastSyncedSyncSeq（同步水位） |

- `scopeId` 语义：`<账号标识>|<userId>`（`_scopeUserId` 从 `lastIndexOf('|')+1` 解析，chat_database.dart L640-L646）。
- `atUsersJson` / `mediaObjectIdsJson` 存 JSON 数组字符串。
- 桌面端若用 better-sqlite3，等价建 4 表 + 两个索引（`idx_cached_messages_session_time(scope_id,chat_type,peer_id,timestamp)`、`idx_cached_messages_client_id(scope_id,client_msg_id)`，见 L104-L115）。

---

# 核对清单（未能 100% 确认 / 需与 Flutter 端或后端 owner 二次确认）

1. **libsodium ↔ Flutter AES-GCM 字节级互操作**：Flutter `package:cryptography` 的 AesGcm 输出布局已确认为 `nonce(12B)||ciphertext||tag(16B)` 前缀拼接（e2ee_crypto.dart L65-L69）；但两端从未实测互通。需用一组已知明文/共享密钥做交叉 KAT，确认 libsodium `crypto_aead_aes256gcm_*` 的 tag 位置/长度（16B）与 nonce 前缀拼接一致。核对路径：`gv_chat_app/lib/services/e2ee/e2ee_crypto.dart`。
2. **X25519 共享密钥是否真的不经过 KDF**：已确认 Flutter 直接用 `X25519` 原始 32B 作 AES 密钥（e2ee_crypto.dart L36-L59）。属既成契约，但桌面端实现时若改用 `crypto_box_beforenm`/`crypto_kx` 需确保不引入 HKDF/salt，否则两端密文互解失败。核对路径同上。
3. **`location` 消息 content schema**：后端有 LOCATION 枚举，但 Flutter 渲染无分支、未见 lat/lng 结构证据。需与 Flutter owner 确认 location 消息是否上线及其 content JSON 结构。核对路径：`chat_room_message_tile.dart`、后端 `MsgType.java`。
4. **群安全码客户端是否应本地重算**：后端群安全码 = 成员公钥「字典序排序 + 冒号拼接 + SHA-256 前 8 字节」（SecretGroupChat.java L57-L81）；Flutter 端注释「仅展示不重算」。桌面端若要展示/核验，需确认是否本地重算及其排序规则与后端一致。核对路径：`SecretGroupChat.java`、`secret_group_chat_models.dart`。
5. **secret message/group status 枚举全集**：客户端 `SecretMessageWire` 默认 `active`，states 接口 reason 为 `recalled`/`deleted`；完整 status 值域（是否还有 `destroyed` 等）未逐条穷尽。核对路径：`SecretMessageResult.java`、`SecretMessageController.java`。
6. **file 消息 content 是否含 size**：客户端 file JSON 仅 `{name,url}`（chat_message.dart L91-L98）；文件大小取自媒体 access 响应 `size`，不在消息 content 内。若桌面端要显示大小，需确认是否有其它字段来源。
7. **`chat:receive` 是否补发 `mediaObjectIds`**：WS 载荷含 `media`（对象数组）不含 `mediaObjectIds`（StoredMessageWsPayloadFactory L33）；客户端靠 `media[].objectId` 归一。桌面端应直接消费 `media`，不要等 `mediaObjectIds`。
8. **TokenResponse 字段名**：登录/注册响应为 `{ access_token, user }`（TokenResponse.java L5）；但 Flutter ApiClient 读的是 `_storage.token`。桌面端需确认客户端从 `access_token` 取值的实际落库逻辑，避免字段名混淆。核对路径：`TokenResponse.java`、`gv_chat_app/lib/core/local_storage.dart`。
9. **`chat:read` / `chat:recall` 的 `commandId`**：为服务端受理流水，客户端仅需透传/忽略；其是否可用于幂等去重未确认。
10. **WS 心跳间隔**：服务端对 `heartbeat` 回 `{timestamp}`（ImWebSocketHandler L100-L101），但客户端建议心跳周期未在代码里找到权威常量，需与后端 owner 确认保活策略。
11. **`hideGroupMemberInfo` 双来源**：平台级开关经 `/config/client` 下发（默认 true），但 `/users/me/privacy-settings` 响应 DTO 仍含 `hideGroupMemberInfo` 字段（PrivacySettingsResponse.java L4）。需与后端 owner 确认该残留字段是否已废弃、桌面端应以哪个为准。

---

（完）
