import { sendMsg } from '../core/api.js'
import { logger } from '../../System/logger.js'
import type { TgPlugin } from '../core/types.js'
export default {
  command:  ['restart'],
  category: 'owner',
  owner:    true,
  help:     '🔄 /restart — Restart bot WA',
  handler: async (chatId) => {
    await sendMsg(chatId, '🔄 *Merestart bot WA...*\n\n_Bot akan online lagi dalam beberapa detik._')
    logger.warn('tgbot', 'Restart diminta dari Telegram')
    setTimeout(() => { process.exitCode = 69; process.exit(); }, 1500)
  }
} satisfies TgPlugin
