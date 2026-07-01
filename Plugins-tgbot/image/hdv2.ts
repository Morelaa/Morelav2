import axios from 'axios'
import { sendMsg, tgDownloadPhoto, tgSendDocument } from '../core/api.js'
import { tgGetPendingPhoto, tgClearPendingPhoto } from '../core/helpers.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['hdv2'],
  category: 'image',
  owner:    false,
  hidden:     true,
  buttonOnly: true,

  handler: async (chatId, args = '') => {
    const fileId = tgGetPendingPhoto(chatId)
    if (!fileId) return void sendMsg(chatId, '❌ *Kirim foto terlebih dahulu*, lalu klik tombol HDV2')
    tgClearPendingPhoto(chatId)
    const multiplier = args.includes('4') ? 4 : 2
    await sendMsg(chatId, '⏳ Mohon tunggu sebentar, kami akan segera mengirimkan fotonya')
    try {
      const imgBuf  = await tgDownloadPhoto(fileId)
      const FormData = (await import('form-data')).default
      const filename = `image_${Date.now()}.jpg`

      // Ambil token & taskId dari iloveimg
      const pageRes = await fetch('https://www.iloveimg.com/id/tingkatkan-gambar', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
      const html    = await pageRes.text()
      const token   = html.match(/"token":"([^"]+)"/)?.[1]
      const taskId  = html.match(/ilovepdfConfig\.taskId\s*=\s*'([^']+)'/)?.[1]
      if (!token || !taskId) throw new Error('Gagal ambil token/taskId iloveimg')

      // Upload
      const uploadForm = new FormData()
      uploadForm.append('name', filename)
      uploadForm.append('chunk', '0')
      uploadForm.append('chunks', '1')
      uploadForm.append('task', taskId)
      uploadForm.append('preview', '1')
      uploadForm.append('pdfinfo', '0')
      uploadForm.append('pdfforms', '0')
      uploadForm.append('pdfresetforms', '0')
      uploadForm.append('v', 'web.0')
      uploadForm.append('file', imgBuf, { filename, contentType: 'image/jpeg' })
      const uploadRes = await axios.post('https://api1g.iloveimg.com/v1/upload', uploadForm, {
        headers: { ...uploadForm.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Authorization': `Bearer ${token}` }
      })
      const serverFilename = uploadRes.data?.server_filename
      if (!serverFilename) throw new Error('Upload iloveimg gagal')

      // Process
      const processForm = new FormData()
      processForm.append('packaged_filename', 'iloveimg-upscaled')
      processForm.append('multiplier', String(multiplier))
      processForm.append('task', taskId)
      processForm.append('tool', 'upscaleimage')
      processForm.append('files[0][server_filename]', serverFilename)
      processForm.append('files[0][filename]', filename)
      const processRes = await axios.post('https://api1g.iloveimg.com/v1/process', processForm, {
        headers: { ...processForm.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Authorization': `Bearer ${token}`, 'Origin': 'https://www.iloveimg.com' }
      })
      if (processRes.data?.status !== 'TaskSuccess') throw new Error('Processing gagal: ' + JSON.stringify(processRes.data))

      // Download
      const dlRes = await axios.get(`https://api1g.iloveimg.com/v1/download/${taskId}`, {
        responseType: 'arraybuffer',
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
      const resultBuf = Buffer.from(dlRes.data)
      await tgSendDocument(chatId, resultBuf, '✅ Pemrosesan gambar selesai! Anda dapat mengirim gambar lain', 'hdv2.png')
    } catch (e) { await sendMsg(chatId, `❌ Gagal HD V2: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
