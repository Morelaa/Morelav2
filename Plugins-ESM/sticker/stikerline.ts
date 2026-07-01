import axios  from 'axios'
import crypto from 'crypto'
import fs     from 'fs'
import path   from 'path'
import { sendStickerPack } from '../../Library/stickerPackHelper.js'
const NEOXR_KEY = global.apiKeys.neoxr
const TMP       = path.join(process.cwd(), 'media', 'temp')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

import ffmpegLib from 'fluent-ffmpeg'

function toWebpBuffer(inputBuf: Buffer, animated: boolean): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const id  = crypto.randomBytes(6).toString('hex')
    const ext = animated ? 'gif' : 'png'
    const inp = path.join(TMP, `line_${id}.${ext}`)
    const out = path.join(TMP, `line_${id}.webp`)
    const cleanup = () => {
      try { fs.unlinkSync(inp) } catch {}
      try { fs.unlinkSync(out) } catch {}
    }
    fs.writeFileSync(inp, inputBuf)
    ffmpegLib(inp)
      .outputOptions([
        '-vcodec', 'libwebp',
        '-vf', animated
          ? 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000'
          : 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba',
        '-loop', '0', '-an', '-vsync', '0',
        ...(animated ? ['-t', '8'] : ['-frames:v', '1']),
        '-quality', '80', '-compression_level', '4', '-preset', 'photo'
      ])
      .on('end', () => {
        try {
          const buf = fs.readFileSync(out)
          cleanup()
          resolve(buf)
        } catch (e) { cleanup(); reject(e) }
      })
      .on('error', (e) => { cleanup(); reject(e) })
      .save(out)
  })
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout:      30000,
    headers:      { 'User-Agent': 'Mozilla/5.0' }
  })
  return Buffer.from(res.data)
}

const handler = async (m: any, { Morela, args, reply, usedPrefix, command, fkontak }: any) => {
  const url = args[0]?.trim()

  if (!url || !url.includes('store.line.me')) {
    return reply(
      `🎨 *ʟɪɴᴇ sᴛɪᴄᴋᴇʀ ᴘᴀᴄᴋ*\n\n` +
      `> Download LINE sticker pack\n\n` +
      `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
      `┃ ${usedPrefix}${command} <url>\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `*ᴄᴀʀᴀ ᴅᴀᴘᴀᴛ ᴜʀʟ:*\n` +
      `> 1. Buka https://store.line.me\n` +
      `> 2. Pilih sticker pack\n` +
      `> 3. Copy URL dari browser\n\n` +
      `*ᴄᴏɴᴛᴏʜ:*\n` +
      `> ${usedPrefix}${command} https://store.line.me/stickershop/product/9801/en`
    )
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  try {
    const apiUrl = `https://api.neoxr.eu/api/linesticker?url=${encodeURIComponent(url)}&apikey=${NEOXR_KEY}`
    const res    = await axios.get(apiUrl, { timeout: 60000 })

    if (!res.data?.status || !res.data?.data) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`❌ Gagal mengambil sticker dari URL tersebut!`)
    }

    const data       = res.data.data
    const title      = data.title  || 'LINE Sticker'
    const author     = data.author || 'Unknown'
    const isAnimated = !!(data.animated)

    const stickerUrls: string[] = isAnimated && data.sticker_animation_url?.length
      ? data.sticker_animation_url
      : data.sticker_url || []

    if (!stickerUrls.length) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`❌ Tidak ada sticker ditemukan!`)
    }

    const total = Math.min(stickerUrls.length, 30)

    await reply(
      `🎨 *ʟɪɴᴇ sᴛɪᴄᴋᴇʀ ᴘᴀᴄᴋ*\n\n` +
      `╭┈┈⬡「 📦 *ɪɴꜰᴏ* 」\n` +
      `┃ 📝 *Title:* ${title}\n` +
      `┃ 👤 *Author:* ${author}\n` +
      `┃ 🎬 *Animated:* ${isAnimated ? 'Ya' : 'Tidak'}\n` +
      `┃ 📊 *Total:* ${total} stiker\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `> ⏳ Mengunduh & memproses...`
    )

    const stickerBuffers: Buffer[] = []

    for (let i = 0; i < total; i++) {
      try {
        const raw = await downloadBuffer(stickerUrls[i])

        // Selalu konversi ke WebP — stiker statis LINE berformat PNG/JPG
        // dan tidak akan valid sebagai stiker WA jika dikirim mentah-mentah.
        const buf = await toWebpBuffer(raw, isAnimated)
        stickerBuffers.push(buf)
      } catch (e) {
        console.error(`[LINE] stiker ${i + 1} gagal:`, (e as Error).message)
      }
    }

    if (!stickerBuffers.length) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`❌ Semua stiker gagal diunduh!`)
    }

    // ── Kirim sebagai stickerPackMessage ────────────────────────────
    await sendStickerPack(Morela, m.chat, stickerBuffers.map(buf => ({ buffer: buf, emojis: ['🌟'] })), { name: title, publisher: author, description: `LINE Sticker: ${title}`, quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (error) {
    console.error('[LineSticker] Error:', (error as Error).message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${(error as Error).message}`)
  }
}

handler.command = ['linesticker', 'linepack', 'line']
handler.help    = ['linesticker <url store.line.me>']
handler.tags    = ['sticker']
handler.premium = true
handler.noLimit = false

export default handler
