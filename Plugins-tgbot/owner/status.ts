import os from 'os'
import { sendMsg } from '../core/api.js'
import { formatUptime, formatBytes, getStartTime } from '../core/helpers.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['status'],
  category: 'owner',
  owner:    true,
  help:     '🔧 /status — Status bot',

  handler: async (chatId) => {
    const mem    = process.memoryUsage()
    const uptime = formatUptime(Date.now() - getStartTime())
    const sock   = globalThis.__sock__ as Record<string, unknown> | undefined
    const waUp   = (sock?.['user'] as Record<string, unknown>)?.['id'] ? '✅ Online' : '❌ Offline'
    const jadibotCount = globalThis.jadibotSessions?.size ?? 0
    const jadibots = jadibotCount > 0
      ? [...(globalThis.jadibotSessions?.keys() ?? [])].map(n => `+${n}`).join(', ')
      : 'Tidak ada'
    await sendMsg(chatId,
      `📊 *STATUS BOT MORELA*\n\n` +
      `🤖 WA Bot    : ${waUp}\n` +
      `⏱️ Uptime    : ${uptime}\n` +
      `🔢 Node.js   : ${process.version}\n\n` +
      `💾 *Memory:*\n` +
      `├ Heap Used : ${formatBytes(mem.heapUsed)}\n` +
      `├ RSS       : ${formatBytes(mem.rss)}\n` +
      `└ Free RAM  : ${formatBytes(os.freemem())} / ${formatBytes(os.totalmem())}\n\n` +
      `🤖 *Jadibot:*\n` +
      `├ Aktif     : ${jadibotCount}\n` +
      `└ Nomor     : ${jadibots}`
    )
  }
} satisfies TgPlugin
