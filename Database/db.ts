import chalk from 'chalk'
import { getDB } from './sqlite.js'
import type { UserData, GroupData } from '../types/global.js'

// ============================================================
// Kolom tetap (hybrid model) — field di luar daftar ini otomatis
// nampung di kolom `extra` (JSON), jadi plugin baru yang nambah
// field sendiri TETAP jalan tanpa perlu ubah schema.
// ============================================================
const USER_COLUMNS = [
  'number', 'name', 'registered', 'regName', 'regDate', 'registered_at', 'sn_code',
  'level', 'exp', 'premium', 'premiumExpiry', 'is_banned',
  'gold', 'diamond', 'apel', 'potion', 'balance', 'bank', 'health', 'max_health',
  'armor', 'sword', 'pickaxe', 'limit_item', 'dungeon_active', 'mining_active', 'last_mining'
]
const USER_BOOL_COLUMNS = new Set(['registered', 'premium', 'is_banned', 'dungeon_active', 'mining_active'])

const GROUP_COLUMNS = ['subject', 'owner', 'ownerPn', 'size', 'creation', 'restrict', 'announce', 'addressingMode', 'selfmode']
const GROUP_BOOL_COLUMNS = new Set(['restrict', 'announce', 'selfmode'])
// 'restrict' bentrok sama gaya penamaan, disimpan di kolom fisik `restrict_only`
const GROUP_COL_DB_NAME: Record<string, string> = { restrict: 'restrict_only' }

function cleanJid(jid: string): string {
  if (!jid) return ''
  const base = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
  return base ? base + '@s.whatsapp.net' : ''
}

// ---------- helpers: row <-> flat object ----------
function rowToUser(row: Record<string, unknown>): UserData {
  const extra: Record<string, unknown> = JSON.parse((row.extra as string) || '{}')
  const out: Record<string, unknown> = { ...extra, id: row.id }
  for (const c of USER_COLUMNS) {
    const v = row[c]
    if (v === null || v === undefined) continue
    out[c] = USER_BOOL_COLUMNS.has(c) ? !!v : v
  }
  return out as UserData
}

function splitUserPartial(partial: Record<string, unknown>): { row: Record<string, unknown>; extraPatch: Record<string, unknown> } {
  const row: Record<string, unknown> = {}
  const extraPatch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(partial)) {
    if (k === 'id') continue
    if (USER_COLUMNS.includes(k)) {
      row[k] = USER_BOOL_COLUMNS.has(k) ? (v ? 1 : 0) : v
    } else {
      extraPatch[k] = v
    }
  }
  return { row, extraPatch }
}

function rowToGroup(row: Record<string, unknown>): GroupData {
  const extra: Record<string, unknown> = JSON.parse((row.extra as string) || '{}')
  const out: Record<string, unknown> = { ...extra, id: row.id }
  for (const c of GROUP_COLUMNS) {
    const dbCol = GROUP_COL_DB_NAME[c] ?? c
    const v = row[dbCol]
    if (v === null || v === undefined) continue
    out[c] = GROUP_BOOL_COLUMNS.has(c) ? !!v : v
  }
  return out as GroupData
}

function splitGroupPartial(partial: Record<string, unknown>): { row: Record<string, unknown>; extraPatch: Record<string, unknown> } {
  const row: Record<string, unknown> = {}
  const extraPatch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(partial)) {
    if (k === 'id') continue
    if (GROUP_COLUMNS.includes(k)) {
      const dbCol = GROUP_COL_DB_NAME[k] ?? k
      row[dbCol] = GROUP_BOOL_COLUMNS.has(k) ? (v ? 1 : 0) : v
    } else {
      extraPatch[k] = v
    }
  }
  return { row, extraPatch }
}

