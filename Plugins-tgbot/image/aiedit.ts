import axios from 'axios'
import { sendMsg, tgDownloadPhoto, tgUploadToCDN, tgSendPhoto } from '../core/api.js'
import { tgGetPendingPhoto, tgClearPendingPhoto } from '../core/helpers.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['aiedit'],
  category: 'image',
  owner:    false,
  help:     '/aiedit <prompt> — AI Edit (reply foto)',

  handler: async (chatId, args = '') => {
    if (!args) return void sendMsg(chatId, '❌ Format: /aiedit <prompt>\n\nContoh: /aiedit to anime')
    const fileId = tgGetPendingPhoto(chatId)
    if (!fileId) return void sendMsg(chatId, '❌ *Reply foto* dengan /aiedit <prompt>')
    tgClearPendingPhoto(chatId)
    await sendMsg(chatId, `🎨 *Mengedit gambar...*\n📝 Prompt: *${args}*`)
    try {
      const imgBuf    = await tgDownloadPhoto(fileId)
      const imgUrl    = await tgUploadToCDN(imgBuf)
      const editRes   = await axios.get('https://api.neoxr.eu/api/qwen-edit', { params: { image: imgUrl, prompt: args, apikey: global.apiKeys.neoxr }, timeout: 120000 })
      if (!editRes.data?.status) throw new Error(editRes.data?.message || 'API gagal')
      const resultUrl = editRes.data.data?.url || editRes.data.data?.downloadUrl
      if (!resultUrl) throw new Error('URL hasil tidak ditemukan')
      await tgSendPhoto(chatId, resultUrl, `✅ *AI Edit selesai!*\n📝 Prompt: ${args}`)
    } catch (e) { await sendMsg(chatId, `❌ Gagal AI Edit: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
