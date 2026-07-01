import { sendMsg } from '../core/api.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['broadcast'],
  category: 'owner',
  owner:    true,
  help:     '📢 /broadcast <pesan> — Broadcast ke semua grup',

  handler: async (chatId, args = '') => {
    if (!args) return void sendMsg(chatId, '❌ Format: /broadcast <pesan>')
    const sock = globalThis.__sock__ as Record<string, unknown> | null
    if (!sock) return void sendMsg(chatId, '❌ WA Bot tidak terhubung')
    await sendMsg(chatId, `⏳ Mengirim broadcast ke semua grup...`)
    try {
      const fetchAll = sock['groupFetchAllParticipating'] as () => Promise<Record<string, unknown>>
      const sendWA   = sock['sendMessage'] as (jid: string, content: unknown) => Promise<unknown>
      const chats    = await fetchAll()
      const jids     = Object.keys(chats)
      let sukses     = 0
      for (const jid of jids) {
        try { await sendWA(jid, { text: args }); sukses++ } catch {}
        await new Promise<void>(r => setTimeout(r, 500))
      }
      await sendMsg(chatId, `✅ *Broadcast selesai!*\n\n📤 Terkirim : ${sukses}/${jids.length} grup`)
    } catch (e) { await sendMsg(chatId, `❌ Gagal broadcast: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
