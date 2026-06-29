import axios   from 'axios'
import crypto  from 'crypto'
import fs      from 'fs'
import path    from 'path'
import ffmpeg  from 'fluent-ffmpeg'
import { botName, buildFkontak } from '../../Library/utils.js'

const NEOXR_KEY = global.apiKeys.neoxr

const TEMP_DIR = path.join(process.cwd(), 'media', 'temp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const toWebp = (buffer: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const stamp  = Date.now() + Math.random()
    const input  = path.join(TEMP_DIR, `sgen_in_${stamp}.jpg`)
    const output = path.join(TEMP_DIR, `sgen_out_${stamp}.webp`)
    fs.writeFileSync(input, buffer)
    ffmpeg(input)
      .on('error', (e: Error) => {
        try { fs.unlinkSync(input)  } catch {}
        try { fs.unlinkSync(output) } catch {}
        reject(e)
      })
      .on('end', () => {
        try { fs.unlinkSync(input) } catch {}
        const webp = fs.readFileSync(output)
        try { fs.unlinkSync(output) } catch {}
        resolve(webp)
      })
      .outputOptions([
        '-vcodec', 'libwebp',
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15',
        '-loop', '0',
        '-preset', 'default',
        '-an',
        '-vsync', '0',
      ])
      .save(output)
  })

const handler = async (m: any, { Morela, text, reply, usedPrefix, command }: any) => {
  if (!text) {
    return reply(
      `🎨 *STICKER GENERATOR AI*\n\n` +
      `> Generate stiker AI dari deskripsi teks!\n\n` +
      `╭──「 📌 Cara Pakai 」\n` +
      `│ ${usedPrefix}${command} <deskripsi>\n` +
      `╰─────────────────\n\n` +
      `*Contoh:*\n` +
      `> ${usedPrefix}${command} cat eat banana\n` +
      `> ${usedPrefix}${command} anime girl with sword\n` +
      `> ${usedPrefix}${command} cute dog playing ball`
    )
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
  await reply(`🎨 Generating stiker...\n📝 *${text}*`)

  try {
    const [fk] = await Promise.all([buildFkontak(Morela)])

    const res = await axios.get('https://api.neoxr.eu/api/sticker-gen', {
      params:  { q: text, apikey: NEOXR_KEY },
      timeout: 60000,
    })

    if (!res.data?.status) throw new Error(res.data?.message || 'API gagal')

    const images: string[] = res.data?.data?.image || []
    if (!images.length) throw new Error('Tidak ada gambar yang dihasilkan')

    const webpBuffers: Buffer[] = []
    for (const url of images) {
      const imgBuf = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 })
        .then(r => Buffer.from(r.data))
      const webp = await toWebp(imgBuf)
      webpBuffers.push(webp)
    }

    if (!webpBuffers.length) throw new Error('Semua gambar gagal dikonversi')

    const packName = text.length > 30 ? text.slice(0, 27) + '...' : text

    await Morela.sendMessage(m.chat, {
      stickerPack: {
        name:        packName,
        publisher:   botName,
        packId:      crypto.randomUUID(),
        description: `AI Sticker: ${packName}`,
        cover:       webpBuffers[0],
        stickers:    webpBuffers.map(buf => ({
          sticker:            buf,
          emojis:             ['🎨'],
          accessibilityLabel: packName,
        }))
      }
    }, { quoted: fk })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[STICKERGEN]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Gagal: ${e.message}`)
  }
}

handler.help    = ['stickergen <deskripsi>']
handler.tags    = ['sticker']
handler.command = ['stickergen', 'sgai', 'buatstiker', 'genstiker']
handler.limit   = true

export default handler
