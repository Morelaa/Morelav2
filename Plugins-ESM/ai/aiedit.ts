import axios from 'axios'
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { AIRich } from '../../Library/MessageBuilder.js'
import { botName, OWNER_WA, buildFkontak } from '../../Library/utils.js'
const NEOXR_KEY = global.apiKeys.neoxr
const IMGBB_KEY = global.apiKeys.imgbb

async function uploadToImgBB(buffer: Buffer): Promise<string> {
  const res = await axios.post(
    `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
    new URLSearchParams({ image: buffer.toString('base64') }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 }
  )
  const url = res.data?.data?.url
  if (!url) throw new Error('ImgBB upload gagal')
  return url
}

async function getImageBuffer(m: any): Promise<Buffer | null> {
  const msg = m.message
  const imageMsg =
    msg?.imageMessage ||
    msg?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
    msg?.viewOnceMessage?.message?.imageMessage ||
    null

  if (!imageMsg) return null
  const stream = await downloadContentFromMessage(imageMsg, 'image')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

const handler = async (m: any, { Morela, text, reply, usedPrefix, command }: any) => {
  if (!text) {
    return reply(
      `🎨 *AI IMAGE EDIT*\n\n` +
      `> Edit gambar pakai AI dengan prompt teks!\n\n` +
      `╭──「 📌 Cara Pakai 」\n` +
      `│ (kirim/reply gambar)\n` +
      `│ ${usedPrefix}${command} <prompt>\n` +
      `╰─────────────────\n\n` +
      `*Contoh:*\n` +
      `> ${usedPrefix}${command} to anime\n` +
      `> ${usedPrefix}${command} make it look like night\n` +
      `> ${usedPrefix}${command} add snow effect\n` +
      `> ${usedPrefix}${command} cartoon style`
    )
  }

  const imgBuf = await getImageBuffer(m)
  if (!imgBuf) {
    return reply(`❌ Kirim atau reply gambar dulu!\n\n_Contoh: (reply foto) ${usedPrefix}${command} to anime_`)
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
  await reply(`🎨 Mengedit gambar...\n📝 Prompt: *${text}*`)
  try {
    const [imageUrl, ppUrl, fk] = await Promise.all([
      uploadToImgBB(imgBuf),
      Morela.profilePictureUrl(Morela.user.id, 'image')
        .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg'),
      buildFkontak(Morela),
    ])

    const res = await axios.get('https://api.neoxr.eu/api/qwen-edit', {
      params:  { image: imageUrl, prompt: text, apikey: NEOXR_KEY },
      timeout: 120000
    })

    if (!res.data?.status) {
      throw new Error(res.data?.message || 'API gagal')
    }

    const resultUrl = res.data.data?.url || res.data.data?.downloadUrl
    if (!resultUrl) throw new Error('URL hasil tidak ditemukan')

    await new AIRich(Morela)
      .setTitle('Ai Assistant')
      .addProduct({
        title:       '',
        brand:       botName,
        price:       '🎨 AI Image Edit',
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
    console.error('[AIEDIT]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Gagal: ${e.message}`)
  }
}

handler.help    = ['aiedit <prompt> (reply gambar)']
handler.tags    = ['ai']
handler.command = ['aiedit', 'editfoto', 'qwenedit', 'imageedit']
handler.limit   = true
export default handler
