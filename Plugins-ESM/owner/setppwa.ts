import { downloadContentFromMessage as _dlContent } from '@itsliaaa/baileys'
import { botName } from '../../Library/utils.js'

async function downloadImage(imgMsg: unknown, downloadContentFromMessage: unknown) {
  const fn = downloadContentFromMessage || _dlContent
  const stream = await fn(imgMsg, 'image')
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const buf = Buffer.concat(chunks)
  if (!buf.length) throw new Error('Buffer gambar kosong')
  return buf
}

const handler = async (m: any, { Morela, reply, usedPrefix, command, downloadContentFromMessage, fkontak }: any) => {

  const msg       = m.message
  const directImg = msg?.imageMessage
  const quotedImg = msg?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
  const imgMsg    = directImg || quotedImg

  if (!imgMsg) {
    return reply(
      `╭──「 🖼️ *Set PP WhatsApp Bot* 」\n` +
      `│\n` +
      `│  Kirim/reply gambar dengan perintah\n` +
      `│  ini untuk mengganti foto profil WA bot.\n` +
      `│\n` +
      `│  📌 *Format:*\n` +
      `│  • Kirim foto + caption \`${usedPrefix}${command}\`\n` +
      `│  • Reply foto + \`${usedPrefix}${command}\`\n` +
      `│\n` +
      `│  ✅ Support: JPG, PNG, semua rasio\n` +
      `│\n` +
      `╰─────────────────────`
    )
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  let imgBuffer
  try {
    imgBuffer = await downloadImage(imgMsg, downloadContentFromMessage)
  } catch (e) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply(`❌ Gagal download gambar\n\n_${(e as Error).message}_`)
  }

  try {
    const botJid = Morela.user?.id || Morela.user?.jid
    if (!botJid) throw new Error('Tidak bisa mendapatkan JID bot')

    await Morela.updateProfilePicture(botJid, imgBuffer)

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

    await Morela.sendMessage(m.chat, {
      text:
        `✅ *Profile picture WA bot berhasil diperbarui!*\n\n` +
        `🖼️ Foto profil WA sudah diganti.\n` +
        `🤖 Bot: *${botName}*\n\n` +
        `꒰ © ${botName} ꒱`,
      contextInfo: { forwardingScore: 1, isForwarded: false }
    }, { quoted: fkontak || m })

  } catch (e) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    const errMsg    = (e as Error).message || String(e)
    const isPermErr = /not-authorized|forbidden|not authorized/i.test(errMsg)
    return reply(
      `❌ *Gagal mengganti profile picture WA*\n\n` +
      (isPermErr
        ? `⚠️ Bot tidak punya izin.\n\nPastikan:\n• Bot terhubung sebagai nomor utama\n• Nomor bot memiliki akses penuh`
        : `Error: _${errMsg}_`)
    )
  }
}

handler.help        = ['setppwa <reply/kirim foto>']
handler.tags        = ['owner']
handler.command     = ['setppwa']
handler.owner       = true
handler.noLimit     = true
handler.description = 'Ganti profile picture nomor WA bot'

export default handler
