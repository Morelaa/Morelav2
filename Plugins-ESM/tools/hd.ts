import axios      from 'axios'
import FormData   from 'form-data'
import fs         from 'fs'
import path       from 'path'
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { botName, buildFkontak } from '../../Library/utils.js'
import { AIRich, Toolkit } from '../../Library/MessageBuilder.js'

const TMP_DIR = path.join(process.cwd(), 'media', 'temp')
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

// Upload ke CDN publik — dibutuhkan API superHD (harus URL publik)
async function uploadForApi(buffer: Buffer): Promise<string> {
  try {
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
    throw new Error('no url')
  } catch {
    const res = await axios.post(
      `https://api.imgbb.com/1/upload?key=${global.apiKeys.imgbb}`,
      new URLSearchParams({ image: buffer.toString('base64') }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 }
    )
    const url = res.data?.data?.url
    if (!url) throw new Error('Upload gagal (Ornzora & ImgBB)')
    return url
  }
}

// Upload hasil HD — utama CDN WA, fallback Ornzora
async function uploadResult(buffer: Buffer, morela: any): Promise<string> {
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
    throw new Error('Upload hasil gagal (CDN WA & Ornzora)')
  }
}

async function superHD(imageUrl: string): Promise<Buffer> {
  const res = await axios.get('https://api-faa.my.id/faa/superhd', {
    params:       { url: imageUrl },
    responseType: 'arraybuffer',
    timeout:      180000,   
    headers:      { 'User-Agent': 'Mozilla/5.0' },
    maxContentLength: 50 * 1024 * 1024,
  })
  const buf = Buffer.from(res.data)
  if (buf.length < 1000) throw new Error('Response tidak valid: ' + buf.toString().slice(0, 100))
  return buf
}

const handler = async (m: any, { Morela, reply }: any) => {
  const quoted = m.quoted || m
  const mime   = quoted.mimetype || quoted.message?.imageMessage?.mimetype || ''

  if (!mime.startsWith('image/')) return reply(
    `╭╌「 🖼️ *Super HD* 」\n` +
    `┃ Reply gambar dengan *.hd*\n` +
    `┃ Proses ±30-60 detik, harap sabar!\n` +
    `╰╌\n\n© ${botName}`
  )

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
  await reply('🔄 Sedang memproses Super HD...\n_Harap tunggu ±30-60 detik_')

  try {

    const imgMsg = quoted.message?.imageMessage || quoted
    const stream = await downloadContentFromMessage(imgMsg, 'image')
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk)
    const imgBuf = Buffer.concat(chunks)

    const imageUrl = await uploadForApi(imgBuf)
    console.log('[HD] Uploaded to:', imageUrl)

    const resultBuf = await superHD(imageUrl)
    const sizeBefore = (imgBuf.length / 1024).toFixed(1)
    const sizeAfter  = (resultBuf.length / 1024).toFixed(1)

    const hdUrl = await uploadResult(resultBuf, Morela)

    const fk    = await buildFkontak(Morela)
    const ppUrl = await Morela.profilePictureUrl(Morela.user.id, 'image')
      .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')

    await new AIRich(Morela)
      .setTitle(`🖼️ Super HD Selesai | ${sizeBefore} KB → ${sizeAfter} KB`)
      .addProduct({
        title:       '',
        brand:       botName,
        price:       'Super HD',
        sale_price:  '',
        product_url: 'https://wa.me/628999889149',
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })
      .addTip(' ')
      .addImage(hdUrl, { mimeType: 'image/jpeg' })
      .addSource([
        ['https://www.google.com/s2/favicons?domain=whatsapp.com&sz=16', 'https://wa.me/628999889149', botName],
        ['https://www.google.com/s2/favicons?domain=github.com&sz=16', 'https://github.com', 'GitHub Morela'],
      ])
      .send(m.chat, { quoted: fk })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[HD FAA]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply('❌ Gagal Super HD: ' + e.message)
  }
}

handler.command = ['hd', 'superhd']
handler.tags    = ['tools']
handler.help    = ['hd <reply gambar> — Super HD via api-faa']
handler.noLimit = false
handler.owner   = false

export default handler