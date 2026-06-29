import { botName } from '../../Library/utils.js'
import { safeDeleteParticipant } from '../../Library/resolve.js'

const handler = async (m: any, { Morela, reply, fkontak }: any) => {
  if (!m.quoted) return reply(
    `╭╌「 🗑️ *Delete Pesan* 」\n` +
    `┃ Reply pesan yang mau dihapus dengan *.d*\n` +
    `╰╌\n\n© ${botName}`
  )

  try {
    const senderRaw = m.quoted.key?.participant || m.quoted.sender || m.quoted.key?.remoteJid
    // Resolve @lid -> nomor HP dulu, kalau tidak delete bisa silent-fail
    // saat target adalah peserta yang terdaftar dengan @lid.
    const participant = safeDeleteParticipant(senderRaw)

    await Morela.sendMessage(m.chat, {
      delete: {
        remoteJid:   m.chat,
        fromMe:      m.quoted.fromMe || false,
        id:          m.quoted.id,
        participant
      }
    })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e) {
    console.error('[DELETE]', (e as Error).message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply('❌ Gagal hapus: ' + (e as Error).message)
  }
}

handler.command = ['d', 'del', 'delete', 'hapus']
handler.owner   = true
handler.tags    = ['owner']
handler.help    = ['d — reply pesan untuk dihapus']
handler.noLimit = true

export default handler
