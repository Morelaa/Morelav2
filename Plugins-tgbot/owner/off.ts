import { sendMsg } from '../core/api.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['off'],
  category: 'owner',
  owner:    true,
  help:     '❌ /off — Self mode, hanya owner yang bisa pakai',

  handler: async (chatId) => {
    try {
      globalThis.__privateModeOn__ = true
      try {
        const { setPrivateMode } = await import('../../System/privatemode.js') as { setPrivateMode: (v: boolean) => void }
        setPrivateMode(true)
      } catch {}
      await sendMsg(chatId, '❌ *Bot WA self mode* — Hanya owner yang bisa pakai.')
    } catch (e) { await sendMsg(chatId, `❌ Gagal: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
