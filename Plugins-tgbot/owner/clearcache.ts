import { sendMsg } from '../core/api.js'
import { formatBytes } from '../core/helpers.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['cc'],
  category: 'owner',
  owner:    true,
  help:     '🧹 /cc — Bersihkan cache',

  handler: async (chatId) => {
    await sendMsg(chatId, '🧹 *Membersihkan cache...*')
    try {
      const { clearAllCache } = await import('../../Plugins-ESM/owner/clearcache.js') as {
        clearAllCache: () => Promise<{ filesDeleted: number; bytesFreed: number; duration: number; results: string[] }>
      }
      const result = await clearAllCache()
      await sendMsg(chatId,
        `✅ *Cache berhasil dibersihkan!*\n\n` +
        `🗑️ File dihapus : ${result.filesDeleted}\n` +
        `💾 Space freed  : ${formatBytes(result.bytesFreed)}\n` +
        `⏱️ Durasi       : ${result.duration}ms\n\n` +
        `_Detail:_\n` +
        result.results.map(r => `• ${r}`).join('\n')
      )
    } catch (e) {
      await sendMsg(chatId, `❌ Gagal: ${(e as Error).message}`)
    }
  }
} satisfies TgPlugin
