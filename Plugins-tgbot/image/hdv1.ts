import axios from 'axios'
import { sendMsg, tgDownloadPhoto, tgSendDocument } from '../core/api.js'
import { tgGetPendingPhoto, tgClearPendingPhoto } from '../core/helpers.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['hdv1'],
  category: 'image',
  owner:    false,
  hidden:     true,
  buttonOnly: true,

  handler: async (chatId, args = '') => {
    const fileId = tgGetPendingPhoto(chatId)
    if (!fileId) return void sendMsg(chatId, '❌ *Kirim foto terlebih dahulu*, lalu klik tombol HDV1')
    tgClearPendingPhoto(chatId)
    await sendMsg(chatId, '⏳ Mohon tunggu sebentar, kami akan segera mengirimkan fotonya')
    try {
      const imgBuf   = await tgDownloadPhoto(fileId)
      const FormData = (await import('form-data')).default
      const IMGLARGER_BASE_URL = 'https://get1.imglarger.com/api/UpscalerNew'
      const IMGLARGER_HEADERS  = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36',
        'Origin':     'https://imgupscaler.com',
        'Referer':    'https://imgupscaler.com/',
      }

      // Engine 1: Imglarger
      let resultBuf: Buffer | null = null
      try {
        const form = new FormData()
        form.append('myfile', imgBuf, { filename: 'image.jpg', contentType: 'image/jpeg' })
        form.append('scaleRadio', '4')
        const upload = await axios.post(`${IMGLARGER_BASE_URL}/UploadNew`, form, {
          headers: { ...IMGLARGER_HEADERS, ...form.getHeaders() },
          timeout: 30000,
        })
        if (upload.data.code !== 200 || !upload.data.data?.code) throw new Error('Gagal upload ke Imglarger')
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
            resultBuf = Buffer.from(res.data)
            break
          }
          if (s.data.data?.status === 'error') throw new Error('Server Imglarger error')
        }
        if (!resultBuf) throw new Error('Timeout: Server Imglarger sibuk')
      } catch (e1) {
        // Engine 2: PicsArt fallback
        const jsUrl = 'https://picsart.com/-/landings/4.290.0/static/index-msH24PNW-B73n3SC9.js'
        const jsRes = await axios.get(jsUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36' },
          timeout: 10000,
        })
        const match = jsRes.data.match(/"x-app-authorization":"Bearer ([^"]+)"/)
        if (!match) throw new Error('Token PicsArt tidak ditemukan')
        const authToken = `Bearer ${match[1]}`

        // Upload ke PicsArt
        const upForm = new FormData()
        upForm.append('type', 'editing-temp-landings')
        upForm.append('file', imgBuf, { filename: 'image.jpeg', contentType: 'image/jpeg' })
        upForm.append('url', '')
        upForm.append('metainfo', '')
        const upRes = await axios.post('https://upload.picsart.com/files', upForm, {
          headers: {
            ...upForm.getHeaders(),
            'authority': 'upload.picsart.com', 'accept': '*/*',
            'accept-language': 'id-ID,id;q=0.9', 'origin': 'https://picsart.com',
            'referer': 'https://picsart.com/',
            'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
          },
          timeout: 30000,
        })
        if (!upRes.data?.result?.url) throw new Error('Upload ke PicsArt gagal')
        const uploadedUrl = upRes.data.result.url

        // Enhance
        const params = new URLSearchParams({ picsart_cdn_url: uploadedUrl, format: 'PNG', model: 'REALESERGAN' })
        const enhRes = await axios.post(`https://ai.picsart.com/gw1/diffbir-enhancement-service/v1.7.6?${params}`, {
          image_url:         uploadedUrl,
          colour_correction: { enabled: false, blending: 0.5 },
          face_enhancement:  { enabled: true, blending: 1, max_faces: 1000, impression: false, gfpgan: true, node: 'ada' },
          seed:              42,
          upscale:           { enabled: true, node: 'esrgan', target_scale: 4 },
        }, {
          headers: {
            'authority': 'ai.picsart.com', 'accept': 'application/json', 'content-type': 'application/json',
            'origin': 'https://picsart.com', 'referer': 'https://picsart.com/',
            'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
            'x-app-authorization': authToken, 'x-touchpoint': 'widget_EnhancedImage', 'x-touchpoint-referrer': '/image-upscale/',
          },
          timeout: 30000,
        })
        if (!enhRes.data?.id) throw new Error('Enhance request gagal')
        const jobId = enhRes.data.id

        // Poll status
        let resultUrl: string | null = null
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000))
          const s = await axios.get(`https://ai.picsart.com/gw1/diffbir-enhancement-service/v1.7.6/${jobId}`, {
            headers: {
              'authority': 'ai.picsart.com', 'accept': 'application/json',
              'origin': 'https://picsart.com', 'referer': 'https://picsart.com/',
              'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
              'x-app-authorization': authToken,
            },
            timeout: 10000,
          })
          if (s.data.status === 'DONE') { resultUrl = s.data.result.image_url; break }
          if (s.data.status === 'FAILED') throw new Error(s.data.error_message || 'PicsArt FAILED')
        }
        if (!resultUrl) throw new Error('Timeout menunggu PicsArt')
        const dlRes = await axios.get(resultUrl, { responseType: 'arraybuffer', timeout: 30000 })
        resultBuf = Buffer.from(dlRes.data)
      }

      await tgSendDocument(chatId, resultBuf!, '✅ Pemrosesan gambar selesai! Anda dapat mengirim gambar lain', 'hdv1.png')
    } catch (e) { await sendMsg(chatId, `❌ Gagal HD V1: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
