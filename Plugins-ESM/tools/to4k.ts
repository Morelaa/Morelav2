import axios from 'axios'
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { botName, OWNER_WA, buildFkontak } from '../../Library/utils.js'
import { AIRich } from '../../Library/MessageBuilder.js'

const NEOXR_KEY = global.apiKeys.neoxr
const IMGBB_KEY = global.apiKeys.imgbb

async function uploadImage(buffer: Buffer): Promise<string> {
  const res = await axios.post(
    `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
    new URLSearchParams({ image: buffer.toString('base64') }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 }
  )
  const url = res.data?.data?.url
  if (!url) throw new Error('ImgBB upload gagal')
  return url
}

function unwrapMsg(msg: unknown): Record<string, unknown> {
  let m = (msg || {}) as Record<string, unknown>
  for (let i = 0; i < 10; i++) {
    if (m.ephemeralMessage)           { m = (m.ephemeralMessage as Record<string, unknown>).message as Record<string, unknown> || m; continue }
    if (m.viewOnceMessage)            { m = (m.viewOnceMessage as Record<string, unknown>).message as Record<string, unknown> || m; continue }
    if (m.viewOnceMessageV2)          { m = (m.viewOnceMessageV2 as Record<string, unknown>).message as Record<string, unknown> || m; continue }
    if (m.viewOnceMessageV2Extension) { m = (m.viewOnceMessageV2Extension as Record<string, unknown>).message as Record<string, unknown> || m; continue }
    if (m.documentWithCaptionMessage) { m = (m.documentWithCaptionMessage as Record<string, unknown>).message as Record<string, unknown> || m; continue }
    break
  }
  return m
}

function pickImageNode(m: Record<string, unknown>): Record<string, unknown> | null {
  const quoted = m.quoted as Record<string, unknown> | undefined
  if (quoted?.mtype === 'imageMessage') return quoted
  if (quoted?.message) {
    const uq = unwrapMsg(quoted.message)
    if (uq?.imageMessage) return uq.imageMessage as Record<string, unknown>
  }
  if (m.message) {
    const ur = unwrapMsg(m.message)
    if (ur?.imageMessage) return ur.imageMessage as Record<string, unknown>
  }
  return null
}

const handler = async (m: any, { Morela, reply, usedPrefix }: any) => {
  const imageNode = pickImageNode(m)

  if (!imageNode) return reply(
    `╭╌╌⬡「 🔮 *To 4K* 」\n` +
    `┃\n` +
    `┃ 📸 Kirim atau reply gambar\n` +
    `┃ dengan caption \`${usedPrefix}to4k\`\n` +
    `┃\n` +
    `┃ 📌 *Catatan:*\n` +
    `┃ ◦ Hasil  : *Ultra HD 4K*\n` +
    `┃ ◦ Proses : *±30–60 detik*\n` +
    `┃ ◦ AI     : *Neoxr ToReal*\n` +
    `┃\n` +
    `╰╌╌⬡\n\n© ${botName}`
  )

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  try {

    const stream = await downloadContentFromMessage(
      imageNode as Parameters<typeof downloadContentFromMessage>[0],
      'image'
    )
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)
    if (!buffer.length) throw new Error('Buffer kosong')

    const [imageUrl, ppUrl, fk] = await Promise.all([
      uploadImage(buffer),
      Morela.profilePictureUrl(Morela.user.id, 'image')
        .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg'),
      buildFkontak(Morela),
    ])

    await Morela.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })

    const res = await axios.get('https://api.neoxr.eu/api/toreal', {
      params:  { image: imageUrl, apikey: NEOXR_KEY },
      timeout: 120000
    })

    if (!res.data?.status) {
      throw new Error(res.data?.message || 'API Neoxr gagal')
    }

    const resultUrl = res.data.data?.url || res.data.data?.downloadUrl || res.data.data
    if (!resultUrl || typeof resultUrl !== 'string') throw new Error('URL hasil tidak ditemukan')

    const sizeBefore = (buffer.length / 1024).toFixed(1)

    await new AIRich(Morela)
      .setTitle(`🔮 To 4K Selesai | ${sizeBefore} KB`)
      .addProduct({
        title:       '',
        brand:       botName,
        price:       'Ultra HD 4K',
        sale_price:  '',
        product_url: OWNER_WA,
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })
      .addTip(' ')
      .addImage(resultUrl, { mimeType: 'image/jpeg' })
      .addSource([
        ['https://www.google.com/s2/favicons?domain=whatsapp.com&sz=16', OWNER_WA, botName],
        ['https://www.google.com/s2/favicons?domain=github.com&sz=16', 'https://github.com', 'GitHub Morela'],
      ])
      .send(m.chat, { quoted: fk })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[TO4K]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Proses 4K gagal\n\n${e.message}`)
  }
}

handler.command  = ['to4k', '4k', 'upscale4k']
handler.tags     = ['tools', 'ai']
handler.help     = ['to4k — reply foto → upscale Ultra HD 4K (Neoxr ToReal)']
handler.premium  = true
handler.noLimit  = true

export default handler
