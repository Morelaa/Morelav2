import { getDB } from './sqlite.js'
import type { BotStats } from '../types/global.js'

function ensureMeta(): void {
  const db  = getDB()
  const row = db.prepare("SELECT value FROM stats_meta WHERE key = 'startedAt'").get()
  if (!row) {
    db.prepare("INSERT INTO stats_meta (key, value) VALUES ('startedAt', ?)").run(String(Date.now()))
    db.prepare("INSERT OR IGNORE INTO stats_meta (key, value) VALUES ('total', '0')").run()
  }
}

export function initStats(): void {
  ensureMeta()
}

export function trackCommand(command: string, senderJid: string): void {
  ensureMeta()
  const db = getDB()

  const now  = new Date()
  const hour = now.getHours().toString()
  const day  = now.toLocaleDateString('id-ID', { weekday: 'long' })

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO stats_commands (command, count) VALUES (?, 1)
      ON CONFLICT(command) DO UPDATE SET count = count + 1
    `).run(command)

    db.prepare(`
      INSERT INTO stats_users (jid, count) VALUES (?, 1)
      ON CONFLICT(jid) DO UPDATE SET count = count + 1
    `).run(senderJid)

    db.prepare(`
      INSERT INTO stats_hours (hour, count) VALUES (?, 1)
      ON CONFLICT(hour) DO UPDATE SET count = count + 1
    `).run(hour)

    db.prepare(`
      INSERT INTO stats_days (day, count) VALUES (?, 1)
      ON CONFLICT(day) DO UPDATE SET count = count + 1
    `).run(day)

    db.prepare(`
      INSERT INTO stats_meta (key, value) VALUES ('total', '1')
      ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)
    `).run()
  })
  tx()
}

export function getStats(): BotStats {
  ensureMeta()
  const db = getDB()

  const commands: Record<string, number> = {}
  for (const r of db.prepare('SELECT command, count FROM stats_commands').all() as { command: string; count: number }[]) {
    commands[r.command] = r.count
  }
  const users: Record<string, number> = {}
  for (const r of db.prepare('SELECT jid, count FROM stats_users').all() as { jid: string; count: number }[]) {
    users[r.jid] = r.count
  }
  const hours: Record<string, number> = {}
  for (const r of db.prepare('SELECT hour, count FROM stats_hours').all() as { hour: string; count: number }[]) {
    hours[r.hour] = r.count
  }
  const days: Record<string, number> = {}
  for (const r of db.prepare('SELECT day, count FROM stats_days').all() as { day: string; count: number }[]) {
    days[r.day] = r.count
  }

  const totalRow     = db.prepare("SELECT value FROM stats_meta WHERE key = 'total'").get() as { value: string } | undefined
  const startedAtRow = db.prepare("SELECT value FROM stats_meta WHERE key = 'startedAt'").get() as { value: string } | undefined

  return {
    commands,
    users,
    hours,
    days,
    total:     totalRow ? parseInt(totalRow.value, 10) : 0,
    startedAt: startedAtRow ? parseInt(startedAtRow.value, 10) : Date.now(),
  }
}

export function resetStats(): void {
  const db = getDB()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM stats_commands').run()
    db.prepare('DELETE FROM stats_users').run()
    db.prepare('DELETE FROM stats_hours').run()
    db.prepare('DELETE FROM stats_days').run()
    db.prepare("INSERT INTO stats_meta (key, value) VALUES ('total', '0') ON CONFLICT(key) DO UPDATE SET value = '0'").run()
    db.prepare("INSERT INTO stats_meta (key, value) VALUES ('startedAt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(Date.now()))
  })
  tx()
}
