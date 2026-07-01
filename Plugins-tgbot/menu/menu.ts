// ─── Menu Lengkap (/menu dan tombol "📋 Menu Lengkap") ─────────────────────
// BUGFIX: sebelumnya callback `cb_menu` mengirim SATU teks yang sama ke siapa
// saja, lengkap dengan daftar command khusus owner (/exec, /eval, /shell,
// /broadcast, dll). Sekarang teks dibangun dinamis dari plugin registry dan
// difilter sesuai apakah pemanggilnya owner atau bukan.

import { sendMsg } from '../core/api.js'
import { tgPlugins } from '../_pluginmanager.js'
import type { TgPlugin } from '../core/types.js'

export function buildMenuText(isOwner: boolean): string {
  const plugins = tgPlugins.listForMenu(isOwner)

  const imageLines = plugins.filter(p => p.category === 'image').map(p => p.help).filter(Boolean)
  const dlLines     = plugins.filter(p => p.category === 'downloader').map(p => p.help).filter(Boolean)
  const ownerLines  = plugins.filter(p => p.category === 'owner').map(p => p.help).filter(Boolean)

  let text =
    `🖼️ *Image:*\n` +
    `Kirim foto lalu klik tombol\n` +
    `Hd\nHdv1\nHdv2\nRemove Bg\nRemove Wm\n` +
    (imageLines.length ? imageLines.join('\n') + '\n\n' : '\n') +
    `🎵 *Downloader:*\n` +
    dlLines.join('\n')

  if (isOwner && ownerLines.length) {
    text += `\n\n🔒 *Khusus Owner:*\n` + ownerLines.join('\n')
  }

  return text
}

export default {
  command:  ['menu'],
  category: 'menu',
  owner:    false,
  hidden:   true,

  handler: async (chatId, _args, ctx) => {
    await sendMsg(chatId, buildMenuText(ctx.isOwner))
  }
} satisfies TgPlugin
