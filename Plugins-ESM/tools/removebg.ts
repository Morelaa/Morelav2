import axios from 'axios'
import fs from 'fs'
import path from 'path'
import os from 'os'
import FormData from 'form-data'
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { botName, buildFkontak } from '../../Library/utils.js'
import { AIRich, Toolkit } from '../../Library/MessageBuilder.js'

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

async function removeBg(imgBuffer: unknown) {
  const tmpFile = path.join(os.tmpdir(), `removebg_${Date.now()}.jpg`)
  fs.writeFileSync(tmpFile, imgBuffer)

  try {
    const form = new FormData()
    form.append('image', fs.createReadStream(tmpFile), path.basename(tmpFile))
    form.append('format', 'png')
    form.append('model', 'v1')

    const res = await axios.post('https://api2.pixelcut.app/image/matte/v1', form, {
      headers: {
        'User-Agent':        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Accept':            'application/json, text/plain, */*',
        'sec-ch-ua':         '"Chromium";v="139", "Not;A=Brand";v="99"',
        'x-locale':          'en',
        'x-client-version':  'web:pixa.com:4a5b0af2',
        'sec-ch-ua-mobile':  '?1',
        'sec-ch-ua-platform':'"Android"',
        'origin':            'https://www.pixa.com',
        'sec-fetch-site':    'cross-site',
        'sec-fetch-mode':    'cors',
        'sec-fetch-dest':    'empty',
        'referer':           'https://www.pixa.com/',
        'accept-language':   'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
        ...form.getHeaders()
      },
      responseType: 'arraybuffer',
      timeout:      30000
    })

    const result = Buffer.from(res.data)
    if (!result.length) throw new Error('Buffer hasil kosong')
    return result
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  }
}

const handler = async (m: any, { Morela, reply, usedPrefix, command, downloadContentFromMessage, fkontak }: any) => {
  const msg = m.message
  const img =
    msg?.imageMessage ||
    msg?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

  if (!img) return reply(
    `╭──「 🖼️ *Remove Background* 」\n│\n│  Reply gambar untuk menghapus\n│  latar belakangnya secara otomatis.\n│\n│  📌 *Format:*\n│  Reply foto + ${usedPrefix}${command}\n│\n╰─────────────────────`
  )

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
  await reply('🔄 Sedang memproses Remove Background...\n_Harap tunggu sebentar_')

  let imgBuffer
  try {
    const stream = await downloadContentFromMessage(img, 'image')
    const chunks = []
    for await (const c of stream) chunks.push(c)
    imgBuffer = Buffer.concat(chunks)
    if (!imgBuffer.length) throw new Error('Buffer kosong')
    console.log('[REMOVEBG] Download gambar sukses, size:', imgBuffer.length, 'bytes')
  } catch (e) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply('❌ Gagal download gambar: ' + (e as Error).message)
  }

  let resultBuffer
  try {
    resultBuffer = await removeBg(imgBuffer)
  } catch (e) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply(`❌ Gagal proses gambar\n\n${(e as Error).message}`)
  }

  try {

    const resultUrl = await uploadImage(resultBuffer, Morela)
    const sizeBefore = (imgBuffer.length / 1024).toFixed(1)
    const sizeAfter  = (resultBuffer.length / 1024).toFixed(1)

    const fk    = await buildFkontak(Morela)
    const ppUrl = await Morela.profilePictureUrl(Morela.user.id, 'image')
      .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')

    await new AIRich(Morela)
      .setTitle(`🖼️ Remove Background Selesai | ${sizeBefore} KB → ${sizeAfter} KB`)
      .addProduct({
        title:       'Format: PNG',
        brand:       botName,
        price:       'Remove Background',
        sale_price:  '',
        product_url: 'https://wa.me/628999889149',
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })
      .addTip(' ')
      .addImage(resultUrl, { mimeType: 'image/png' })
      .addSource([
        ['https://www.google.com/s2/favicons?domain=whatsapp.com&sz=16', 'https://wa.me/628999889149', botName],
        ['https://www.google.com/s2/favicons?domain=pixa.com&sz=16', 'https://www.pixa.com', 'Pixelcut API'],
      ])
      .send(m.chat, { quoted: fk })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
  } catch (e: any) {
    console.error('[REMOVEBG]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply('❌ Gagal kirim hasil: ' + e.message)
  }
}

handler.help    = ['removebg <reply foto>']
handler.tags    = ['tools']
handler.command = ['removebg', 'pixa', 'nobg', 'nobackground']

export default handler