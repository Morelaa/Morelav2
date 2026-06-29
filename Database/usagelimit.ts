import chalk from 'chalk'
import { getDB } from './sqlite.js'
import type { LimitResult } from '../types/global.js'

export const DEFAULT_LIMIT = 15
export const RESET_MS      = 24 * 60 * 60 * 1000

function cleanJid(jid: string): string {
  if (!jid) return ''
  return jid.replace(/@.*/, '').replace(/[^0-9]/g, '') + '@s.whatsapp.net'
}

function ensureConfigRow(): void {
  const db  = getDB()
  const row = db.prepare('SELECT id FROM limitconfig WHERE id = 1').get()
  if (!row) db.prepare('INSERT INTO limitconfig (id, dailyLimit) VALUES (1, ?)').run(DEFAULT_LIMIT)
}

export function getDailyLimit(): number {
  ensureConfigRow()
  const db  = getDB()
  const row = db.prepare('SELECT dailyLimit FROM limitconfig WHERE id = 1').get() as { dailyLimit: number } | undefined
  return row?.dailyLimit ?? DEFAULT_LIMIT
}

export function setDailyLimit(n: number): void {
  ensureConfigRow()
  const db = getDB()
  db.prepare('UPDATE limitconfig SET dailyLimit = ? WHERE id = 1').run(n)
  console.log(chalk.green(`[LIMIT] Daily limit diubah → ${n}x/hari`))
}

export function getUserDailyLimit(level: number = 0): number {
  const base = getDailyLimit()
  const tier = Math.floor((level ?? 0) / 15)
  return base + (tier * 5)
}

export function checkLimit(jid: string, maxLimit: number = getDailyLimit()): LimitResult {
  const db  = getDB()
  const key = cleanJid(jid)
  if (!key || key === '@s.whatsapp.net') return { allowed: true, count: 0, sisa: maxLimit }

  const entry = db.prepare('SELECT count, limitHitAt FROM usagelimit WHERE jid = ?').get(key) as { count: number; limitHitAt: number | null } | undefined
  if (!entry) return { allowed: true, count: 0, sisa: maxLimit }

  const now = Date.now()

  if (entry.limitHitAt) {
    const selisih = now - entry.limitHitAt
    if (selisih >= RESET_MS) {
      db.prepare('UPDATE usagelimit SET count = 0, limitHitAt = NULL WHERE jid = ?').run(key)
      return { allowed: true, count: 0, sisa: maxLimit }
    }
    return { allowed: false, resetAt: entry.limitHitAt + RESET_MS, limitHitAt: entry.limitHitAt }
  }

  if (entry.count >= maxLimit) {
    db.prepare('UPDATE usagelimit SET limitHitAt = ? WHERE jid = ?').run(now, key)
    return { allowed: false, resetAt: now + RESET_MS, limitHitAt: now }
  }

  return { allowed: true, count: entry.count ?? 0, sisa: maxLimit - (entry.count ?? 0) }
}

export function addUsage(jid: string, maxLimit: number = getDailyLimit()): void {
  const db  = getDB()
  const key = cleanJid(jid)
  if (!key || key === '@s.whatsapp.net') return

  const existing = db.prepare('SELECT count, limitHitAt FROM usagelimit WHERE jid = ?').get(key) as { count: number; limitHitAt: number | null } | undefined

  if (!existing) {
    db.prepare('INSERT INTO usagelimit (jid, count, limitHitAt) VALUES (?, 1, NULL)').run(key)
    if (1 >= maxLimit) {
      db.prepare('UPDATE usagelimit SET limitHitAt = ? WHERE jid = ?').run(Date.now(), key)
      console.log(chalk.yellow(`[LIMIT] ${key} kena limit hari ini (${maxLimit}x)`))
    }
    return
  }

  const newCount = (existing.count ?? 0) + 1
  if (newCount >= maxLimit && !existing.limitHitAt) {
    db.prepare('UPDATE usagelimit SET count = ?, limitHitAt = ? WHERE jid = ?').run(newCount, Date.now(), key)
    console.log(chalk.yellow(`[LIMIT] ${key} kena limit hari ini (${maxLimit}x)`))
  } else {
    db.prepare('UPDATE usagelimit SET count = ? WHERE jid = ?').run(newCount, key)
  }
}

export function getUsage(jid: string, maxLimit: number = getDailyLimit()): {
  count: number; limitHitAt: number | null; sisa: number
} {
  const db    = getDB()
  const key   = cleanJid(jid)
  const entry = db.prepare('SELECT count, limitHitAt FROM usagelimit WHERE jid = ?').get(key) as { count: number; limitHitAt: number | null } | undefined
  const count = entry?.count ?? 0
  return {
    count,
    limitHitAt: entry?.limitHitAt ?? null,
    sisa:       Math.max(0, maxLimit - count)
  }
}

export function resetLimit(jid: string): boolean {
  const db  = getDB()
  const key = cleanJid(jid)
  if (!key || key === '@s.whatsapp.net') return false
  db.prepare(`
    INSERT INTO usagelimit (jid, count, limitHitAt) VALUES (?, 0, NULL)
    ON CONFLICT(jid) DO UPDATE SET count = 0, limitHitAt = NULL
  `).run(key)
  return true
}

export function getAllUsage(): Record<string, { count: number; limitHitAt: number | null }> {
  const db   = getDB()
  const rows = db.prepare('SELECT jid, count, limitHitAt FROM usagelimit').all() as Array<{ jid: string; count: number; limitHitAt: number | null }>
  const out: Record<string, { count: number; limitHitAt: number | null }> = {}
  for (const r of rows) out[r.jid] = { count: r.count, limitHitAt: r.limitHitAt }
  return out
}

export function initLimitDB(): void {
  ensureConfigRow()
  console.log(chalk.green.bold(`✅ Usage Limit DB ready → limit saat ini: ${getDailyLimit()}x/hari`))
}

export function clearAllLimits(): void {
  const db = getDB()
  db.prepare('DELETE FROM usagelimit').run()
}

export function cancelPendingWrite(): void {
  console.log(chalk.cyan('[LIMIT] (SQLite) Tidak ada pending write — semua write sudah sync/commit langsung'))
}

export const DAILY_LIMIT = DEFAULT_LIMIT

export default {
  checkLimit, addUsage, resetLimit,
  getUsage, getAllUsage, initLimitDB,
  clearAllLimits, getUserDailyLimit,
  getDailyLimit, setDailyLimit,
  DAILY_LIMIT, DEFAULT_LIMIT, RESET_MS
}
