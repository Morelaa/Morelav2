import axios  from 'axios'
import crypto from 'crypto'
import fs     from 'fs'
import path   from 'path'
import { spawn } from 'child_process'
import { botName } from '../../Library/utils.js'
import { sendStickerPack } from '../../Library/stickerPackHelper.js'

const MAX_STICKERS = 30
const FGSI_KEY     = 'fgsiapi-2baa6be5-6d'
const TMP          = path.join(process.cwd(), 'tmp_sticker')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout:      30000,
    headers:      { 'User-Agent': 'Mozilla/5.0' }
  })
  return Buffer.from(res.data)
}

function toWebpBuffer(inputBuf: Buffer, ext: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const id      = crypto.randomBytes(6).toString('hex')
    const inp     = path.join(TMP, `tele_${id}.${ext}`)
    const out     = path.join(TMP, `tele_${id}.webp`)
    const cleanup = () => {
      try { fs.unlinkSync(inp) } catch {}
      try { fs.unlinkSync(out) } catch {}
    }
    fs.writeFileSync(inp, inputBuf)
    const ff = spawn('ffmpeg', [
      '-i', inp,
      '-vcodec', 'libwebp',
      '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15',
      '-loop', '0', '-preset', 'default', '-an', '-vsync', '0',
      '-y', out
    ])
    const timer = setTimeout(() => { ff.kill(); cleanup(); reject(new Error('ffmpeg timeout')) }, 25000)
    ff.on('close', (code: number) => {
      clearTimeout(timer)
      if (code === 0) {
        try { resolve(fs.readFileSync(out)); cleanup() }
        catch (e) { cleanup(); reject(e) }
      } else { cleanup(); reject(new Error(`ffmpeg exit ${code}`)) }
    })
    ff.on('error', (e: Error) => { clearTimeout(timer); cleanup(); reject(e) })
  })
}

const handler = async (m: any, { Morela, args, reply, usedPrefix, command, fkontak }: any) => {
  const url = args[0]?.trim()

  if (!url) {
    return reply(
      `🎭 *ᴛᴇʟᴇɢʀᴀᴍ sᴛɪᴄᴋᴇʀ ᴘᴀᴄᴋ*\n\n` +
      `> Download sticker pack Telegram → kirim sebagai pack WA asli!\n\n` +
      `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
      `┃ ${usedPrefix}${command} <url>\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `*ᴄᴀʀᴀ ᴅᴀᴘᴀᴛ ᴜʀʟ:*\n` +
      `> 1. Buka pack di Telegram\n` +
      `> 2. Klik ••• → Share\n` +
      `> 3. Copy link t.me/addstickers/...\n\n` +
      `*ᴄᴏɴᴛᴏʜ:*\n` +
      `> ${usedPrefix}${command} https://t.me/addstickers/Sweetjehe3_by_fStikBot`
    )
  }

  const tgPackRegex = /(?:https?:\/\/)?t\.me\/(?:addstickers|addemoji)\/([a-zA-Z0-9_]+)/
  if (!url.match(tgPackRegex)) {
    return reply(
      `❌ URL tidak valid!\n\n` +
      `Gunakan link Telegram sticker pack.\n` +
      `Contoh: *https://t.me/addstickers/NamaPack*`
    )
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  try {
    // ── Ambil data pack via fgsi API ─────────────────────────────────
    const res = await axios.get('https://fgsi.dpdns.org/api/tools/stickertelegram', {
      params: {
        apikey: FGSI_KEY,
        url:    url
      },
      headers: { accept: 'application/json' },
      timeout: 60000
    })

    const json = res.data

    if (!json?.status || !json?.data) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(
        `❌ Gagal mengambil sticker pack!\n\n` +
        `_${json?.message || 'Pastikan link valid dan pack masih tersedia.'}_`
      )
    }

    const data        = json.data
    const title       = data.title       || data.name        || 'Telegram Sticker'
    const author      = data.author      || data.creator     || botName
    const stickerType = data.sticker_type || data.type       || 'regular'

    // Ambil array stiker — coba beberapa field yang mungkin
    const stickerList: any[] =
      Array.isArray(data.stickers) ? data.stickers :
      Array.isArray(data.data)     ? data.data     :
      Array.isArray(data.items)    ? data.items     : []

    if (!stickerList.length) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`❌ Tidak ada stiker ditemukan dalam pack ini!`)
    }

    const total = Math.min(stickerList.length, MAX_STICKERS)

    await reply(
      `🎭 *ᴛᴇʟᴇɢʀᴀᴍ sᴛɪᴄᴋᴇʀ ᴘᴀᴄᴋ*\n\n` +
      `╭┈┈⬡「 📦 *ɪɴꜰᴏ* 」\n` +
      `┃ 📝 *Title:* ${title}\n` +
      `┃ 👤 *Author:* ${author}\n` +
      `┃ 🎬 *Type:* ${stickerType}\n` +
      `┃ 📊 *Total:* ${total} stiker\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `> ⏳ Mengunduh & memproses...`
    )

    // ── Download semua stiker ─────────────────────────────────────────
    const stickerBuffers: Buffer[] = []
    const emojiList:      string[] = []

    for (let i = 0; i < total; i++) {
      const s   = stickerList[i]
      // fgsi pakai field dataUrl, ext, isAnimated, isVideo per stiker
      const src        = s.dataUrl || s.url || s.file_url || s.file || ''
      if (!src) continue
      const stickerExt = (s.ext || '').replace('.', '') || (src.includes('.tgs') ? 'tgs' : 'webm')
      const needConv   = s.isAnimated || s.isVideo || stickerExt === 'webm' || stickerExt === 'tgs'
      try {
        const raw = await downloadBuffer(src)
        const buf = needConv
          ? await toWebpBuffer(raw, stickerExt)
          : raw
        stickerBuffers.push(buf)
        const emojiArr = Array.isArray(s.emojis) ? s.emojis.join('') : (s.emoji || s.emoticon || '⭐')
        emojiList.push(emojiArr || '⭐')
      } catch (e) {
        console.error(`[TELESTIKER] stiker ${i + 1} gagal:`, (e as Error).message)
      }
      await new Promise(r => setTimeout(r, 150))
    }

    if (!stickerBuffers.length) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`❌ Semua stiker gagal diunduh!`)
    }

    // ── Kirim sebagai stickerPackMessage ────────────────────────────
    await sendStickerPack(Morela, m.chat, stickerBuffers.map((buf, i) => ({
      buffer: buf,
      emojis: [emojiList[i] || '⭐']
    })), { name: title, publisher: author, description: `Telegram Sticker: ${title}`, quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (error) {
    console.error('[TELESTIKER] Error:', (error as Error).message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${(error as Error).message}`)
  }
}

handler.command = ['stikertele', 'telesticker', 'tgsticker', 'tgpack']
handler.help    = ['stikertele <url t.me/addstickers/...>']
handler.tags    = ['sticker']
handler.premium = false
handler.noLimit = false

export default handler