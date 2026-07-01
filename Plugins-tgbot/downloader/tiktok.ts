import axios from 'axios'
import { sendMsg, getTgCfg } from '../core/api.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['tiktok', 'tt'],
  category: 'downloader',
  owner:    false,
  help:     '/tiktok <url> — Download TikTok',

  handler: async (chatId, args = '') => {
    const url = args.trim()
    const TT_REGEX = /https?:\/\/(?:www\.|m\.|vm\.|vt\.|v\.)?tiktok\.com(?:\/[^\s]*)?|https?:\/\/(?:vm|vt)\.tiktok\.com\/[^\s]*/i
    if (!url || !TT_REGEX.test(url)) {
      return void sendMsg(chatId,
        '🎵 *TikTok Downloader*\n\n' +
        'Cara pakai:\n`/tiktok https://vt.tiktok.com/xxx`\n`/tt https://vm.tiktok.com/xxx`'
      )
    }
    await sendMsg(chatId, '⏳ *Mengunduh TikTok...*\n_Harap tunggu_')
    try {
      const NEOXR_KEY = global.apiKeys.neoxr
      const res = await axios.get('https://api.neoxr.eu/api/tiktok', {
        params:  { url, apikey: NEOXR_KEY },
        timeout: 30000,
      })
      const d = res.data
      if (!d?.status || !d?.data) throw new Error(d?.message || 'Neoxr API gagal')
      const data      = d.data
      if (!data.video) throw new Error('URL video tidak ditemukan')

      const playUrl  = data.video
      const author   = data.author?.nickname   || 'unknown'
      const uniqueId = data.author?.unique_id  || ''
      const desc     = data.caption            || ''
      const views    = data.statistic?.views   || 0
      const likes    = data.statistic?.likes   || 0
      const comments = data.statistic?.comments || 0
      const music    = data.music?.title       || ''
      const duration = data.music?.duration    || 0

      const numFmt = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : String(n)
      const fmtDur = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

      // Download video
      const videoBuf = Buffer.from((await axios.get(playUrl, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.tiktok.com/' },
        timeout:      90000,
        maxRedirects: 10,
      })).data)
      const sizeMB = (videoBuf.length / 1024 / 1024).toFixed(2)

      // Upload ke CDN lalu kirim
      const { token } = getTgCfg()
      const FormData  = (await import('form-data')).default
      const form      = new FormData()
      form.append('chat_id', String(chatId))
      form.append('video', videoBuf, { filename: 'tiktok.mp4', contentType: 'video/mp4' })
      form.append('duration', String(duration))
      form.append('caption',
        `🎵 *TikTok*\n` +
        `👤 ${author}${uniqueId ? ` (@${uniqueId})` : ''}\n` +
        `📝 ${desc.slice(0, 100)}${desc.length > 100 ? '...' : ''}\n` +
        `👁️ ${numFmt(views)}  ❤️ ${numFmt(likes)}  💬 ${numFmt(comments)}\n` +
        `⏱️ ${fmtDur(duration)}  📦 ${sizeMB} MB\n` +
        `🎵 ${music.slice(0, 50)}${music.length > 50 ? '...' : ''}`
      )
      form.append('parse_mode', 'Markdown')
      await axios.post(`https://api.telegram.org/bot${token}/sendVideo`, form, {
        headers: { ...form.getHeaders() },
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength:    Infinity,
      })
    } catch (e) { await sendMsg(chatId, `❌ Gagal TikTok: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
