import axios  from 'axios'
import crypto from 'crypto'
import fs     from 'fs'
import { botName, imagePath } from '../../Library/utils.js'
import { sendStickerPack } from '../../Library/stickerPackHelper.js'
const MAX_STICKERS = 30   

class StickerAPI {
  async search(query: string, page = 1) {
    const res = await axios.post(
      'https://getstickerpack.com/api/v1/stickerdb/search',
      { query, page },
      { timeout: 10000 }
    )
    return (res.data.data || []).map((v: any) => ({
      name:     v.title,
      slug:     v.slug,
      download: v.download_counter
    }))
  }

  async detail(slug: string) {
    const res = await axios.get(
      `https://getstickerpack.com/api/v1/stickerdb/stickers/${slug}`,
      { timeout: 10000 }
    )
    const d = res.data.data
    return {
      title:    d.title,
      stickers: (d.images || []).map((v: any) => ({
        image:    `https://s3.getstickerpack.com/${v.url}`,
        animated: v.is_animated !== 0
      }))
    }
  }
}

const api = new StickerAPI()

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout:      15000,
    headers:      { 'User-Agent': 'Mozilla/5.0' }
  })
  return Buffer.from(res.data)
}

const handler = async (m: any, { Morela, text, usedPrefix, command, reply, fkontak }: any) => {

  if (command === 'stickerpack_pick') {
    const slug = text?.trim()
    if (!slug) return reply('❌ Slug tidak valid')

    await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

    try {
      const detail = await api.detail(slug)
      if (!detail.stickers.length) return reply('❌ Pack ini kosong')

      const packname = detail.title || botName
      const author   = botName

      const hasStatic = detail.stickers.some(s => !s.animated)
      const pool      = (hasStatic ? detail.stickers.filter(s => !s.animated) : detail.stickers)
                          .slice(0, MAX_STICKERS)

      await reply(
        `⏳ Mengunduh *${packname}*...\n` +
        `📦 ${pool.length} stiker\n` +
        `_Mohon tunggu sebentar_`
      )

      const stickerBuffers: Buffer[] = []
      for (const s of pool) {
        try {
          const buf = await downloadBuffer(s.image)
          stickerBuffers.push(buf)
        } catch {  }
        await new Promise(r => setTimeout(r, 200))
      }

      if (!stickerBuffers.length) {
        await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        return reply('❌ Gagal mengunduh stiker')
      }

      // ── Kirim sebagai stickerPackMessage ────────────────────────────
      await sendStickerPack(Morela, m.chat, stickerBuffers.map(buf => ({ buffer: buf, emojis: ['❤'] })), { name: packname, publisher: author, description: `Sticker pack: ${packname}`, quoted: fkontak || m })

      await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

    } catch (e: any) {
      console.error('[SP PICK ERROR]', e.message)
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`❌ Gagal: ${e.message}`)
    }
    return
  }

  if (!text) {
    return reply(
      `╭──「 🎴 *Sticker Pack* 」\n` +
      `│\n` +
      `│  Cari & kirim sticker pack!\n` +
      `│\n` +
      `│  📌 *Contoh:*\n` +
      `│  ${usedPrefix}${command} anime\n` +
      `│  ${usedPrefix}${command} blue archive\n` +
      `│  ${usedPrefix}${command} cat meme\n` +
      `│\n` +
      `│  ✨ Dikirim sebagai pack WA asli!\n` +
      `│\n` +
      `╰─────────────────────`
    )
  }

  await Morela.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })

  try {
    const packs = await api.search(text)

    if (!packs.length) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`❌ Sticker pack *"${text}"* tidak ditemukan`)
    }

    const rows = packs.slice(0, 10).map((p: any) => ({
      title:       p.name.length > 40 ? p.name.slice(0, 37) + '...' : p.name,
      description: `📥 ${Number(p.download).toLocaleString('id-ID')}x download`,
      id:          `.stickerpack_pick ${p.slug}`
    }))

    const menuBuf = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null
    const q       = text.charAt(0).toUpperCase() + text.slice(1)

    const footer =
      `╭──「 🎴 *Sticker Pack* 」\n` +
      `│\n` +
      `│  🔍 Query » *${q}*\n` +
      `│  📦 Ketemu » *${packs.length} pack*\n` +
      `│\n` +
      `│  ✨ Pilih → auto kirim sebagai pack!\n` +
      `│\n` +
      `╰─────────────────────\n` +
      `_Pilih pack di bawah ini_ 👇\n` +
      `© ${botName}`

    await Morela.sendMessage(m.chat, {
      ...(menuBuf ? { image: menuBuf, caption: ' ' } : { text: ' ' }),
      footer,
      interactiveButtons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title:    '🎴 Pilih Sticker Pack',
            sections: [{
              title: `Hasil: ${text.length > 22 ? text.slice(0, 20) + '..' : text}`,
              rows
            }]
          })
        }
      ],
      hasMediaAttachment: !!menuBuf
    }, { quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[STICKERPACK ERROR]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Error: ${e.message}`)
  }
}

handler.help    = ['stickerpack <query>', 'sp <query>']
handler.tags    = ['sticker']
handler.noLimit = false
handler.command = ['stickerpack', 'sp', 'stickersearch', 'searchsticker', 'stickerpack_pick']

export default handler
