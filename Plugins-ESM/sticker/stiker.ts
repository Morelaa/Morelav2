import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { imageToWebp, videoToWebp, addExif } from '../../Library/sticker.js'
import { botName } from '../../Library/utils.js'

async function downloadMedia(mediaMsg: any, type: 'image' | 'video' | 'sticker'): Promise<Buffer> {
  const stream = await downloadContentFromMessage(mediaMsg, type)
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c)
  const buffer = Buffer.concat(chunks)
  if (!buffer?.length) throw new Error('Buffer kosong')
  return buffer
}

const handler = async (m: any, { Morela, text, usedPrefix, command, reply, fkontak }: any) => {
  const msg = m.message
  const quotedMtype = m.quoted?.mtype as string | undefined

  const isWmCmd = ['swm', 'stikerwm', 'setwm', 'wm'].includes(command)

  // ── Mode: .swm / .wm — re-watermark stiker yang di-reply ──────────────
  if (isWmCmd) {
    if (!m.quoted) return reply(
`╭──「 🖊️ *Stiker Watermark* 」
│
│  Reply sebuah stiker dengan perintah ini!
│
│  📌 *Cara pakai:*
│  • Reply stiker + *${usedPrefix}${command} NamaPack*
│  • Reply stiker + *${usedPrefix}${command} Pack|Author*
│
│  📝 *Contoh:*
│  • ${usedPrefix}${command} Kyzo
│  • ${usedPrefix}${command} Morela|Bot
│
╰─────────────────────`
    )

    if (quotedMtype !== 'stickerMessage') {
      return reply('❌ Yang di-reply harus *stiker*, bukan foto/video/teks!')
    }

    if (!text?.trim()) return reply(
`❌ *Packname kosong!*

Contoh:
  *${usedPrefix}${command} NamaPack*
  *${usedPrefix}${command} Pack|Author*`
    )

    let [packname, ...authorArr] = text.trim().split('|')
    const author = authorArr.join('|').trim() || botName
    packname      = packname?.trim() || botName

    await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

    let img: Buffer
    try {
      img = await downloadMedia(m.quoted, 'sticker')
    } catch (e) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply('❌ Gagal mengambil sticker: ' + (e as Error).message)
    }

    let webp: Buffer
    try {
      webp = await addExif(img, packname, author)
    } catch (e) {
      console.error('[STIKER WM EXIF]', e)
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply('❌ Terjadi kesalahan saat memberi watermark sticker')
    }

    await Morela.sendMessage(m.chat, { sticker: webp }, { quoted: fkontak || m })
    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
    return
  }

  // ── Mode: .s / .sticker / .stiker / .sv / dst — buat stiker dari media ─
  const imageMsg =
    msg?.imageMessage ||
    msg?.viewOnceMessage?.message?.imageMessage ||
    msg?.viewOnceMessageV2?.message?.imageMessage ||
    (quotedMtype === 'imageMessage' ? m.quoted : null)

  const videoMsg =
    msg?.videoMessage ||
    msg?.viewOnceMessage?.message?.videoMessage ||
    msg?.viewOnceMessageV2?.message?.videoMessage ||
    (quotedMtype === 'videoMessage' ? m.quoted : null)

  const stickerMsg =
    msg?.stickerMessage ||
    (quotedMtype === 'stickerMessage' ? m.quoted : null)

  if (!imageMsg && !videoMsg && !stickerMsg) return reply(
`╭──「 🎴 *Stiker* 」
│
│  Reply foto/video/stiker lalu ketik *${usedPrefix}${command}*
│  atau kirim foto/video + caption *${usedPrefix}${command}*
│
│  📌 *Ganti nama pack:*
│  • ${usedPrefix}${command} NamaPack
│  • ${usedPrefix}${command} Pack|Author
│
│  ⚠️ Video maks 6 detik jadi stiker
│
╰─────────────────────`
  )

  let [packname, ...authorArr] = (text || '').trim().split('|')
  const author = authorArr.join('|').trim() || botName
  packname       = packname?.trim() || botName

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  let buffer: Buffer
  let kind: 'image' | 'video' | 'sticker'

  try {
    if (videoMsg) {
      const seconds = videoMsg.seconds || 0
      if (seconds > 60) {
        await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        return reply('❌ Video terlalu panjang! Maksimal 60 detik (stiker akan dipotong 6 detik pertama).')
      }
      buffer = await downloadMedia(videoMsg, 'video')
      kind = 'video'
    } else if (imageMsg) {
      buffer = await downloadMedia(imageMsg, 'image')
      kind = 'image'
    } else {
      buffer = await downloadMedia(stickerMsg, 'sticker')
      kind = 'sticker'
    }
  } catch (e) {
    console.error('[STIKER DOWNLOAD]', e)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply('❌ Gagal mengambil media. File-nya bermasalah kayaknya.')
  }

  let webp: Buffer
  try {
    if (kind === 'sticker') {
      webp = await addExif(buffer, packname, author)
    } else if (kind === 'video') {
      webp = await videoToWebp(buffer)
      webp = await addExif(webp, packname, author)
    } else {
      webp = await imageToWebp(buffer)
      webp = await addExif(webp, packname, author)
    }
  } catch (e) {
    console.error('[STIKER CONVERT]', e)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply('❌ Gagal convert ke stiker. ffmpeg aja sampe nyerah liat input lu.')
  }

  await Morela.sendMessage(m.chat, { sticker: webp }, { quoted: fkontak || m })
  await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
}

handler.help    = ['s <Pack|Author>', 'swm <Pack|Author>']
handler.tags    = ['sticker']
handler.command = ['s', 'sticker', 'stiker', 'sv', 'stikervid', 'vsticker', 'vs', 'swm', 'stikerwm', 'setwm', 'wm']

export default handler
