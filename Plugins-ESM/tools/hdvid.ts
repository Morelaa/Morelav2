import axios      from 'axios'
import FormData   from 'form-data'
import fs         from 'fs'
import os         from 'os'
import path       from 'path'
import crypto     from 'crypto'
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { botName } from '../../Library/utils.js'

const API_URL          = 'https://fgsi.dpdns.org/api/tools/enchantVideo'
const DEFAULT_API_KEY  = 'fgsiapi-20c1605c-6d'
const PENDING_STATUSES = new Set(['pending', 'processing', 'queued', 'running'])

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

async function createEnhanceTask(filePath: string, apiKey = DEFAULT_API_KEY) {
  if (!fs.existsSync(filePath)) throw new Error('File tidak ditemukan')

  const form = new FormData()
  form.append('file', fs.createReadStream(filePath), path.basename(filePath))

  const response = await axios.post(API_URL, form, {
    headers: {
      ...form.getHeaders(),
      'Content-Type': 'multipart/form-data',
      apikey: apiKey,
    },
    maxBodyLength:    Infinity,
    maxContentLength: Infinity,
    timeout:          120000,
  })

  const payload = response.data
  if (!payload?.status || !payload?.data?.pollUrl) {
    throw new Error(payload?.message || 'Gagal membuat task HD video')
  }

  return {
    taskId:    payload.data.taskId,
    createdAt: payload.data.createdAt,
    pollUrl:   payload.data.pollUrl,
  }
}

async function pollEnhanceTask(
  pollUrl: string,
  {
    apiKey          = DEFAULT_API_KEY,
    pollIntervalMs  = 3000,
    timeoutMs       = 10 * 60 * 1000,
    maxTransientErr = 5,
  } = {}
) {
  const startedAt      = Date.now()
  let transientErrors  = 0
  let lastPayload: any = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await axios.get(pollUrl, {
        headers: { apikey: apiKey },
        timeout: 30000,
      })

      const payload          = response.data
      const status           = String(payload?.data?.status || '').trim()
      const normalizedStatus = status.toLowerCase()
      lastPayload     = payload
      transientErrors = 0

      if (normalizedStatus === 'success') {
        const result = payload?.data?.result
        if (!result?.res_url) throw new Error('HD video selesai tetapi URL hasil tidak ditemukan')
        return { taskId: payload?.data?.taskId, createdAt: payload?.data?.createdAt, ...result }
      }

      if (['failed', 'error', 'cancelled', 'canceled'].includes(normalizedStatus)) {
        const err: any = new Error(
          payload?.message || payload?.data?.message || `HD video gagal dengan status ${status}`
        )
        err.isTerminal = true
        throw err
      }

      if (!payload?.status && !PENDING_STATUSES.has(normalizedStatus)) {
        const err: any = new Error(payload?.message || 'Polling HD video gagal')
        err.isTerminal = true
        throw err
      }
    } catch (error: any) {
      if (error?.isTerminal) throw error
      transientErrors += 1
      if (transientErrors >= maxTransientErr) {
        throw new Error(error?.response?.data?.message || error?.message || 'Polling HD video gagal')
      }
    }

    await delay(pollIntervalMs)
  }

  throw new Error(lastPayload?.message || 'Timeout menunggu hasil HD video')
}

async function videoEnhancer(
  video: Buffer | string,
  {
    filename       = '',
    apiKey         = DEFAULT_API_KEY,
    pollIntervalMs = 3000,
    timeoutMs      = 10 * 60 * 1000,
  } = {}
) {
  if (!video) throw new Error('Video diperlukan')

  const safeName    = filename || `hdvid-${crypto.randomBytes(8).toString('hex')}.mp4`
  const filePath    = Buffer.isBuffer(video) ? path.join(os.tmpdir(), safeName) : video
  const shouldClean = Buffer.isBuffer(video)

  if (shouldClean) await fs.promises.writeFile(filePath, video)

  try {
    const task   = await createEnhanceTask(filePath, apiKey)
    const result = await pollEnhanceTask(task.pollUrl, { apiKey, pollIntervalMs, timeoutMs })
    return { taskId: task.taskId, pollUrl: task.pollUrl, createdAt: task.createdAt, ...result, resultUrl: result.res_url }
  } finally {
    if (shouldClean) { try { await fs.promises.unlink(filePath) } catch {} }
  }
}

