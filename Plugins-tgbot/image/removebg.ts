import axios from 'axios'
import { sendMsg, tgDownloadPhoto, getTgCfg } from '../core/api.js'
import { tgGetPendingPhoto, tgClearPendingPhoto } from '../core/helpers.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['removebg'],
  category: 'image',
  owner:    false,
  hidden:     true,
  buttonOnly: true,

  handler: async (chatId) => {
    const fileId = tgGetPendingPhoto(chatId)
    if (!fileId) return void sendMsg(chatId, '❌ *Kirim foto terlebih dahulu*, lalu klik tombol Remove BG')
    tgClearPendingPhoto(chatId)
    await sendMsg(chatId, '⏳ Mohon tunggu sebentar, kami akan segera mengirimkan fotonya')
    try {
      const imgBuf = await tgDownloadPhoto(fileId)
      const fs     = await import('fs')
      const path   = await import('path')
      const os     = await import('os')
      const FormData = (await import('form-data')).default

      // Upload ke pixelcut
      const tmpFile = path.join(os.tmpdir(), `removebg_${Date.now()}.jpg`)
      fs.writeFileSync(tmpFile, imgBuf)
      let resultBuf: Buffer
      try {
        const form = new FormData()
        form.append('image', fs.createReadStream(tmpFile), path.basename(tmpFile))
        form.append('format', 'png')
        form.append('model', 'v1')
        const res = await axios.post('https://api2.pixelcut.app/image/matte/v1', form, {
          headers: {
            'User-Agent':        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
            'Accept':            'application/json, text/plain, */*',
            'x-locale':          'en',
            'x-client-version':  'web:pixa.com:4a5b0af2',
            'origin':            'https://www.pixa.com',
            'referer':           'https://www.pixa.com/',
            'accept-language':   'id-ID,id;q=0.9',
            ...form.getHeaders()
          },
          responseType: 'arraybuffer',
          timeout:      30000
        })
        resultBuf = Buffer.from(res.data)
        if (!resultBuf.length) throw new Error('Buffer hasil kosong')
      } finally {
        try { fs.unlinkSync(tmpFile) } catch {}
      }

      const { token }  = getTgCfg()
      const form2      = new FormData()
      form2.append('chat_id', String(chatId))
      form2.append('document', resultBuf, { filename: 'removebg.png', contentType: 'image/png' })
      form2.append('caption', '✅ Pemrosesan gambar selesai! Anda dapat mengirim gambar lain')
      form2.append('parse_mode', 'Markdown')
      await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form2, {
        headers: form2.getHeaders(), timeout: 60000, maxContentLength: Infinity, maxBodyLength: Infinity
      })
    } catch (e) { await sendMsg(chatId, `❌ Gagal Remove BG: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