// ============================================================
// INIT
// ============================================================
export function initDB(): void {
  const db = getDB()
  const userCount  = (db.prepare('SELECT COUNT(*) c FROM users').get()  as { c: number }).c
  const groupCount = (db.prepare('SELECT COUNT(*) c FROM groups').get() as { c: number }).c
  const lidCount   = (db.prepare('SELECT COUNT(*) c FROM lidmap').get() as { c: number }).c
  const pushCount  = (db.prepare('SELECT COUNT(*) c FROM pushname').get() as { c: number }).c
  console.log(chalk.green.bold(`✅ Users DB ready → ${userCount} user`))
  console.log(chalk.green.bold(`✅ Groups DB ready → ${groupCount} grup`))
  console.log(chalk.green.bold(`✅ LID Map DB ready → ${lidCount} mapping`))
  console.log(chalk.green.bold(`✅ PushName DB ready → ${pushCount} nama`))
}

// ============================================================
// USERS
// ============================================================
export function isRegistered(jid: string): boolean {
  try {
    const clean = cleanJid(jid)
    if (!clean || clean === '@s.whatsapp.net') return false
    const db  = getDB()
    const row = db.prepare('SELECT id FROM users WHERE id = ?').get(clean)
    return !!row
  } catch { return false }
}

export function registerUser(jid: string, number: string, name: string = 'User'): boolean {
  try {
    const clean = cleanJid(jid)
    if (!clean || clean === '@s.whatsapp.net') return false
    const db = getDB()
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(clean)
    if (existing) return false

    db.prepare(`
      INSERT INTO users (id, number, name, registered, regName, regDate, level, exp, premium, premiumExpiry, extra)
      VALUES (@id, @number, @name, 1, @regName, @regDate, 1, 0, 0, NULL, '{}')
    `).run({
      id:      clean,
      number:  clean.replace('@s.whatsapp.net', ''),
      name,
      regName: name,
      regDate: new Date().toLocaleDateString('id-ID'),
    })
    return true
  } catch (e) {
    console.error('[DB registerUser error]', (e as Error).message)
    return false
  }
}

export function getUser(jid: string): UserData | null {
  try {
    const clean = cleanJid(jid)
    const db  = getDB()
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(clean) as Record<string, unknown> | undefined
    return row ? rowToUser(row) : null
  } catch { return null }
}

export function updateUserName(jid: string, name: string): void {
  try {
    const clean = cleanJid(jid)
    const db = getDB()
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, clean)
  } catch (e) {
    console.error('[DB updateUserName error]', (e as Error).message)
  }
}