const handler = async (m: any, { Morela, reply, fkontak }: any) => {
  const { AIRich } = await import('../../Library/MessageBuilder.js?v=' + Date.now())

  const ppUrl = await Morela.profilePictureUrl(
    Morela.user.id.replace(/:\d+@/, '@'), 'image'
  ).catch(() => 'https://i.ibb.co/zHV7Wy2C/f4eff2a0725d.jpg')

  const msg = m.message
  const vid =
    msg?.videoMessage ||
    msg?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage

  if (!vid) {
    return new AIRich(Morela)
      .setTitle('AI Assistant')
      .addProduct({
        title:       '',
        brand:       botName,
        price:       'HD Video Enhancer',
        sale_price:  '',
        product_url: 'https://wa.me/628999889149',
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })
      .addTip(' ')
      .addText(
        '## 🎬 HD Video Enhancer\n\n' +
        '> Enhance kualitas video menggunakan AI\n\n' +
        '**Cara pakai:**\n' +
        'Reply video + ketik *.hdvid*\n\n' +
        '**Format didukung:**\n' +
        'MP4 · WEBM · MOV · AVI · MKV\n\n' +
        '**Estimasi waktu:** 1–10 menit'
      )
      .setFooter(`© ${botName}`)
      .send(m.chat, { quoted: fkontak || m })
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  await new AIRich(Morela)
    .setTitle('AI Assistant')
    .addProduct({
      title:       '',
      brand:       botName,
      price:       'HD Video Enhancer',
      sale_price:  '',
      product_url: 'https://wa.me/628999889149',
      icon_url:    ppUrl,
      image_url:   ppUrl,
    })
    .addTip('⏳ Mengunduh video...')
    .addTip('Mohon tunggu, proses bisa beberapa menit')
    .setFooter(`© ${botName}`)
    .send(m.chat, { quoted: fkontak || m })

  let videoBuffer: Buffer
  let ext = 'mp4'
  try {
    const stream = await downloadContentFromMessage(vid, 'video')
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(c)
    videoBuffer = Buffer.concat(chunks)
    if (!videoBuffer.length) throw new Error('Buffer kosong')
    const extMatch = (vid.fileName || '').match(/\.(mp4|webm|mov|avi|mkv)$/i)
    if (extMatch) ext = extMatch[1].toLowerCase()
  } catch (e) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply('❌ Gagal download video: ' + (e as Error).message)
  }

  await new AIRich(Morela)
    .setTitle('AI Assistant')
    .addProduct({
      title:       '',
      brand:       botName,
      price:       'HD Video Enhancer',
      sale_price:  '',
      product_url: 'https://wa.me/628999889149',
      icon_url:    ppUrl,
      image_url:   ppUrl,
    })
    .addTip('✅ Video terunduh!')
    .addTip('⚙️ Mengirim ke server AI untuk enhance...')
    .addTip('Proses ini memakan waktu 1–10 menit')
    .setFooter(`© ${botName}`)
    .send(m.chat, { quoted: fkontak || m })

  try {
    const filename = `hdvid-${crypto.randomBytes(4).toString('hex')}.${ext}`
    const result   = await videoEnhancer(videoBuffer, { filename })

    await Morela.sendMessage(m.chat, {
      video:   { url: result.resultUrl },
      caption: `✅ *Video berhasil di-enhance!*\n\n© ${botName}`
    }, { quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e) {
    console.error('[HDVID ERROR]', (e as Error).message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply('❌ Gagal enhance video: ' + (e as Error).message)
  }
}

handler.help    = ['hdvid <reply video>']
handler.tags    = ['tools']
handler.command = ['hdvid', 'hdvideo', 'vhd']

export default handler
