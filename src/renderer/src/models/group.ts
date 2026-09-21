/** 群组/频道模型（对齐 Flutter group_models.dart） */

export interface GroupItem {
  id: number
  name: string
  avatar?: string | null
  ownerId?: string | null
  memberCount?: number | null
}

/** 群资料详情（字段与 App 的 GET /groups/{id} 保持一致）。 */
export interface GroupInfo extends GroupItem {
  announcement: string | null
  allowMemberInvite: boolean
  allowMemberFriendRequest: boolean
  allowMemberViewAccount: boolean
}

export interface GroupMember {
  userId: number
  nickname?: string | null
  username?: string | null
  role?: string | null
  avatar?: string | null
}

export interface ChannelResult {
  id: string
  code?: string | null
  name?: string | null
  ownerId?: string | null
  subscribed?: boolean
  memberCount?: number | null
  avatar?: string | null
  announcement?: string | null
}

export function groupMemberName(m: GroupMember): string {
  return m.nickname?.trim() || m.username?.trim() || String(m.userId)
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function numericId(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function nullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text || null
}

function nullableId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const id = String(value).trim().replace(/\.0$/, '')
  return id || null
}

function nullableCount(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function booleanOrTrue(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return !['false', '0'].includes(value.trim().toLowerCase())
  return true
}

/** 对齐 App GroupItem：兼容成员数历史字段和内嵌 members 列表。 */
export function normalizeGroupItem(value: unknown): GroupItem {
  const raw = record(value)
  const members = Array.isArray(raw.members) ? raw.members : null
  return {
    id: numericId(raw.id ?? raw.groupId ?? raw.group_id),
    name: nullableText(raw.name ?? raw.groupName ?? raw.group_name) ?? '',
    avatar: nullableText(raw.avatar ?? raw.avatarUrl ?? raw.avatar_url),
    ownerId: nullableId(
      raw.ownerId ?? raw.owner_id ?? raw.ownerUserId ?? raw.owner_user_id ?? raw.creatorId ?? raw.creator_id
    ),
    memberCount: nullableCount(
      raw.memberCount ??
        raw.member_count ??
        raw.membersCount ??
        raw.members_count ??
        members?.length
    )
  }
}

export function normalizeGroupInfo(value: unknown): GroupInfo {
  const raw = record(value)
  return {
    ...normalizeGroupItem(raw),
    announcement: nullableText(raw.announcement),
    allowMemberInvite: booleanOrTrue(raw.allowMemberInvite ?? raw.allow_member_invite),
    allowMemberFriendRequest: booleanOrTrue(
      raw.allowMemberFriendRequest ?? raw.allow_member_friend_request
    ),
    allowMemberViewAccount: booleanOrTrue(
      raw.allowMemberViewAccount ?? raw.allow_member_view_account
    )
  }
}

export function normalizeGroupMember(value: unknown): GroupMember {
  const raw = record(value)
  const nested = record(
    raw.user ?? raw.User ?? raw.member ?? raw.memberUser ?? raw.friendUser ?? raw.friend_user
  )
  const isOwner = raw.isOwner === true || raw.is_owner === true
  const isAdmin = raw.isAdmin === true || raw.is_admin === true
  return {
    userId: numericId(raw.userId ?? raw.user_id ?? nested.id ?? nested.userId ?? nested.user_id ?? raw.id),
    nickname: nullableText(
      raw.nickname ?? raw.nickName ?? raw.nick_name ??
      nested.nickname ?? nested.nickName ?? nested.nick_name ??
      raw.displayName ?? raw.display_name ?? raw.name ?? nested.displayName ?? nested.display_name ?? nested.name
    ),
    username: nullableText(raw.username ?? raw.user_name ?? raw.userName ?? nested.username ?? nested.user_name ?? nested.userName),
    role: nullableText(raw.role ?? raw.memberRole ?? raw.member_role ?? raw.permission ?? nested.role) ||
      (isOwner ? 'owner' : isAdmin ? 'admin' : null),
    avatar: nullableText(raw.avatar ?? raw.avatarUrl ?? raw.avatar_url ?? nested.avatar ?? nested.avatarUrl ?? nested.avatar_url)
  }
}

/** 群聊展示名与 App 一致：去掉旧人数后缀，再追加后端最新成员数。 */
export function groupDisplayName(group: GroupItem, count = group.memberCount): string {
  const name = group.name.trim()
  if (!name) return count == null ? '群聊' : `群聊(${count})`
  if (count == null) return name
  const stripped = name.replace(/\s*[\(（]\d+[\)）]\s*$/, '')
  return `${stripped}(${count})`
}
