import axios    from 'axios'
import FormData from 'form-data'
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { AIRich, Toolkit } from '../../Library/MessageBuilder.js'
import { botName, buildFkontak } from '../../Library/utils.js'

const TERMAI_API_KEY     = global.apiKeys.termai
const TERMAI_API_URL     = 'https://c.termai.cc/api/upload'
const IMGLARGER_BASE_URL = 'https://get1.imglarger.com/api/UpscalerNew'
const IMGLARGER_HEADERS  = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36',
  'Origin':     'https://imgupscaler.com',
  'Referer':    'https://imgupscaler.com/',
}

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

async function uploadToTermai(buffer: Buffer, mimeType: unknown, fileName: unknown) {
  const form = new FormData()
  form.append('file', buffer, { filename: fileName, contentType: mimeType })
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 45000)
  const res = await axios.post(`${TERMAI_API_URL}?key=${TERMAI_API_KEY}`, form, {
    headers: form.getHeaders(),
    signal:  controller.signal,
  })
  clearTimeout(t)
  if (res.data.status && res.data.path) return res.data.path
  throw new Error('Invalid Termai response')
}

async function upscaleWithImglarger(buffer: Buffer) {
  const form = new FormData()
  form.append('myfile', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' })
  form.append('scaleRadio', '4')
  const upload = await axios.post(`${IMGLARGER_BASE_URL}/UploadNew`, form, {
    headers: { ...IMGLARGER_HEADERS, ...form.getHeaders() },
    timeout: 30000,
  })
  if (upload.data.code !== 200 || !upload.data.data?.code)
    throw new Error('Gagal upload ke Imglarger')

  const fileCode = upload.data.data.code
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const s = await axios.post(
      `${IMGLARGER_BASE_URL}/CheckStatusNew`,
      { code: fileCode, scaleRadio: 4 },
      { headers: { ...IMGLARGER_HEADERS, 'Content-Type': 'application/json' }, timeout: 10000 }
    )
    if (s.data.code === 200 && s.data.data?.status === 'success') {
      const url = s.data.data.downloadUrls?.[0]
      if (!url) throw new Error('URL hasil tidak ada')
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 })
      return Buffer.from(res.data)
    }
    if (s.data.data?.status === 'error') throw new Error('Server Imglarger error')
  }
  throw new Error('Timeout: Server Imglarger sibuk')
}

class PicsArtUpscaler {
  constructor() {
    this.authToken  = null
    this.uploadUrl  = 'https://upload.picsart.com/files'
    this.enhanceUrl = 'https://ai.picsart.com/gw1/diffbir-enhancement-service/v1.7.6'
    this.jsUrl      = 'https://picsart.com/-/landings/4.290.0/static/index-msH24PNW-B73n3SC9.js'
  }

