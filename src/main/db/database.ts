/** 本地库（node:sqlite，Electron 44 内置 Node 24 自带，零原生依赖）。
 *  4 表对齐 Flutter Drift schemaVersion=5 的语义（会话/消息/发件箱/同步水位）。 */
import { DatabaseSync } from 'node:sqlite'
import type {
  ConversationRow,
  MessageRow,
  OutboxRow,
  SyncStateRow,
  ChatType
} from '../../shared/db'
import { normalizeEntityId } from '../../shared/id'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  scope_id      TEXT NOT NULL,
  peer_id       TEXT NOT NULL,
  chat_type     TEXT NOT NULL,
  name          TEXT,
  avatar        TEXT,
  last_message  TEXT,
  last_time     INTEGER,
  unread        INTEGER NOT NULL DEFAULT 0,
  pinned        INTEGER NOT NULL DEFAULT 0,
  muted         INTEGER NOT NULL DEFAULT 0,
  draft_text    TEXT,
  PRIMARY KEY (scope_id, peer_id, chat_type)
);

CREATE TABLE IF NOT EXISTS messages (
  scope_id              TEXT NOT NULL,
  msg_id                TEXT NOT NULL,
  peer_id               TEXT NOT NULL,
  from_user_id          TEXT NOT NULL,
  from_username         TEXT,
  from_avatar           TEXT,
  to_id                 TEXT NOT NULL,
  chat_type             TEXT NOT NULL,
  msg_type              TEXT NOT NULL,
  content               TEXT NOT NULL,
  timestamp             INTEGER NOT NULL,
  seq                   INTEGER NOT NULL,
  client_msg_id         TEXT,
  reply_msg_id          TEXT,
  at_users_json         TEXT,
  media_object_ids_json TEXT,
  status                TEXT NOT NULL,
  PRIMARY KEY (scope_id, msg_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_session_time
  ON messages (scope_id, chat_type, peer_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_client_id
  ON messages (scope_id, client_msg_id);

CREATE TABLE IF NOT EXISTS outbox (
  scope_id              TEXT NOT NULL,
  client_msg_id         TEXT NOT NULL,
  peer_id               TEXT NOT NULL,
  to_id                 TEXT NOT NULL,
  chat_type             TEXT NOT NULL,
  msg_type              TEXT NOT NULL,
  content               TEXT NOT NULL,
  reply_msg_id          TEXT,
  at_users_json         TEXT,
  media_object_ids_json TEXT,
  created_at            INTEGER NOT NULL,
  PRIMARY KEY (scope_id, client_msg_id)
);

CREATE TABLE IF NOT EXISTS sync_states (
  scope_id             TEXT PRIMARY KEY,
  last_synced_sync_seq INTEGER NOT NULL DEFAULT 0
);
`

export class ChatDatabase {
  private db: DatabaseSync

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec(SCHEMA)
    this.repairLegacyMessageIdentity()
  }

  private repairLegacyMessageIdentity(): void {
    this.db.exec(`
      UPDATE messages
      SET from_user_id = substr(from_user_id, 1, length(from_user_id) - 2)
      WHERE from_user_id = CAST(CAST(from_user_id AS INTEGER) AS TEXT) || '.0';

      DELETE FROM messages
      WHERE rowid IN (
        SELECT duplicate_row_id
        FROM (
          SELECT
            rowid AS duplicate_row_id,
            ROW_NUMBER() OVER (
              PARTITION BY scope_id, from_user_id, client_msg_id
              ORDER BY
                CASE WHEN msg_id = client_msg_id THEN 1 ELSE 0 END,
                seq DESC,
                timestamp DESC,
                rowid DESC
            ) AS duplicate_rank
          FROM messages
          WHERE client_msg_id IS NOT NULL AND client_msg_id <> ''
        )
        WHERE duplicate_rank > 1
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_sender_client_id_unique
        ON messages (scope_id, from_user_id, client_msg_id)
        WHERE client_msg_id IS NOT NULL AND client_msg_id <> '';
    `)
  }

  close(): void {
    this.db.close()
  }

  getConversations(scopeId: string): ConversationRow[] {
    return this.db
      .prepare('SELECT scope_id AS scopeId, peer_id AS peerId, chat_type AS chatType, name, avatar, last_message AS lastMessage, last_time AS lastTime, unread, pinned, muted, draft_text AS draftText FROM conversations WHERE scope_id = ? ORDER BY pinned DESC, last_time DESC')
      .all(scopeId) as unknown as ConversationRow[]
  }

  upsertConversation(row: ConversationRow): void {
    this.db
      .prepare(
        'INSERT INTO conversations (scope_id, peer_id, chat_type, name, avatar, last_message, last_time, unread, pinned, muted, draft_text) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(scope_id, peer_id, chat_type) DO UPDATE SET ' +
        'name=excluded.name, avatar=excluded.avatar, last_message=excluded.last_message, ' +
        'last_time=excluded.last_time, unread=excluded.unread, pinned=excluded.pinned, ' +
        'muted=excluded.muted, draft_text=excluded.draft_text'
      )
      .run(
        row.scopeId, row.peerId, row.chatType, row.name, row.avatar, row.lastMessage,
        row.lastTime, row.unread, row.pinned, row.muted, row.draftText
      )
  }

  deleteConversation(scopeId: string, peerId: string, chatType: ChatType): void {
    this.db
      .prepare('DELETE FROM conversations WHERE scope_id = ? AND peer_id = ? AND chat_type = ?')
      .run(scopeId, peerId, chatType)
  }

  getMessages(
    scopeId: string,
    peerId: string,
    chatType: ChatType,
    limit: number,
    beforeSeq?: number
  ): MessageRow[] {
    const base = 'SELECT scope_id AS scopeId, msg_id AS msgId, peer_id AS peerId, from_user_id AS fromUserId, from_username AS fromUsername, from_avatar AS fromAvatar, to_id AS toId, chat_type AS chatType, msg_type AS msgType, content, timestamp, seq, client_msg_id AS clientMsgId, reply_msg_id AS replyMsgId, at_users_json AS atUsersJson, media_object_ids_json AS mediaObjectIdsJson, status FROM messages WHERE scope_id = ? AND peer_id = ? AND chat_type = ?'
    if (beforeSeq != null) {
      return this.db
        .prepare(base + ' AND seq < ? ORDER BY seq DESC LIMIT ?')
        .all(scopeId, peerId, chatType, beforeSeq, limit) as unknown as MessageRow[]
    }
    return this.db
      .prepare(base + ' ORDER BY seq DESC LIMIT ?')
      .all(scopeId, peerId, chatType, limit) as unknown as MessageRow[]
  }

  upsertMessage(row: MessageRow): void {
    const fromUserId = normalizeEntityId(row.fromUserId)
    // A locally optimistic message uses clientMsgId as its temporary msgId.
    // Once ack/history/sync returns the server msgId, remove that placeholder
    // first so the same message cannot be rendered twice after an app restart.
    if (row.clientMsgId) {
      this.db
        .prepare(
          'DELETE FROM messages WHERE scope_id = ? AND from_user_id = ? AND client_msg_id = ? AND msg_id <> ?'
        )
        .run(row.scopeId, fromUserId, row.clientMsgId, row.msgId)
    }
    this.db
      .prepare(
        'INSERT INTO messages (scope_id, msg_id, peer_id, from_user_id, from_username, from_avatar, to_id, chat_type, msg_type, content, timestamp, seq, client_msg_id, reply_msg_id, at_users_json, media_object_ids_json, status) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(scope_id, msg_id) DO UPDATE SET ' +
        'peer_id=excluded.peer_id, from_user_id=excluded.from_user_id, from_username=excluded.from_username, ' +
        'from_avatar=excluded.from_avatar, to_id=excluded.to_id, chat_type=excluded.chat_type, ' +
        'msg_type=excluded.msg_type, content=excluded.content, timestamp=excluded.timestamp, seq=excluded.seq, ' +
        'client_msg_id=excluded.client_msg_id, reply_msg_id=excluded.reply_msg_id, ' +
        'at_users_json=excluded.at_users_json, media_object_ids_json=excluded.media_object_ids_json, ' +
        'status=excluded.status'
      )
      .run(
        row.scopeId, row.msgId, row.peerId, fromUserId, row.fromUsername, row.fromAvatar,
        row.toId, row.chatType, row.msgType, row.content, row.timestamp, row.seq,
        row.clientMsgId, row.replyMsgId, row.atUsersJson, row.mediaObjectIdsJson, row.status
      )
  }

  deleteMessage(scopeId: string, msgId: string): void {
    this.db.prepare('DELETE FROM messages WHERE scope_id = ? AND msg_id = ?').run(scopeId, msgId)
  }

  clearConversationMessages(scopeId: string, peerId: string, chatType: ChatType): void {
    this.db
      .prepare('DELETE FROM messages WHERE scope_id = ? AND peer_id = ? AND chat_type = ?')
      .run(scopeId, peerId, chatType)
    this.db
      .prepare('DELETE FROM outbox WHERE scope_id = ? AND peer_id = ? AND chat_type = ?')
      .run(scopeId, peerId, chatType)
  }

  clearAllMessages(scopeId: string): void {
    this.db.prepare('DELETE FROM messages WHERE scope_id = ?').run(scopeId)
    this.db.prepare('DELETE FROM outbox WHERE scope_id = ?').run(scopeId)
  }

  getOutbox(scopeId: string): OutboxRow[] {
    return this.db
      .prepare('SELECT scope_id AS scopeId, client_msg_id AS clientMsgId, peer_id AS peerId, to_id AS toId, chat_type AS chatType, msg_type AS msgType, content, reply_msg_id AS replyMsgId, at_users_json AS atUsersJson, media_object_ids_json AS mediaObjectIdsJson, created_at AS createdAt FROM outbox WHERE scope_id = ? ORDER BY created_at ASC')
      .all(scopeId) as unknown as OutboxRow[]
  }

  upsertOutbox(row: OutboxRow): void {
    this.db
      .prepare(
        'INSERT INTO outbox (scope_id, client_msg_id, peer_id, to_id, chat_type, msg_type, content, reply_msg_id, at_users_json, media_object_ids_json, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(scope_id, client_msg_id) DO UPDATE SET content=excluded.content'
      )
      .run(
        row.scopeId, row.clientMsgId, row.peerId, row.toId, row.chatType, row.msgType,
        row.content, row.replyMsgId, row.atUsersJson, row.mediaObjectIdsJson, row.createdAt
      )
  }

  deleteOutbox(scopeId: string, clientMsgId: string): void {
    this.db
      .prepare('DELETE FROM outbox WHERE scope_id = ? AND client_msg_id = ?')
      .run(scopeId, clientMsgId)
  }

  getSyncState(scopeId: string): SyncStateRow {
    const row = this.db
      .prepare('SELECT scope_id AS scopeId, last_synced_sync_seq AS lastSyncedSyncSeq FROM sync_states WHERE scope_id = ?')
      .get(scopeId) as SyncStateRow | undefined
    return row ?? { scopeId, lastSyncedSyncSeq: 0 }
  }

  setSyncState(scopeId: string, lastSyncedSyncSeq: number): void {
    this.db
      .prepare(
        'INSERT INTO sync_states (scope_id, last_synced_sync_seq) VALUES (?, ?) ' +
        'ON CONFLICT(scope_id) DO UPDATE SET last_synced_sync_seq=excluded.last_synced_sync_seq'
      )
      .run(scopeId, lastSyncedSyncSeq)
  }

  clearScope(scopeId: string): void {
    for (const t of ['conversations', 'messages', 'outbox', 'sync_states']) {
      this.db.prepare('DELETE FROM ' + t + ' WHERE scope_id = ?').run(scopeId)
    }
  }
}
