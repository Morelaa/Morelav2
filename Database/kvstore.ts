import { getDB } from './sqlite.js'

/**
 * Generic JSON key-value store backed by SQLite (tabel `kv_store`).
 * Dipakai buat semua file json kecil yang sebelumnya berdiri sendiri-sendiri
 * (Own.json, Prem.json, mainowner.json, privatemode.json, disabled_plugins.json,
 *  menuconfig.json, menuimg.json, gc_schedule.json, ownertype.json, rvo_sent.json,
 *  rvo_state.json, sticker_cmd.json, jadibot.json, lastchat_owner.json,
 *  fkontak_cache.json, ownsalam.json, payment.json, selfmode_global.json,
 *  stickerpack_history.json, ownerrules.json, dll)
 *
 * `store` = nama "namespace" (mirip nama file lama tanpa .json)
 * `key`   = key di dalam namespace itu (banyak store cuma punya 1 key, misal 'value')
 */

export function kvSet(store: string, key: string, value: unknown): void {
  const db = getDB()
  db.prepare(`
    INSERT INTO kv_store (store, key, value) VALUES (?, ?, ?)
    ON CONFLICT(store, key) DO UPDATE SET value = excluded.value
  `).run(store, key, JSON.stringify(value))
}

export function kvGet<T = unknown>(store: string, key: string, fallback: T): T {
  const db  = getDB()
  const row = db.prepare('SELECT value FROM kv_store WHERE store = ? AND key = ?').get(store, key) as { value: string } | undefined
  if (!row) return fallback
  try { return JSON.parse(row.value) as T } catch { return fallback }
}

export function kvDelete(store: string, key: string): boolean {
  const db  = getDB()
  const res = db.prepare('DELETE FROM kv_store WHERE store = ? AND key = ?').run(store, key)
  return res.changes > 0
}

export function kvGetAll<T = unknown>(store: string): Record<string, T> {
  const db   = getDB()
  const rows = db.prepare('SELECT key, value FROM kv_store WHERE store = ?').all(store) as Array<{ key: string; value: string }>
  const out: Record<string, T> = {}
  for (const r of rows) {
    try { out[r.key] = JSON.parse(r.value) as T } catch { /* skip corrupt entry */ }
  }
  return out
}

export function kvSetAll(store: string, data: Record<string, unknown>): void {
  const db  = getDB()
  const ins = db.prepare(`
    INSERT INTO kv_store (store, key, value) VALUES (?, ?, ?)
    ON CONFLICT(store, key) DO UPDATE SET value = excluded.value
  `)
  const tx = db.transaction((entries: Array<[string, unknown]>) => {
    for (const [k, v] of entries) ins.run(store, k, JSON.stringify(v))
  })
  tx(Object.entries(data))
}

export function kvClearStore(store: string): void {
  const db = getDB()
  db.prepare('DELETE FROM kv_store WHERE store = ?').run(store)
}

export default { kvSet, kvGet, kvDelete, kvGetAll, kvSetAll, kvClearStore }
