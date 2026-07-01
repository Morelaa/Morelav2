import { sendMsg } from '../core/api.js'
import { formatUptime } from '../core/helpers.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['listbot'],
  category: 'owner',
  owner:    true,
  help:     '🤖 /listbot — List jadibot aktif',

  handler: async (chatId) => {
    const sessions = globalThis.jadibotSessions
    if (!sessions || sessions.size === 0) return void sendMsg(chatId, 'ℹ️ Tidak ada jadibot yang aktif.')
    let teks = `🤖 *JADIBOT AKTIF (${sessions.size})*\n\n`
    let no   = 1
    for (const [nomor, session] of sessions) {
      const uptime = formatUptime(Date.now() - (session.startedAt ?? 0))
      teks += `${no++}. *+${nomor}*\n    ⏱️ Uptime: ${uptime}\n`
    }
    teks += `\nStop: /stopbot \\<nomor\\>`
    await sendMsg(chatId, teks)
  }
} satisfies TgPlugin
