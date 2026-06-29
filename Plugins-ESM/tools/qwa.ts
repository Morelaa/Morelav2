import axios from 'axios'
import { getPushName } from '../../Database/db.js'

const NEOXR_KEY = global.apiKeys.neoxr

const handler = async (m: any, { Morela, reply, usedPrefix, command, fkontak }: any) => {

  const quotedCtx = m.message?.extendedTextMessage?.contextInfo
  const quoted    = quotedCtx?.quotedMessage

  if (!quoted) {
    return reply(
      `💬 *WA BUBBLE CHAT*\n\n` +
      `> Balas pesan yang ingin dijadikan bubble!\n\n` +
      `*Contoh:*\n` +
      `> (reply pesan) ${usedPrefix}${command}`
    )
  }

  const messageText =
    quoted.conversation ||
    quoted.extendedTextMessage?.text ||
    quoted.imageMessage?.caption ||
    quoted.videoMessage?.caption ||
    ''

  if (!messageText.trim()) {
    return reply('❌ Pesan yang direply tidak memiliki teks.')
  }

  const senderJid    = quotedCtx.participant || quotedCtx.remoteJid || m.sender
  const senderNumber = senderJid.split('@')[0].split(':')[0]

  const isSelf = senderNumber === (m.sender || '').split('@')[0].split(':')[0]
  const senderName =
    (isSelf ? m.pushName : null) ||          
    getPushName(senderJid) ||
    getPushName(senderNumber + '@s.whatsapp.net') ||
    getPushName(senderNumber) ||
    m.pushName ||                             
    senderNumber

  const now  = new Date()
  const time = now.toLocaleTimeString('id-ID', {
    timeZone:  'Asia/Jakarta',
    hour:      '2-digit',
    minute:    '2-digit',
    hour12:    false
  }).replace(':', '.')

  let avatarUrl: string | null = null
  try {
    avatarUrl = await Morela.profilePictureUrl(senderJid, 'image')
  } catch {  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  try {
    const params: Record<string, string> = {
      name:    senderName,
      number:  `+${senderNumber}`,
      message: messageText,
      time,
      mode:    'dark',
      apikey:  NEOXR_KEY
    }
    if (avatarUrl) params.avatar = avatarUrl

    const res  = await axios.get('https://api.neoxr.eu/api/wqc', {
      params,
      timeout: 30000
    })

    if (!res.data?.status) {
      throw new Error(res.data?.message || 'Gagal generate bubble')
    }

    const imageUrl = res.data.data?.url
    if (!imageUrl) throw new Error('URL gambar tidak ditemukan')

    await Morela.sendMessage(m.chat, {
      image:    { url: imageUrl },
      caption:  `✅ *Bubble Chat*\n👤 @${senderNumber}`,
      mentions: [senderJid]
    }, { quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[WABUBBLE]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Gagal generate: ${e.message}`)
  }
}

handler.help    = ['qwa', 'bubble (reply pesan)']
handler.tags    = ['tools']
handler.command = ['qwa', 'bubble', 'wabubble']

export default handler
