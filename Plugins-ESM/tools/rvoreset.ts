import { resetTgGlobal } from '../../Library/tg_global.js'

const handler = async (m: any, { reply, args }: any) => {
  const sub = args[0]?.toLowerCase()

  if (sub === 'all') {
    resetTgGlobal()
    return reply('✅ Semua config Telegram direset!\nStatus RVO: OFF\n\n⚠️ Berlaku untuk tgspy, backup, remote juga.')
  }

  return reply('❌ Format:\n.rvoreset all')
}

handler.command = ['rvoreset']
handler.owner   = true
handler.noLimit = true
handler.tags    = ['owner']
handler.help    = ['rvoreset all']

export default handler
