import chalk from 'chalk'
import { getDB } from './sqlite.js'

export interface SewaGrubEntry {
  groupId:         string
  groupName:       string
  ownerJid:        string
  startDate:       string
  expiryDate:      string
  expiryTimestamp: number
  addedBy:         string

  remindersSent?:  number[]
}

export const REMINDER_THRESHOLDS = [
  { index: 0, ms: 24 * 60 * 60 * 1000, label: '24 jam'  },
  { index: 1, ms: 12 * 60 * 60 * 1000, label: '12 jam'  },
  { index: 2, ms:  1 * 60 * 60 * 1000, label: '1 jam'   },
]

const WINDOW_MS = 30 * 60 * 1000

function rowToEntry(row: Record<string, unknown>): SewaGrubEntry {
  return {
    groupId:         row.groupId as string,
    groupName:       row.groupName as string,
    ownerJid:        row.ownerJid as string,
    startDate:       row.startDate as string,
    expiryDate:      row.expiryDate as string,
    expiryTimestamp: row.expiryTimestamp as number,
    addedBy:         row.addedBy as string,
    remindersSent:   JSON.parse((row.remindersSent as string) || '[]'),
  }
}

export function setSewa(entry: SewaGrubEntry): void {
  const db = getDB()
  const existing = db.prepare('SELECT remindersSent FROM sewagrub WHERE groupId = ?').get(entry.groupId) as { remindersSent: string } | undefined
  const remindersSent = entry.remindersSent ?? (existing ? JSON.parse(existing.remindersSent || '[]') : [])

  db.prepare(`
    INSERT INTO sewagrub (groupId, groupName, ownerJid, startDate, expiryDate, expiryTimestamp, addedBy, remindersSent)
    VALUES (@groupId, @groupName, @ownerJid, @startDate, @expiryDate, @expiryTimestamp, @addedBy, @remindersSent)
    ON CONFLICT(groupId) DO UPDATE SET
      groupName = excluded.groupName, ownerJid = excluded.ownerJid,
      startDate = excluded.startDate, expiryDate = excluded.expiryDate,
      expiryTimestamp = excluded.expiryTimestamp, addedBy = excluded.addedBy,
      remindersSent = excluded.remindersSent
  `).run({ ...entry, remindersSent: JSON.stringify(remindersSent) })
}

export function getSewa(groupId: string): SewaGrubEntry | null {
  const db  = getDB()
  const row = db.prepare('SELECT * FROM sewagrub WHERE groupId = ?').get(groupId) as Record<string, unknown> | undefined
  return row ? rowToEntry(row) : null
}

export function delSewa(groupId: string): boolean {
  const db  = getDB()
  const res = db.prepare('DELETE FROM sewagrub WHERE groupId = ?').run(groupId)
  return res.changes > 0
}

export function getAllSewa(): Record<string, SewaGrubEntry> {
  const db   = getDB()
  const rows = db.prepare('SELECT * FROM sewagrub').all() as Record<string, unknown>[]
  const out: Record<string, SewaGrubEntry> = {}
  for (const r of rows) out[r.groupId as string] = rowToEntry(r)
  return out
}

export function getExpiredSewa(): SewaGrubEntry[] {
  const db   = getDB()
  const now  = Date.now()
  const rows = db.prepare('SELECT * FROM sewagrub WHERE expiryTimestamp <= ?').all(now) as Record<string, unknown>[]
  return rows.map(rowToEntry)
}

export function getPendingReminders(): Array<{
  entry:         SewaGrubEntry
  reminderIndex: number
  label:         string
}> {
  const now    = Date.now()
  const db     = getDB()
  const rows   = db.prepare('SELECT * FROM sewagrub WHERE expiryTimestamp > ?').all(now) as Record<string, unknown>[]
  const result: Array<{ entry: SewaGrubEntry; reminderIndex: number; label: string }> = []

  for (const row of rows) {
    const entry = rowToEntry(row)
    const sisaMs = entry.expiryTimestamp - now
    if (sisaMs <= 0) continue

    const sent = entry.remindersSent ?? []

    for (const t of REMINDER_THRESHOLDS) {
      if (sent.includes(t.index)) continue

      const upper = t.ms + WINDOW_MS
      const lower = t.ms - WINDOW_MS

      if (sisaMs <= upper && sisaMs > lower) {
        result.push({ entry, reminderIndex: t.index, label: t.label })
        break
      }
    }
  }

  return result
}

export function markReminderSent(groupId: string, reminderIndex: number): void {
  const db  = getDB()
  const row = db.prepare('SELECT remindersSent FROM sewagrub WHERE groupId = ?').get(groupId) as { remindersSent: string } | undefined
  if (!row) return
  const sent: number[] = JSON.parse(row.remindersSent || '[]')
  if (!sent.includes(reminderIndex)) {
    sent.push(reminderIndex)
    db.prepare('UPDATE sewagrub SET remindersSent = ? WHERE groupId = ?').run(JSON.stringify(sent), groupId)
  }
}

export function resetReminders(groupId: string): void {
  const db  = getDB()
  const res = db.prepare('SELECT groupId FROM sewagrub WHERE groupId = ?').get(groupId)
  if (!res) return
  db.prepare('UPDATE sewagrub SET remindersSent = ? WHERE groupId = ?').run('[]', groupId)
}

export function reloadSewaCache(): void {
  // No-op: SQLite gak butuh reload cache, query selalu langsung dari DB.
}

const db0 = getDB()
console.log(chalk.green.bold(`✅ SewaGrub DB ready → ${(db0.prepare('SELECT COUNT(*) c FROM sewagrub').get() as { c: number }).c} grup`))
