import { sendMsg } from '../core/api.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['stopbot'],
  category: 'owner',
  owner:    true,
  help:     '🛑 /stopbot <nomor> — Stop jadibot',

  handler: async (chatId, args = '') => {
    const nomor = args.replace(/[^0-9]/g, '')
    if (!nomor) return void sendMsg(chatId, '❌ Format: /stopbot 628xxxxxxxxxx')
    const sessions = globalThis.jadibotSessions
    if (!sessions?.has(nomor)) return void sendMsg(chatId, `⚠️ Jadibot *+${nomor}* tidak ditemukan.\nCek: /listbot`)
    try {
      await sessions.get(nomor)!.stop()
      await sendMsg(chatId, `✅ Jadibot *+${nomor}* berhasil dihentikan.`)
    } catch {
      sessions.delete(nomor)
      await sendMsg(chatId, `✅ Jadibot *+${nomor}* dihentikan (force).`)
    }
  }
} satisfies TgPlugin
