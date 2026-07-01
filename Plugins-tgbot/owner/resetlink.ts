import { sendMsg } from '../core/api.js'
import { getAllGroups } from '../../Database/db.js'
import type { TgPlugin } from '../core/types.js'

async function resetlinkAll(chatId: number | string): Promise<void> {
  const sock = globalThis.__sock__ as Record<string, unknown> | null
  if (!sock) return void sendMsg(chatId, '❌ WA Bot tidak terhubung')
  await sendMsg(chatId, '⏳ Reset link semua grup (bot admin)...')
  try {
    const groupsData = getAllGroups() as Record<string, { participants?: Array<{ id: string; admin?: string }> }>
    const botNum     = ((sock['user'] as Record<string, string>)?.['id']?.split(':')[0] || '').replace(/[^0-9]/g, '')
    let berhasil = 0, gagal = 0, dilewati = 0
    const revokeInvite = sock['groupRevokeInvite'] as (jid: string) => Promise<unknown>
    const sendWA       = sock['sendMessage'] as (jid: string, content: unknown) => Promise<unknown>
    for (const [jid, meta] of Object.entries(groupsData)) {
      const botP    = meta.participants?.find(p => p.id?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') === botNum)
      const isAdmin = botP?.admin === 'admin' || botP?.admin === 'superadmin'
      if (!isAdmin) { dilewati++; continue }
      try {
        await revokeInvite(jid)
        try { await sendWA(jid, { text: `🔄 *Link grup telah direset!*\n\n_Direset via Telegram Remote_` }) } catch {}
        berhasil++
        await new Promise<void>(r => setTimeout(() => r(), 1000))
      } catch { gagal++ }
    }
    await sendMsg(chatId, `✅ *Reset Link Selesai!*\n\n✅ Berhasil : ${berhasil} grup\n❌ Gagal    : ${gagal} grup\n⏭️ Dilewati : ${dilewati} grup`)
  } catch (e) { await sendMsg(chatId, `❌ Gagal: ${(e as Error).message}`) }
}

export default {
  command:  ['resetlink'],
  category: 'owner',
  owner:    true,
  help:     '🔗 /resetlink /resetlink all — Reset link grup',

  handler: async (chatId, args = '') => {
    if (args.trim().toLowerCase() === 'all') return void (await resetlinkAll(chatId))

    const sock = globalThis.__sock__ as Record<string, unknown> | null
    if (!sock) return void sendMsg(chatId, '❌ WA Bot tidak terhubung')
    try {
      const groupsData = getAllGroups() as Record<string, { name?: string; subject?: string; participants?: Array<{ id: string; admin?: string }> }>
      const botNum     = ((sock['user'] as Record<string, string>)?.['id']?.split(':')[0] || '').replace(/[^0-9]/g, '')
      const adminGroups: Array<{ jid: string; name: string }> = []
      for (const [jid, meta] of Object.entries(groupsData)) {
        const botP = meta.participants?.find(p => p.id?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') === botNum)
        if (botP?.admin === 'admin' || botP?.admin === 'superadmin') adminGroups.push({ jid, name: meta.name || jid })
      }
      if (!adminGroups.length) return void sendMsg(chatId, `⚠️ *Bot bukan admin di grup manapun!*`)
      const target = args?.trim()
      if (target) {
        const idx   = parseInt(target) - 1
        const group = (!isNaN(idx) && idx >= 0 && idx < adminGroups.length) ? adminGroups[idx] : adminGroups.find(g => g.name.toLowerCase().includes(target.toLowerCase()))
        if (!group) return void sendMsg(chatId, `❌ Grup tidak ditemukan: *${target}*`)
        const revokeInvite = sock['groupRevokeInvite'] as (jid: string) => Promise<unknown>
        const sendWA       = sock['sendMessage'] as (jid: string, content: unknown) => Promise<unknown>
        await revokeInvite(group.jid)
        try { await sendWA(group.jid, { text: `🔄 *Link grup telah direset!*\n\n_Direset via Telegram Remote_` }) } catch {}
        return void sendMsg(chatId, `✅ *Link berhasil direset!*\n\n📌 Grup : *${group.name}*`)
      }
      let list = `🔑 *GRUP YANG BOT JADI ADMIN (${adminGroups.length})*\n\n`
      adminGroups.forEach((g, i) => { list += `${i + 1}. *${g.name}*\n` })
      list += `\n*Cara reset:*\n/resetlink <nomor>\n/resetlink all — reset SEMUA`
      return void sendMsg(chatId, list)
    } catch (e) { await sendMsg(chatId, `❌ Gagal: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
