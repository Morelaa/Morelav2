import axios from 'axios'
import { sendMsg, getTgCfg } from '../core/api.js'
import type { TgPlugin } from '../core/types.js'

export default {
  command:  ['ig', 'instagram', 'igdl', 'insta'],
  category: 'downloader',
  owner:    false,
  help:     '/ig <url> — Download Instagram',

  handler: async (chatId, args = '') => {
    const url = args.trim()
    const IG_REGEX = /instagram\.com\/(p|reel|tv|stories|share\/reel)\//i
    if (!url || !IG_REGEX.test(url)) {
      return void sendMsg(chatId,
        '📸 *Instagram Downloader*\n\n' +
        'Cara pakai:\n`/ig https://instagram.com/p/xxx`\n`/ig https://instagram.com/reel/xxx`'
      )
    }
    await sendMsg(chatId, '⏳ *Mengunduh Instagram...*\n_Harap tunggu_')
    try {
      const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36'
      const FormData = (await import('form-data')).default

      // ── Helper download buffer ───────────────────────────────────
      const dlBuf = async (u: string) => Buffer.from((await axios.get(u, {
        responseType: 'arraybuffer', timeout: 60000,
        headers: { 'User-Agent': UA, 'Referer': 'https://www.instagram.com/' },
        maxRedirects: 5
      })).data)

      // ── Fetch via fallback sumber ──────────────────────────────
      type IGResult = { title: string; videos: { url: string; quality: string }[]; images: { url: string }[] }
      let result: IGResult | null = null

      // 1. Deline
      try {
        const { data } = await axios.get('https://api.deline.web.id/downloader/ig', { params: { url }, timeout: 30000 })
        if (data?.status && data?.result) {
          const media = data.result.media
          result = {
            title:  data.result.title || '',
            videos: (media?.videos || []).map((v: string) => ({ url: v, quality: '' })),
            images: (media?.images || []).map((i: string) => ({ url: i })),
          }
          if (!result.videos.length && !result.images.length) result = null
        }
      } catch {}

      // 2. Cobalt fallback
      if (!result) {
        try {
          const r = await axios.post('https://api.cobalt.tools/api/json',
            { url, vCodec: 'h264', vQuality: '720', aFormat: 'mp3', isNoTTWatermark: true },
            { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Content-Type': 'application/json' }, timeout: 25000 }
          )
          const d = r.data
          if (d.status === 'picker') {
            result = {
              title: '',
              videos: (d.picker?.filter((p: any) => p.type === 'video') || []).map((p: any) => ({ url: p.url, quality: '' })),
              images: (d.picker?.filter((p: any) => p.type === 'photo') || []).map((p: any) => ({ url: p.url })),
            }
          } else if (d.url) {
            result = { title: '', videos: [{ url: d.url, quality: '720p' }], images: [] }
          }
          if (result && !result.videos.length && !result.images.length) result = null
        } catch {}
      }

      if (!result) throw new Error('Semua sumber gagal. Akun mungkin private atau link tidak valid.')

      const total = result.videos.length + result.images.length
      await sendMsg(chatId,
        `📸 *Instagram*\n` +
        `🖼️ Gambar: ${result.images.length}  🎬 Video: ${result.videos.length}  📦 Total: ${total}` +
        (result.title ? `\n📝 ${result.title.slice(0, 60)}` : '')
      )

      const { token } = getTgCfg()
      let sent = 0

      // Kirim gambar
      for (let i = 0; i < result.images.length; i++) {
        try {
          const buf  = await dlBuf(result.images[i].url)
          const form = new FormData()
          form.append('chat_id', String(chatId))
          form.append('photo', buf, { filename: 'ig.jpg', contentType: 'image/jpeg' })
          form.append('caption', result.images.length > 1 ? `🖼️ ${i+1}/${result.images.length}` : '📸 Instagram')
          await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, {
            headers: form.getHeaders(), timeout: 60000, maxContentLength: Infinity, maxBodyLength: Infinity
          })
          sent++
        } catch (e) { console.error('[IG img]', (e as Error).message) }
      }

      // Kirim video
      for (let i = 0; i < result.videos.length; i++) {
        try {
          const buf    = await dlBuf(result.videos[i].url)
          const sizeMB = buf.length / 1024 / 1024
          if (sizeMB > 50) { await sendMsg(chatId, `⚠️ Video ${i+1} terlalu besar (${sizeMB.toFixed(1)} MB), skip.`); continue }
          const form = new FormData()
          form.append('chat_id', String(chatId))
          form.append('video', buf, { filename: 'ig.mp4', contentType: 'video/mp4' })
          form.append('caption', `🎬 Instagram${result.videos[i].quality ? ' • '+result.videos[i].quality : ''}`)
          await axios.post(`https://api.telegram.org/bot${token}/sendVideo`, form, {
            headers: form.getHeaders(), timeout: 120000, maxContentLength: Infinity, maxBodyLength: Infinity
          })
          sent++
        } catch (e) { console.error('[IG vid]', (e as Error).message) }
      }

      if (sent === 0) throw new Error('Semua media gagal dikirim')
    } catch (e) { await sendMsg(chatId, `❌ Gagal IG: ${(e as Error).message}`) }
  }
} satisfies TgPlugin
