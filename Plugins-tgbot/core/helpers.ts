// ─── Helper kecil yang dipakai lintas plugin ────────────────────────────────
import { getTgCfg } from './api.js'

// Dipakai untuk hitung uptime tgbot — di-set oleh Core/tgbot.ts saat startTgBot()
let _startTime = Date.now()
export function setStartTime(t: number) { _startTime = t }
export function getStartTime(): number { return _startTime }

export function isOwner(from: number | undefined): boolean {
  const { ownerId } = getTgCfg()
  if (!ownerId) return false
  return String(from) === ownerId
}

export function formatUptime(ms: number): string {
  const s   = Math.floor(ms / 1000)
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}j ${m}m ${sec}d`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// ── Pending photo (dipakai saat user reply/klik tombol HD dkk) ──────────────
const _pendingPhoto: Record<string, string> = {}

export function tgSetPendingPhoto(chatId: string | number, fileId: string) {
  _pendingPhoto[String(chatId)] = fileId
}

export function tgGetPendingPhoto(chatId: string | number): string | null {
  return _pendingPhoto[String(chatId)] || null
}

export function tgClearPendingPhoto(chatId: string | number) {
  delete _pendingPhoto[String(chatId)]
}
