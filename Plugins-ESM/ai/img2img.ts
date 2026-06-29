import axios    from 'axios'
import crypto   from 'crypto'
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { botName } from '../../Library/utils.js'

const FGSI_KEY  = (global as any).apiKeys?.fgsi  || 'fgsiapi-20c1605c-6d'
const IMGBB_KEY = (global as any).apiKeys?.imgbb || ''
const FGSI_API  = 'https://fgsi.dpdns.org/api/ai/image/img2img'

async function uploadImgBB(buffer: Buffer): Promise<string> {
  const res = await axios.post(
    `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
    new URLSearchParams({ image: buffer.toString('base64') }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 }
  )
  const url = res.data?.data?.url
  if (!url) throw new Error('ImgBB upload gagal')
  return url
}

function extractResultUrl(result: any): string | null {
  if (!result) return null
  if (typeof result === 'string') return result

  return result.url       ||
         result.res_url   ||
         result.image_url ||
         result.output    ||
         result.imageUrl  ||
         null
}

async function getImageBuffer(m: any): Promise<Buffer | null> {
  const msg      = m.message
  const imageMsg =
    msg?.imageMessage ||
    msg?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
    msg?.viewOnceMessage?.message?.imageMessage ||
    null

  if (!imageMsg) return null

  const stream = await downloadContentFromMessage(imageMsg, 'image')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk)
  const buf = Buffer.concat(chunks)
  return buf.length ? buf : null
}

async function Img2Img(
  prompt: string,
  imageBuffer: Buffer
): Promise<{ status: boolean; result?: string; error?: string }> {

  const imageUrl = await uploadImgBB(imageBuffer)

  const startUrl = `${FGSI_API}?apikey=${FGSI_KEY}&prompt=${encodeURIComponent(prompt)}&url=${encodeURIComponent(imageUrl)}`
  const start    = await axios.get(startUrl, { timeout: 30000 })

  const pollUrl = start.data?.data?.pollUrl
  if (!pollUrl || typeof pollUrl !== 'string') {
    console.error('[IMG2IMG] start response:', JSON.stringify(start.data))
    return { status: false, error: start.data?.error || start.data?.message || 'Gagal mendapatkan pollUrl' }
  }

  for (let i = 0; i < 60; i++) {
    await new Promise<void>(r => setTimeout(r, 2000))

    const poll       = await axios.get(pollUrl, { timeout: 30000 })
    const taskStatus = String(poll.data?.data?.status || '').trim()

    console.log(`[IMG2IMG] poll #${i+1} status: ${taskStatus}`)

    if (taskStatus === 'Success') {

      console.log('[IMG2IMG] raw result:', JSON.stringify(poll.data?.data?.result))

      const resultUrl = extractResultUrl(poll.data?.data?.result)
      if (!resultUrl) return { status: false, error: 'URL hasil tidak ditemukan' }
      return { status: true, result: resultUrl }
    }

    if (taskStatus === 'Failed') {
      return { status: false, error: poll.data?.message || poll.data?.data?.message || 'Proses img2img gagal di server' }
    }
  }

  return { status: false, error: 'Timeout menunggu hasil' }
}

const handler = async (m: any, { Morela, text, reply, usedPrefix, command, fkontak }: any) => {
  if (!text) return reply(
    `╭──「 🖼️ *Image to Image AI* 」\n` +
    `│\n` +
    `│  Edit gambar dengan AI + prompt!\n` +
    `│\n` +
    `│  📌 *Cara Pakai:*\n` +
    `│  (kirim/reply gambar)\n` +
    `│  ${usedPrefix}${command} <deskripsi>\n` +
    `│\n` +
    `│  ✨ *Contoh:*\n` +
    `│  ${usedPrefix}${command} to anime style\n` +
    `│  ${usedPrefix}${command} make it night time\n` +
    `│  ${usedPrefix}${command} add snow effect\n` +
    `│  ${usedPrefix}${command} cartoon style\n` +
    `│  ${usedPrefix}${command} ghibli art style\n` +
    `│\n` +
    `╰─────────────────────`
  )

  const imgBuf = await getImageBuffer(m)
  if (!imgBuf) return reply(
    `❌ Kirim atau reply gambar dulu!\n\n_Contoh: (reply foto) ${usedPrefix}${command} to anime_`
  )

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
  await reply(`🖼️ Memproses gambar...\n📝 Prompt: *${text}*\n\n_Mohon tunggu, biasanya 10-30 detik_`)

  try {
    const res = await Img2Img(text, imgBuf)

    if (!res.status || !res.result) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`❌ Gagal: ${res.error || 'Unknown error'}`)
    }

    await Morela.sendMessage(m.chat, {
      image:   { url: res.result },
      caption: `🖼️ *Image to Image AI*\n\n📝 *Prompt:* ${text}\n\n꒰ © ${botName} ꒱`
    }, { quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e) {
    console.error('[IMG2IMG ERROR]', (e as Error).message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Error: ${(e as Error).message}`)
  }
}

handler.help    = ['img2img <prompt>', 'i2i <prompt>']
handler.tags    = ['ai']
handler.command = ['img2img', 'i2i', 'imageedit', 'imgedit']
handler.noLimit = false
handler.premium = false

export default handler
