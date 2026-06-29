import { getDB } from './sqlite.js'

export interface ChatCountEntry { count: number; name?: string }
export type ChatCountScope = Record<string, ChatCountEntry>
export type ChatCountDB    = Record<string, ChatCountScope>

/**
 * Drop-in pengganti pola lama:
 *   globalThis.__chatCountDB__ = { [scope]: { [memberId]: { count, name } } }
 * yang sebelumnya dipakai bareng-bareng oleh topchat-cmd.ts, topchat.ts,
 * dan topchat-pasive.ts lewat data/chatcount.json.
 *
 * Sekarang backed oleh tabel `chat_counts` di SQLite — counter table,
 * jadi increment-nya pakai UPSERT (lebih murah daripada rewrite blob JSON
 * tiap kali ada chat masuk).
 */

export function incChatCount(scope: string, memberId: string, name?: string): void {
  const db = getDB()
  db.prepare(`
    INSERT INTO chat_counts (scope, member_id, name, count) VALUES (?, ?, ?, 1)
    ON CONFLICT(scope, member_id) DO UPDATE SET
      count = count + 1,
      name  = COALESCE(excluded.name, chat_counts.name)
  `).run(scope, memberId, name ?? null)
}

export function getLeaderboard(scope: string, limit: number = 10): Array<{ jid: string; count: number; name?: string }> {
  const db   = getDB()
  const rows = db.prepare('SELECT member_id, name, count FROM chat_counts WHERE scope = ? ORDER BY count DESC LIMIT ?').all(scope, limit) as Array<{ member_id: string; name: string | null; count: number }>
  return rows.map(r => ({ jid: r.member_id, count: r.count, name: r.name ?? undefined }))
}

export function getScope(scope: string): ChatCountScope {
  const db   = getDB()
  const rows = db.prepare('SELECT member_id, name, count FROM chat_counts WHERE scope = ?').all(scope) as Array<{ member_id: string; name: string | null; count: number }>
  const out: ChatCountScope = {}
  for (const r of rows) out[r.member_id] = { count: r.count, name: r.name ?? undefined }
  return out
}

export function getFullDB(): ChatCountDB {
  const db   = getDB()
  const rows = db.prepare('SELECT scope, member_id, name, count FROM chat_counts').all() as Array<{ scope: string; member_id: string; name: string | null; count: number }>
  const out: ChatCountDB = {}
  for (const r of rows) {
    if (!out[r.scope]) out[r.scope] = {}
    out[r.scope][r.member_id] = { count: r.count, name: r.name ?? undefined }
  }
  return out
}

/**
 * Timpa SELURUH isi chat_counts dari object nested (mirip semantik file-rewrite lama).
 * Dipakai sama topchat-cmd.ts / topchat.ts / topchat-pasive.ts yang masih mutasi
 * object `{ [scope]: { [memberId]: {count, name} } }` langsung di memory lalu "save".
 */
export function replaceFullDB(full: ChatCountDB): void {
  const db = getDB()
  const ins = db.prepare('INSERT INTO chat_counts (scope, member_id, name, count) VALUES (?, ?, ?, ?)')
  const tx = db.transaction((data: ChatCountDB) => {
    db.prepare('DELETE FROM chat_counts').run()
    for (const [scope, members] of Object.entries(data)) {
      for (const [memberId, v] of Object.entries(members)) {
        ins.run(scope, memberId, v.name ?? null, v.count ?? 0)
      }
    }
  })
  tx(full)
}

export function resetScope(scope: string): void {
  const db = getDB()
  db.prepare('DELETE FROM chat_counts WHERE scope = ?').run(scope)
}

export function resetAll(): void {
  const db = getDB()
  db.prepare('DELETE FROM chat_counts').run()
}

export default { incChatCount, getLeaderboard, getScope, getFullDB, resetScope, resetAll }
