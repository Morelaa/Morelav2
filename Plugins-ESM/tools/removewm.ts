import axios from 'axios'
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { AIRich, Toolkit } from '../../Library/MessageBuilder.js'
import { buildFkontak, botName, OWNER_WA } from '../../Library/utils.js'

import FormData from 'form-data'

const NEOXR_KEY = global.apiKeys.neoxr

async function uploadImage(buffer: Buffer, morela: any): Promise<string> {
  try {
    const url = await Toolkit.toUrl(morela, buffer, 'image')
    if (url) return url
    throw new Error('CDN WA tidak mengembalikan URL')
  } catch {
    const form = new FormData()
    form.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' })
    const res = await axios.post('https://cdn.ornzora.eu.cc/upload', form, {
      headers: { ...form.getHeaders() },
      timeout: 30000, maxBodyLength: Infinity, maxContentLength: Infinity,
    })
    const data = res.data
    const url  = data?.url || data?.data?.url || data?.link || data?.data?.link ||
      (typeof data === 'string' && data.startsWith('https://') ? data.trim() : null)
    if (url) return url as string
    throw new Error('Upload gagal (CDN WA & Ornzora)')
  }
}

function unwrapMsg(msg: any) {
  let m = msg || {}
  for (let i = 0; i < 8; i++) {
    if (m?.ephemeralMessage?.message)            { m = m.ephemeralMessage.message;            continue }
    if (m?.viewOnceMessage?.message)             { m = m.viewOnceMessage.message;             continue }
    if (m?.viewOnceMessageV2?.message)           { m = m.viewOnceMessageV2.message;           continue }
    if (m?.viewOnceMessageV2Extension?.message)  { m = m.viewOnceMessageV2Extension.message;  continue }
    if (m?.documentWithCaptionMessage?.message)  { m = m.documentWithCaptionMessage.message;  continue }
    break
  }
  return m
}

function pickImageNode(m: Record<string, unknown>) {
  if (m.quoted?.mtype === 'imageMessage') return m.quoted

  if (m.quoted?.message) {
    const uq = unwrapMsg(m.quoted.message)
    if (uq?.imageMessage) return uq.imageMessage
  }

  if (m.message) {
    const ur = unwrapMsg(m.message)
    if (ur?.imageMessage) return ur.imageMessage
  }

  return null
}

const handler = async (m: any, { Morela, reply, usedPrefix, command, fkontak }: any) => {

  const imageNode = pickImageNode(m)
  if (!imageNode) {
    return reply(
      `╭──「 🧹 *Remove Watermark* 」\n` +
      `│\n` +
      `│  Kirim atau reply foto lalu ketik:\n` +
      `│  *${usedPrefix}${command}*\n` +
      `│\n` +
      `│  📌 *Catatan:*\n` +
      `│  • Maks ukuran gambar: 20 MB\n` +
      `│  • Proses ±15–30 detik\n` +
      `│\n` +
      `╰─────────────────────`
    )
  }

  if ((imageNode.fileLength || 0) > 20 * 1024 * 1024) {
    return reply('❌ Gambar terlalu besar, maksimal *20 MB*')
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  let buffer: Buffer
  try {
    const stream = await downloadContentFromMessage(imageNode, 'image')
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk)
    buffer = Buffer.concat(chunks)
    if (!buffer.length) throw new Error('Buffer kosong setelah download')
  } catch (e) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply(`❌ Gagal download gambar\n\n${(e as Error).message}`)
  }

  await Morela.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })

  try {
    const [imageUrl, ppUrl, fk] = await Promise.all([
      uploadImage(buffer, Morela),
      Morela.profilePictureUrl(Morela.user.id, 'image')
        .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg'),
      buildFkontak(Morela),
    ])

    const response = await axios.get('https://api.neoxr.eu/api/nowm', {
      params:  { image: imageUrl, apikey: NEOXR_KEY },
      timeout: 120000
    })

    if (!response.data?.status || !response.data?.data?.url) {
      throw new Error(response.data?.message || 'Gagal mendapatkan hasil dari API')
    }

    const resultUrl = response.data.data.url

    await new AIRich(Morela)
      .setTitle('Ai Assistant')
      .addProduct({
        title:       '',
        brand:       botName,
        price:       '🧹 Remove Watermark',
        sale_price:  '',
        product_url: OWNER_WA,
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })
      .addTip(' ')
      .addImage(resultUrl, { mimeType: 'image/jpeg' })
      .addSource([
        [
          'https://www.google.com/s2/favicons?domain=google.com&sz=16',
          'https://google.com',
          'Google',
        ],
        [
          'https://www.google.com/s2/favicons?domain=whatsapp.com&sz=16',
          OWNER_WA,
          botName,
        ],
      ])
      .send(m.chat, { quoted: fk })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[REMOVEWM]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply(`❌ Proses remove watermark gagal\n\n${e.message}`)
  }
}

handler.help     = ['removewm <reply foto>']
handler.tags     = ['tools', 'ai']
handler.command  = ['removewm', 'nowm', 'hapuswm']
handler.noLimit  = false
handler.owner    = false
handler.premium  = false
handler.group    = false
handler.private  = false
handler.admin    = false
handler.botAdmin = false

export default handler