export function countUsers(): number {
  try {
    const db = getDB()
    return (db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c
  } catch { return 0 }
}

export function setPremium(jid: string, value: number = 1): void {
  try {
    const clean = cleanJid(jid)
    const db = getDB()
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(clean)
    if (!exists) db.prepare(`INSERT INTO users (id, registered, extra) VALUES (?, 1, '{}')`).run(clean)
    db.prepare('UPDATE users SET premium = ?, premiumExpiry = ? WHERE id = ?')
      .run(value === 1 ? 1 : 0, value === 1 ? null : Date.now(), clean)
  } catch {  }
}

export function banUser(jid: string, value: number = 1): void {
  try {
    const clean = cleanJid(jid)
    if (!clean || clean === '@s.whatsapp.net') return
    const db = getDB()
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(clean)
    if (!exists) db.prepare(`INSERT INTO users (id, registered, extra) VALUES (?, 1, '{}')`).run(clean)
    db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(value === 1 ? 1 : 0, clean)
  } catch {  }
}

export function updateUser(jid: string, partial: Partial<UserData>): boolean {
  try {
    const clean = cleanJid(jid)
    if (!clean || clean === '@s.whatsapp.net') return false
    const db = getDB()
    const existingRow = db.prepare('SELECT * FROM users WHERE id = ?').get(clean) as Record<string, unknown> | undefined
    if (!existingRow) return false

    const { row, extraPatch } = splitUserPartial(partial as Record<string, unknown>)
    const mergedExtra = { ...JSON.parse((existingRow.extra as string) || '{}'), ...extraPatch }

    const assignments = [...Object.keys(row).map(c => `${c} = @${c}`), 'extra = @extra']
    db.prepare(`UPDATE users SET ${assignments.join(', ')} WHERE id = @id`)
      .run({ ...row, extra: JSON.stringify(mergedExtra), id: clean })
    return true
  } catch (e) {
    console.error('[DB updateUser error]', (e as Error).message)
    return false
  }
}

export function unregisterUser(jid: string): boolean {
  try {
    const clean = cleanJid(jid)
    if (!clean || clean === '@s.whatsapp.net') return false
    const db  = getDB()
    const res = db.prepare('DELETE FROM users WHERE id = ?').run(clean)
    return res.changes > 0
  } catch (e) {
    console.error('[DB unregisterUser error]', (e as Error).message)
    return false
  }
}

export function getUsers(): Record<string, UserData> {
  try {
    const db   = getDB()
    const rows = db.prepare('SELECT * FROM users').all() as Record<string, unknown>[]
    const out: Record<string, UserData> = {}
    for (const r of rows) out[r.id as string] = rowToUser(r)
    return out
  } catch { return {} }
}

// ============================================================
// GROUPS
// ============================================================
function _upsertGroup(jid: string, partial: Record<string, unknown>): void {
  const db = getDB()
  const existingRow = db.prepare('SELECT * FROM groups WHERE id = ?').get(jid) as Record<string, unknown> | undefined
  const { row, extraPatch } = splitGroupPartial(partial)
  const existingExtra = existingRow ? JSON.parse((existingRow.extra as string) || '{}') : {}
  const mergedExtra = { ...existingExtra, ...extraPatch }

  if (!existingRow) {
    const cols = ['id', ...Object.keys(row), 'extra']
    const placeholders = cols.map(c => '@' + c).join(', ')
    db.prepare(`INSERT INTO groups (${cols.join(', ')}) VALUES (${placeholders})`)
      .run({ id: jid, ...row, extra: JSON.stringify(mergedExtra) })
  } else {
    const assignments = [...Object.keys(row).map(c => `${c} = @${c}`), 'extra = @extra']
    db.prepare(`UPDATE groups SET ${assignments.join(', ')} WHERE id = @id`)
      .run({ ...row, extra: JSON.stringify(mergedExtra), id: jid })
  }
}

export function saveGroup(jid: string, metadata: Partial<GroupData>): void {
  try {
    if (!jid || !metadata) return
    _upsertGroup(jid, metadata as Record<string, unknown>)
  } catch (e) {
    console.error('[DB saveGroup error]', (e as Error).message)
  }
}

export function getGroup(jid: string): GroupData | null {
  try {
    const db  = getDB()
    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(jid) as Record<string, unknown> | undefined
    return row ? rowToGroup(row) : null
  } catch { return null }
}

export function updateGroup(jid: string, partial: Partial<GroupData>): void {
  try {
    if (!jid) return
    _upsertGroup(jid, partial as Record<string, unknown>)
  } catch (e) {
    console.error('[DB updateGroup error]', (e as Error).message)
  }
}

export function deleteGroup(jid: string): void {
  try {
    const db = getDB()
    db.prepare('DELETE FROM groups WHERE id = ?').run(jid)
  } catch (e) {
    console.error('[DB deleteGroup error]', (e as Error).message)
  }
}

export function countGroups(): number {
  try {
    const db = getDB()
    return (db.prepare('SELECT COUNT(*) c FROM groups').get() as { c: number }).c
  } catch { return 0 }
}

export function getAllGroups(): Record<string, GroupData> {
  try {
    const db   = getDB()
    const rows = db.prepare('SELECT * FROM groups').all() as Record<string, unknown>[]
    const out: Record<string, GroupData> = {}
    for (const r of rows) out[r.id as string] = rowToGroup(r)
    return out
  } catch { return {} }
}

// ============================================================
// CACHE / WRITE QUEUE COMPAT SHIMS
// SQLite (better-sqlite3) sync & langsung commit ke disk, jadi gak
// butuh in-memory cache atau debounce write lagi. Function ini
// dipertahankan biar caller lama (clearcache.ts dll) gak error.
// ============================================================
export function clearDBCache(): void {
  console.log(chalk.cyan('[DB] (SQLite) Tidak ada in-memory cache yang perlu dibersihkan — data selalu fresh dari DB'))
}

export function cancelPendingWrites(): void {
  console.log(chalk.cyan('[DB] (SQLite) Tidak ada pending write — semua write sudah sync/commit langsung'))
}

// ============================================================
// LID MAP
// ============================================================
export function saveLidMap(lid: string, phone: string): void {
  try {
    if (!lid || !phone) return
    const db = getDB()
    const existing = db.prepare('SELECT phone FROM lidmap WHERE lid = ?').get(lid) as { phone: string } | undefined
    if (existing && existing.phone === phone) return
    db.prepare(`
      INSERT INTO lidmap (lid, phone) VALUES (?, ?)
      ON CONFLICT(lid) DO UPDATE SET phone = excluded.phone
    `).run(lid, phone)
  } catch (e) {
    console.error('[DB saveLidMap error]', (e as Error).message)
  }
}

export function getPhoneByLid(lid: string): string | null {
  try {
    if (!lid) return null
    const db  = getDB()
    const row = db.prepare('SELECT phone FROM lidmap WHERE lid = ?').get(lid) as { phone: string } | undefined
    return row?.phone ?? null
  } catch { return null }
}

export function getLidByPhone(phone: string): string | null {
  try {
    if (!phone) return null
    const db  = getDB()
    const row = db.prepare('SELECT lid FROM lidmap WHERE phone = ? LIMIT 1').get(phone) as { lid: string } | undefined
    return row ? row.lid + '@lid' : null
  } catch { return null }
}

export function getAllLidMap(): Record<string, string> {
  try {
    const db   = getDB()
    const rows = db.prepare('SELECT lid, phone FROM lidmap').all() as Array<{ lid: string; phone: string }>
    const out: Record<string, string> = {}
    for (const r of rows) out[r.lid] = r.phone
    return out
  } catch { return {} }
}

// ============================================================
// PUSHNAME
// ============================================================
export function savePushName(lid: string, name: string): void {
  try {
    if (!lid || !name || name === 'No Name') return
    const db = getDB()
    const existing = db.prepare('SELECT name FROM pushname WHERE lid = ?').get(lid) as { name: string } | undefined
    if (existing && existing.name === name) return
    db.prepare(`
      INSERT INTO pushname (lid, name) VALUES (?, ?)
      ON CONFLICT(lid) DO UPDATE SET name = excluded.name
    `).run(lid, name)
  } catch (e) {
    console.error('[DB savePushName error]', (e as Error).message)
  }
}

export function getPushName(lid: string): string | null {
  try {
    if (!lid) return null
    const db  = getDB()
    const row = db.prepare('SELECT name FROM pushname WHERE lid = ?').get(lid) as { name: string } | undefined
    return row?.name ?? null
  } catch { return null }
}


// ============================================================
// GROUP PARTICIPANTS
// ============================================================

export type ParticipantRow = {
  jid:   string
  phone: string | null
  lid:   string | null
  role:  'member' | 'admin' | 'superadmin'
}

/**
 * Simpan / update seluruh participants satu grup sekaligus.
 * Hapus semua entry lama lalu insert baru (atomic via transaction).
 */
export function saveGroupParticipants(groupId: string, participants: Array<{
  id: string; phoneNumber?: string; lid?: string; admin?: string | null
}>): void {
  try {
    const db = getDB()
    const upsert = db.prepare(`
      INSERT INTO group_participants (group_id, jid, phone, lid, role)
      VALUES (@group_id, @jid, @phone, @lid, @role)
      ON CONFLICT(group_id, jid) DO UPDATE SET
        phone = excluded.phone,
        lid   = excluded.lid,
        role  = excluded.role
    `)
    const del = db.prepare('DELETE FROM group_participants WHERE group_id = ?')

    const tx = db.transaction(() => {
      del.run(groupId)
      for (const p of participants) {
        const jid   = (p.id || '').trim()
        if (!jid) continue
        const phone = p.phoneNumber
          ? p.phoneNumber.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || null
          : jid.endsWith('@lid') ? null : jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || null
        const lid   = jid.endsWith('@lid') ? jid.split('@')[0] : (p.lid ? p.lid.split('@')[0] : null)
        const role  = p.admin === 'superadmin' ? 'superadmin' : p.admin === 'admin' ? 'admin' : 'member'
        upsert.run({ group_id: groupId, jid, phone, lid, role })
      }
    })
    tx()
  } catch (e) {
    console.error('[DB saveGroupParticipants error]', (e as Error).message)
  }
}

/** Tambah / update satu participant (misal saat member baru masuk). */
export function upsertParticipant(groupId: string, p: {
  id: string; phoneNumber?: string; lid?: string; admin?: string | null
}): void {
  try {
    const db    = getDB()
    const jid   = (p.id || '').trim()
    if (!jid) return
    const phone = p.phoneNumber
      ? p.phoneNumber.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || null
      : jid.endsWith('@lid') ? null : jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || null
    const lid   = jid.endsWith('@lid') ? jid.split('@')[0] : (p.lid ? p.lid.split('@')[0] : null)
    const role  = p.admin === 'superadmin' ? 'superadmin' : p.admin === 'admin' ? 'admin' : 'member'
    db.prepare(`
      INSERT INTO group_participants (group_id, jid, phone, lid, role)
      VALUES (@group_id, @jid, @phone, @lid, @role)
      ON CONFLICT(group_id, jid) DO UPDATE SET
        phone = excluded.phone, lid = excluded.lid, role = excluded.role
    `).run({ group_id: groupId, jid, phone, lid, role })
  } catch (e) {
    console.error('[DB upsertParticipant error]', (e as Error).message)
  }
}

/** Hapus satu participant dari grup (saat leave / kick). */
export function removeParticipant(groupId: string, jid: string): void {
  try {
    const db = getDB()
    db.prepare('DELETE FROM group_participants WHERE group_id = ? AND jid = ?').run(groupId, jid)
  } catch (e) {
    console.error('[DB removeParticipant error]', (e as Error).message)
  }
}

/** Update role participant (promote/demote). */
export function setParticipantRole(groupId: string, jid: string, role: 'member' | 'admin' | 'superadmin'): void {
  try {
    const db = getDB()
    db.prepare('UPDATE group_participants SET role = ? WHERE group_id = ? AND jid = ?').run(role, groupId, jid)
  } catch (e) {
    console.error('[DB setParticipantRole error]', (e as Error).message)
  }
}

/** Ambil semua participants satu grup dari DB. */
export function getGroupParticipants(groupId: string): ParticipantRow[] {
  try {
    const db = getDB()
    return db.prepare('SELECT jid, phone, lid, role FROM group_participants WHERE group_id = ?')
      .all(groupId) as ParticipantRow[]
  } catch { return [] }
}

/** Cari participant by LID di semua grup. */
export function findParticipantByLid(lid: string): Array<ParticipantRow & { group_id: string }> {
  try {
    const db = getDB()
    return db.prepare('SELECT group_id, jid, phone, lid, role FROM group_participants WHERE lid = ?')
      .all(lid.replace('@lid', '')) as Array<ParticipantRow & { group_id: string }>
  } catch { return [] }
}

/** Cari participant by nomor HP di semua grup. */
export function findParticipantByPhone(phone: string): Array<ParticipantRow & { group_id: string }> {
  try {
    const db  = getDB()
    const num = phone.replace(/[^0-9]/g, '')
    return db.prepare('SELECT group_id, jid, phone, lid, role FROM group_participants WHERE phone = ?')
      .all(num) as Array<ParticipantRow & { group_id: string }>
  } catch { return [] }
}

/** Hapus semua participants satu grup (dipanggil dari purgeGroupData). */
export function deleteGroupParticipants(groupId: string): void {
  try {
    getDB().prepare('DELETE FROM group_participants WHERE group_id = ?').run(groupId)
  } catch (e) {
    console.error('[DB deleteGroupParticipants error]', (e as Error).message)
  }
}

export default {
  initDB,
  isRegistered, registerUser, unregisterUser, getUser, updateUserName, updateUser,
  countUsers, getUsers, setPremium, banUser,
  saveGroup, getGroup, updateGroup, deleteGroup, countGroups, getAllGroups,
  saveLidMap, getPhoneByLid, getLidByPhone, getAllLidMap,
  savePushName, getPushName,
  clearDBCache, cancelPendingWrites,
  saveGroupParticipants, upsertParticipant, removeParticipant, setParticipantRole,
  getGroupParticipants, findParticipantByLid, findParticipantByPhone, deleteGroupParticipants,
  purgeGroupData
}

/**
 * Hapus SEMUA data yang terkait satu grup dari seluruh tabel.
 * Dipanggil saat bot keluar / dikick dari grup.
 *
 * Tabel yang dibersihkan:
 *   groups        → metadata grup
 *   kv_store      → gc_schedule, antilink, welcome config, selfmode config, dll
 *   sewagrub      → data sewa grup
 *   chat_counts   → leaderboard chat grup itu
 *
 * Yang TIDAK dihapus:
 *   users         → data user tetap (mereka bisa ada di grup lain)
 *   lidmap        → mapping LID ↔ phone tetap (bisa dipakai di konteks lain)
 *   pushname      → nama tetap (bisa dipakai di konteks lain)
 *   stats_*       → statistik global tidak dihapus per-grup
 *   usagelimit    → limit harian per user, bukan per grup
 */
export function purgeGroupData(groupJid: string): { tables: string[]; errors: string[] } {
  const db      = getDB()
  const cleaned: string[] = []
  const errors:  string[] = []

  const steps: Array<{ label: string; fn: () => void }> = [
    {
      label: 'groups',
      fn: () => { db.prepare('DELETE FROM groups WHERE id = ?').run(groupJid) }
    },
    {
      label: 'kv_store(gc_schedule)',
      fn: () => { db.prepare("DELETE FROM kv_store WHERE store = 'gc_schedule' AND key = ?").run(groupJid) }
    },
    {
      // Semua kv_store entry lain yang key-nya adalah groupJid
      // (selfmode per-grup, welcome config, anticatalog, antivirtex, dll)
      label: 'kv_store(group keys)',
      fn: () => { db.prepare("DELETE FROM kv_store WHERE key = ? AND store != 'gc_schedule'").run(groupJid) }
    },
    {
      label: 'sewagrub',
      fn: () => { db.prepare('DELETE FROM sewagrub WHERE groupId = ?').run(groupJid) }
    },
    {
      label: 'chat_counts',
      fn: () => { db.prepare('DELETE FROM chat_counts WHERE scope = ?').run(groupJid) }
    },
    {
      label: 'group_participants',
      fn: () => { db.prepare('DELETE FROM group_participants WHERE group_id = ?').run(groupJid) }
    },
  ]

  for (const step of steps) {
    try {
      step.fn()
      cleaned.push(step.label)
    } catch (e) {
      const msg = `${step.label}: ${(e as Error).message}`
      errors.push(msg)
      console.error(`[DB purgeGroupData] Error → ${msg}`)
    }
  }

  console.log(chalk.yellow(`[DB purgeGroupData] ${groupJid} → cleaned: ${cleaned.join(', ')}${errors.length ? ` | errors: ${errors.join(', ')}` : ''}`))
  return { tables: cleaned, errors }
}
