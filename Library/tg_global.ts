import { logger } from '../System/logger.js'

// ── Telegram Global Config ──────────────────────────────────────
// Token & chatId diisi di config.ts → global.tgBot
// Semua fitur (rvo, tgspy, backup, remote) baca dari sini.

declare global {
  var rvoEnabled: boolean
}

// Inisialisasi rvoEnabled kalau belum ada
if (typeof global.rvoEnabled === 'undefined') global.rvoEnabled = false

// Priority: runtime override (global.tgGlobal) → config.ts (global.tgBot)
export function getTgToken(): string {
  return global.tgGlobal?.token || global.tgBot?.token || ''
}

export function getTgChatId(): string {
  return global.tgGlobal?.chatId || global.tgBot?.ownerId || ''
}

// Set token/chatId runtime (dari command .tgbot token / .tgbot id)
export function setTgToken(val: unknown): void {
  if (!global.tgGlobal) global.tgGlobal = { token: '', chatId: '' }
  global.tgGlobal.token = String(val || '')
  if (!global.tgBot) global.tgBot = { token: '', ownerId: '' }
  global.tgBot.token = String(val || '')
}

export function setTgChatId(val: unknown): void {
  if (!global.tgGlobal) global.tgGlobal = { token: '', chatId: '' }
  global.tgGlobal.chatId = String(val || '')
  if (!global.tgBot) global.tgBot = { token: '', ownerId: '' }
  global.tgBot.ownerId = String(val || '')
}

export function resetTgGlobal(): void {
  if (global.tgGlobal) { global.tgGlobal.token = ''; global.tgGlobal.chatId = '' }
  if (global.tgBot)    { global.tgBot.token = '';     global.tgBot.ownerId = '' }
  global.rvoEnabled = false
}

export function loadTgGlobal() {
  return { token: getTgToken(), chatId: getTgChatId() }
}

export function saveTgGlobal(data: { token: string; chatId: string }): void {
  setTgToken(data.token)
  setTgChatId(data.chatId)
}

export function initTgGlobal(): void {
  const token  = getTgToken()
  const chatId = getTgChatId()
  if (!token && !chatId) return
  if (!global.tgGlobal) global.tgGlobal = { token: '', chatId: '' }
  global.tgGlobal.token  = token
  global.tgGlobal.chatId = chatId
  logger.success('tg_global', 'Config loaded from config.ts')
}
