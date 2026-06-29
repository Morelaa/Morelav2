import axios from 'axios'
import FormData from 'form-data'
import { fileTypeFromBuffer } from 'file-type'
import { AIRich } from '../../Library/MessageBuilder.js'
import { botName, OWNER_WA, buildFkontak } from '../../Library/utils.js'

async function uploadOrnzora(buffer: Buffer, fileName: string): Promise<string> {
  const ft   = await fileTypeFromBuffer(buffer)
  const ext  = ft?.ext || 'bin'
  const mime = ft?.mime || 'application/octet-stream'
  const form = new FormData()
  form.append('file', buffer, { filename: `${fileName}.${ext}`, contentType: mime })

  const res = await axios.post('https://cdn.ornzora.eu.cc/upload', form, {
    headers: {
      ...form.getHeaders(),
    },
    timeout:          60_000,
    maxBodyLength:    Infinity,
    maxContentLength: Infinity,
  })

  const data = res.data
  const url  =
    data?.url        ||
    data?.data?.url  ||
    data?.link       ||
    data?.data?.link ||
    (typeof data === 'string' && data.startsWith('https://') ? data.trim() : null)

  if (!url) throw new Error('Ornzora tidak mengembalikan URL')
  return url as string
}

async function fetchBuf(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

const handler = async (m: any, { Morela, text, reply, usedPrefix, command }: any) => {
  try {
    if (!text) return reply(`Contoh: ${usedPrefix}${command} kucing lucu`)

    await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

    const apiUrl = `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(text)}&type=image`
    const res    = await fetch(apiUrl)
    const json   = await res.json()

    if (!res.ok || !json.status || !json.data?.length) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply('❌ Gagal mengambil data atau hasil kosong dari Pinterest.')
    }

    await Morela.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })

    const images = (json.data as any[])
      .filter(item => item.image_url)
      .slice(0, 5)

    const cdnUrls: string[] = []

    const [, ppUrl, fk] = await Promise.all([
      Promise.allSettled(
        images.map(async (item, i) => {
          try {
            const buffer = await fetchBuf(item.image_url)
            const cdnUrl = await uploadOrnzora(buffer, `pin-${Date.now()}-${i}`)
            cdnUrls[i]   = cdnUrl
          } catch (e) {
            console.error(`[PIN] Upload gagal index ${i}:`, (e as Error).message)
          }
        })
      ),
      Morela.profilePictureUrl(Morela.user.id, 'image')
        .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg'),
      buildFkontak(Morela),
    ])

    const validUrls = cdnUrls.filter(Boolean)

    if (!validUrls.length) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply('❌ Semua gambar gagal diupload ke CDN. Coba lagi nanti.')
    }

    const builder = new AIRich(Morela)
      .setTitle('Ai Assistant')
      .addProduct({
        title:       '',
        brand:       botName,
        price:       '📌 Pinterest',
        sale_price:  '',
        product_url: OWNER_WA,
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })

    builder.addTip(' ')
    for (const url of validUrls) {
      builder.addImage(url, { mimeType: 'image/jpeg' })
    }

    builder.addSource([
      [
        'https://www.google.com/s2/favicons?domain=pinterest.com&sz=16',
        'https://pinterest.com',
        'Pinterest',
      ],
      [
        'https://www.google.com/s2/favicons?domain=whatsapp.com&sz=16',
        OWNER_WA,
        botName,
      ],
    ])

    await builder.send(m.chat, { quoted: fk })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e) {
    console.error('[PIN]', (e as Error).message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {})
    await reply('❌ Terjadi kesalahan saat memproses permintaan.')
  }
}

handler.command = ['pinterest', 'pin']
handler.tags    = ['search']
handler.help    = ['pinterest <query>', 'pin <query>']

export default handler