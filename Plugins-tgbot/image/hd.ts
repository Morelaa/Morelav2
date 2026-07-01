import axios from 'axios'
import { sendMsg } from '../core/api.js'
import { tgDownloadPhoto, tgUploadToCDN, tgSendDocument } from '../core/api.js'
import { tgGetPendingPhoto, tgClearPendingPhoto } from '../core/helpers.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['hd'],
  category: 'image',
  owner:    false,
  hidden:     true,
  buttonOnly: true, // hanya jalan lewat tombol, bukan sebagai text command

  handler: async (chatId) => {
    const fileId = tgGetPendingPhoto(chatId)
    if (!fileId) return void sendMsg(chatId, '❌ *Kirim foto terlebih dahulu*, lalu klik tombol HD')
    tgClearPendingPhoto(chatId)
    await sendMsg(chatId, '⏳ Mohon tunggu sebentar, kami akan segera mengirimkan fotonya')
    try {
      const imgBuf = await tgDownloadPhoto(fileId)
      const imgUrl = await tgUploadToCDN(imgBuf)
      const hdRes  = await axios.get('https://api-faa.my.id/faa/superhd', { params: { url: imgUrl }, responseType: 'arraybuffer', timeout: 180000, headers: { 'User-Agent': 'Mozilla/5.0' }, maxContentLength: 50 * 1024 * 1024 })
      const hdBuf  = Buffer.from(hdRes.data)
      if (hdBuf.length < 1000) throw new Error('Response tidak valid')
      await tgSendDocument(chatId, hdBuf, '✅ Pemrosesan gambar selesai! Anda dapat mengirim gambar lain', 'superhd.png')
    } catch (e) { await sendMsg(chatId, `❌ Gagal Super HD: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
