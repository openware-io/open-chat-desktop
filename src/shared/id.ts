/** Keep numeric IDs stable across JSON, IPC, and SQLite TEXT columns. */
export function normalizeEntityId(value: unknown): string {
  const text = String(value ?? '').trim()
  const integerFloat = /^(\d+)\.0+$/.exec(text)
  return integerFloat ? integerFloat[1] : text
}
