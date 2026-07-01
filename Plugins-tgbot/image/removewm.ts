import axios from 'axios'
import { sendMsg, tgDownloadPhoto, tgUploadToCDN, tgSendDocument } from '../core/api.js'
import { tgGetPendingPhoto, tgClearPendingPhoto } from '../core/helpers.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['removewm'],
  category: 'image',
  owner:    false,
  hidden:     true,
  buttonOnly: true,

  handler: async (chatId) => {
    const fileId = tgGetPendingPhoto(chatId)
    if (!fileId) return void sendMsg(chatId, '❌ *Kirim foto terlebih dahulu*, lalu klik tombol Remove WM')
    tgClearPendingPhoto(chatId)
    await sendMsg(chatId, '⏳ Mohon tunggu sebentar, kami akan segera mengirimkan fotonya')
    try {
      const imgBuf = await tgDownloadPhoto(fileId)
      const imgUrl = await tgUploadToCDN(imgBuf)
      const NEOXR_KEY = global.apiKeys.neoxr
      const res = await axios.get('https://api.neoxr.eu/api/nowm', { params: { image: imgUrl, apikey: NEOXR_KEY }, timeout: 120000 })
      if (!res.data?.status || !res.data?.data?.url) throw new Error(res.data?.message || 'Gagal mendapatkan hasil dari API')
      const resultUrl = res.data.data.url
      await tgSendDocument(chatId, resultUrl, '✅ Pemrosesan gambar selesai! Anda dapat mengirim gambar lain', 'removewm.png')
    } catch (e) { await sendMsg(chatId, `❌ Gagal Remove Watermark: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
