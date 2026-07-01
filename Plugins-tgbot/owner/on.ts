import { sendMsg } from '../core/api.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['on'],
  category: 'owner',
  owner:    true,
  help:     '✅ /on — Aktifkan bot untuk semua orang',

  handler: async (chatId) => {
    try {
      globalThis.__privateModeOn__ = false
      try {
        const { setPrivateMode } = await import('../../System/privatemode.js') as { setPrivateMode: (v: boolean) => void }
        setPrivateMode(false)
      } catch {}
      await sendMsg(chatId, '✅ *Bot WA aktif* — Semua orang bisa pakai fitur bot.')
    } catch (e) { await sendMsg(chatId, `❌ Gagal: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
