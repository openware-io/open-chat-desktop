/** 好友模型（对齐 Flutter friend_models.dart） */
import { t } from '../i18n'

export interface FriendUserBrief {
  id: number
  username: string
  nickname?: string | null
  avatar?: string | null
  signature?: string | null
}

export interface FriendItem {
  friendId: number
  userId?: number | null
  remark?: string | null
  groupName?: string | null
  friendUser?: FriendUserBrief | null
  /** 兼容后端扁平字段（api 返回 friendUsername/friendNickname 而非嵌套 friendUser） */
  friendUsername?: string | null
  friendNickname?: string | null
  friendAvatar?: string | null
  friendSignature?: string | null
}

export interface FriendRequestItem {
  id: number
  fromUserId: number
  toUserId: number
  message?: string | null
  status?: string | null
  fromUser?: FriendUserBrief | null
  /** 兼容后端扁平字段 */
  fromUsername?: string | null
  fromNickname?: string | null
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function numericId(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizeUser(value: unknown, fallback: Record<string, unknown>): FriendUserBrief | null {
  const raw = record(value)
  const id = numericId(raw.id ?? fallback.friendId ?? fallback.friend_id ?? fallback.fromUserId ?? fallback.from_user_id)
  const username = nullableText(raw.username ?? fallback.friendUsername ?? fallback.friend_username ?? fallback.fromUsername ?? fallback.from_username) ?? ''
  const nickname = nullableText(raw.nickname ?? fallback.friendNickname ?? fallback.friend_nickname ?? fallback.fromNickname ?? fallback.from_nickname)
  const avatar = nullableText(raw.avatar ?? fallback.friendAvatar ?? fallback.friend_avatar)
  const signature = nullableText(raw.signature ?? fallback.friendSignature ?? fallback.friend_signature)
  if (!id && !username && !nickname && !avatar && !signature) return null
  return { id, username, nickname, avatar, signature }
}

/** 与 Flutter FriendItem.fromJson 一致地归一化历史/新接口字段。 */
export function normalizeFriendItem(value: unknown): FriendItem {
  const raw = record(value)
  return {
    friendId: numericId(raw.friendId ?? raw.friend_id),
    userId:
      raw.userId != null || raw.user_id != null
        ? numericId(raw.userId ?? raw.user_id)
        : null,
    remark: nullableText(raw.remark),
    groupName: nullableText(raw.groupName ?? raw.group_name),
    friendUser: normalizeUser(raw.friendUser ?? raw.friend_user, raw),
    friendUsername: nullableText(raw.friendUsername ?? raw.friend_username),
    friendNickname: nullableText(raw.friendNickname ?? raw.friend_nickname),
    friendAvatar: nullableText(raw.friendAvatar ?? raw.friend_avatar),
    friendSignature: nullableText(raw.friendSignature ?? raw.friend_signature)
  }
}

export function normalizeFriendRequestItem(value: unknown): FriendRequestItem {
  const raw = record(value)
  return {
    id: numericId(raw.id),
    fromUserId: numericId(raw.fromUserId ?? raw.from_user_id),
    toUserId: numericId(raw.toUserId ?? raw.to_user_id),
    message: nullableText(raw.message),
    status: nullableText(raw.status),
    fromUser: normalizeUser(
      raw.fromUser ?? raw.from_user ?? raw.sender ?? raw.user ?? raw.from,
      raw
    ),
    fromUsername: nullableText(raw.fromUsername ?? raw.from_username),
    fromNickname: nullableText(raw.fromNickname ?? raw.from_nickname)
  }
}

/** 取好友的昵称：remark || nickname（嵌套或扁平）|| username（嵌套或扁平） */
export function friendDisplayName(f: FriendItem): string {
  const r = f.remark?.trim()
  if (r) return r
  const n = (f.friendUser?.nickname ?? f.friendNickname)?.trim()
  if (n) return n
  const u = (f.friendUser?.username ?? f.friendUsername)?.trim()
  return u || t('common.unknown')
}

export function friendUsername(f: FriendItem): string {
  return (f.friendUser?.username ?? f.friendUsername)?.trim() || String(f.friendId)
}

export function friendAvatar(f: FriendItem): string | null {
  return (f.friendUser?.avatar ?? f.friendAvatar)?.trim() || null
}

export function friendSignature(f: FriendItem): string {
  return (f.friendUser?.signature ?? f.friendSignature)?.trim() || ''
}