  async getAuthToken() {
    if (this.authToken) return this.authToken
    const res   = await axios.get(this.jsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36' },
      timeout: 10000,
    })
    const match = res.data.match(/"x-app-authorization":"Bearer ([^"]+)"/)
    if (!match) throw new Error('Token PicsArt tidak ditemukan')
    this.authToken = `Bearer ${match[1]}`
    return this.authToken
  }

  async uploadBuffer(buffer) {
    await this.getAuthToken()
    const form = new FormData()
    form.append('type', 'editing-temp-landings')
    form.append('file', buffer, { filename: 'image.jpeg', contentType: 'image/jpeg' })
    form.append('url', '')
    form.append('metainfo', '')
    const res = await axios.post(this.uploadUrl, form, {
      headers: {
        ...form.getHeaders(),
        'authority': 'upload.picsart.com', 'accept': '*/*',
        'accept-language': 'id-ID,id;q=0.9', 'origin': 'https://picsart.com',
        'referer': 'https://picsart.com/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
      },
      timeout: 30000,
    })
    if (!res.data?.result?.url) throw new Error('Upload ke PicsArt gagal')
    return res.data.result.url
  }

  async enhanceImage(imageUrl, targetScale = 4) {
    const scale  = Math.max(1, Math.min(20, targetScale))
    const params = new URLSearchParams({ picsart_cdn_url: imageUrl, format: 'PNG', model: 'REALESERGAN' })
    const res    = await axios.post(`${this.enhanceUrl}?${params}`, {
      image_url:         imageUrl,
      colour_correction: { enabled: false, blending: 0.5 },
      face_enhancement:  { enabled: true, blending: 1, max_faces: 1000, impression: false, gfpgan: true, node: 'ada' },
      seed:              42,
      upscale:           { enabled: true, node: 'esrgan', target_scale: scale },
    }, {
      headers: {
        'authority': 'ai.picsart.com', 'accept': 'application/json', 'content-type': 'application/json',
        'origin': 'https://picsart.com', 'referer': 'https://picsart.com/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
        'x-app-authorization': this.authToken, 'x-touchpoint': 'widget_EnhancedImage', 'x-touchpoint-referrer': '/image-upscale/',
      },
      timeout: 30000,
    })
    if (!res.data?.id) throw new Error('Enhance request gagal')
    return res.data
  }

  async checkStatus(jobId) {
    const res = await axios.get(`${this.enhanceUrl}/${jobId}`, {
      headers: {
        'authority': 'ai.picsart.com', 'accept': 'application/json',
        'origin': 'https://picsart.com', 'referer': 'https://picsart.com/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
        'x-app-authorization': this.authToken,
      },
      timeout: 10000,
    })
    return res.data
  }

  async waitForCompletion(jobId) {
    for (let i = 0; i < 30; i++) {
      try {
        const s = await this.checkStatus(jobId)
        if (s.status === 'DONE')   return s.result.image_url
        if (s.status === 'FAILED') throw new Error(s.error_message || 'Unknown error')
      } catch (e) {
        if (i >= 5) throw e
      }
      await new Promise(r => setTimeout(r, 2000))
    }
    throw new Error('Timeout menunggu PicsArt')
  }

  async upscale(buffer, targetScale = 4) {
    const uploadedUrl = await this.uploadBuffer(buffer)
    const enhance     = await this.enhanceImage(uploadedUrl, targetScale)
    const resultUrl   = await this.waitForCompletion(enhance.id)
    const res         = await axios.get(resultUrl, { responseType: 'arraybuffer', timeout: 30000 })
    return Buffer.from(res.data)
  }
}

const handler = async (m: any, { Morela, reply }: any) => {
  const msg = m.message
  const img =
    msg?.imageMessage ||
    msg?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

  if (!img) return reply(
`╭──「 🖼️ *HD Upscaler v1* 」
│
│  Kirim atau reply foto dengan
│  caption *.hdv1*
│
│  📌 Engine: Imglarger → PicsArt
│  📐 Scale : 4x
│
╰─────────────────────`
  )

  if ((img.fileLength || 0) > 10 * 1024 * 1024) {
    return reply('❌ Gambar terlalu besar! Maksimal *10MB*')
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  let buffer
  try {
    const stream = await downloadContentFromMessage(img, 'image')
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    buffer = Buffer.concat(chunks)
    if (!buffer.length) throw new Error('Buffer kosong')
  } catch (e) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply(`❌ Gagal download gambar\n\n${(e as Error).message}`)
  }

  await Morela.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })

  try {
    await uploadToTermai(buffer, img.mimetype || 'image/jpeg', `hdv1-${Date.now()}.jpg`)
  } catch {}

  let resultBuffer
  let methodUsed = 'Imglarger'

  try {
    resultBuffer = await upscaleWithImglarger(buffer)
  } catch (e1) {
    methodUsed = 'PicsArt'
    try {
      resultBuffer = await new PicsArtUpscaler().upscale(buffer, 4)
    } catch (e2) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(
`╭──「 ❌ *Kedua Engine Gagal* 」
│
│  Imglarger : ${(e1 as Error).message}
│  PicsArt   : ${(e2 as Error).message}
│
╰─────────────────────`
      )
    }
  }

  const hdUrl = await uploadImage(resultBuffer, Morela)
  if (!hdUrl) throw new Error('Gagal upload hasil ke hosting')

  const sizeBefore = (buffer.length / 1024).toFixed(1)
  const sizeAfter  = (resultBuffer.length / 1024).toFixed(1)

  const fk    = await buildFkontak(Morela)
  const ppUrl = await Morela.profilePictureUrl(Morela.user.id, 'image')
    .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')

  await new AIRich(Morela)
    .setTitle(`🖼️ HD Upscaler v1 | ${methodUsed} | ${sizeBefore} KB → ${sizeAfter} KB`)
    .addProduct({
      title:       '',
      brand:       botName,
      price:       'HD Upscaler v1',
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
}

handler.help     = ['hdv1 <reply foto>']
handler.tags     = ['tools']
handler.command  = ['hdv1']
handler.noLimit  = false
handler.owner    = false

export default handler