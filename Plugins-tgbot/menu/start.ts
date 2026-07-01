// ─── /start ──────────────────────────────────────────────────────────────
// BUGFIX: sebelumnya /start selalu mengirim keyboard + info bot yang sama
// ke SEMUA orang, termasuk tombol-tombol khusus owner (Restart, Bot ON/OFF,
// Listbot, dst). Orang lain memang tidak bisa MENGEKSEKUSI tombol itu, tapi
// tetap bisa MELIHATnya — itu kebocoran informasi yang tidak perlu.
// Sekarang: owner dapat tampilan lengkap, user lain cuma dapat menu publik.

import fs   from 'fs'
import path from 'path'
import os   from 'os'
import { fileURLToPath } from 'url'
import { sendMsg, sendPhoto } from '../core/api.js'
import { formatUptime, formatBytes, getStartTime } from '../core/helpers.js'
import type { TgPlugin } from '../core/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url as string))
const PROJECT_ROOT = path.join(__dirname, '..', '..')

function buildInfoCaption(): string {
  const mem    = process.memoryUsage()
  const sock   = globalThis.__sock__ as Record<string, unknown> | undefined
  const waUp   = (sock?.['user'] as Record<string, unknown>)?.['id'] ? '✅ Online' : '❌ Offline'
  const uptime = formatUptime(Date.now() - getStartTime())
  return (
    `*╔══〔 🤖 MORELA BOT 〕══╗*\n` +
    `┃ WA Bot  : ${waUp}\n` +
    `┃ Uptime  : ${uptime}\n` +
    `┃ Node.js : ${process.version}\n` +
    `┃ RAM     : ${formatBytes(mem.heapUsed)}\n` +
    `*╚══════════════════╝*`
  )
}

const OWNER_KEYBOARD = {
  inline_keyboard: [
    [{ text: '📊 Status', callback_data: 'cb_status' }, { text: '🔄 Restart', callback_data: 'cb_restart' }],
    [{ text: '🧹 Clear Cache', callback_data: 'cb_cc' }, { text: '✅ Bot ON', callback_data: 'cb_on' }],
    [{ text: '❌ Bot OFF', callback_data: 'cb_off' }, { text: '🤖 Listbot', callback_data: 'cb_listbot' }],
    [{ text: '📋 Menu Lengkap', callback_data: 'cb_menu' }, { text: '❎ Tutup', callback_data: 'cb_close' }]
  ]
}

const PUBLIC_KEYBOARD = {
  inline_keyboard: [
    [{ text: '📋 Menu', callback_data: 'cb_menu' }, { text: '❎ Tutup', callback_data: 'cb_close' }]
  ]
}

export default {
  command:  ['start'],
  category: 'menu',
  owner:    false,
  hidden:   true, // command /start sendiri tidak perlu muncul sebagai baris menu

  handler: async (chatId, _args, ctx) => {
    const menuPath = path.join(PROJECT_ROOT, 'media', 'menu.jpg')
    const caption  = buildInfoCaption()
    const keyboard = ctx.isOwner ? OWNER_KEYBOARD : PUBLIC_KEYBOARD

    if (fs.existsSync(menuPath)) {
      await sendPhoto(chatId, menuPath, caption, keyboard)
    } else {
      await sendMsg(chatId, caption, { reply_markup: keyboard })
    }
  }
} satisfies TgPlugin
