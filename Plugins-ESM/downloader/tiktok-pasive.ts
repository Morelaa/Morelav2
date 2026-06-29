/**
 * tiktok-pasive.ts
 * ─────────────────────────────────────────────────────────────────
 * Passive plugin: auto-detect TikTok link di pesan, langsung download
 * tanpa perlu ketik .tt — cukup kirim/paste link TikTok-nya aja.
 *
 * Supported URL patterns:
 *   https://vt.tiktok.com/ZSCYRn3eV/
 *   https://vm.tiktok.com/ZSCYRn3eV/
 *   https://www.tiktok.com/@user/video/123456789
 *   https://m.tiktok.com/v/123456789.html
 * ─────────────────────────────────────────────────────────────────
 */

import axios from 'axios'
import fs    from 'fs'
import path  from 'path'
import { bi, botName, buildFkontak } from '../../Library/utils.js'

// ── regex: semua variant short-link & long-link TikTok ─────────────
const TT_REGEX =
  /https?:\/\/(?:www\.|m\.|vm\.|vt\.|v\.)?(?:tiktok\.com)(?:\/[^\s]*)?|https?:\/\/(?:vm|vt)\.tiktok\.com\/[^\s]*/gi

// ── helpers (sama kayak di tiktok.ts) ──────────────────────────────
function numFmt(n: any): string {
  const num = parseInt(n) || 0
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000)     return (num / 1_000).toFixed(1) + 'K'
  return String(num)
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

async function fetchNeoxr(url: string) {
  const NEOXR_KEY = (global as any).apiKeys?.neoxr
  const res = await axios.get('https://api.neoxr.eu/api/tiktok', {
    params:  { url, apikey: NEOXR_KEY },
    timeout: 30_000,
  })
  const d = res.data
  if (!d?.status || !d?.data) throw new Error(d?.message || 'Neoxr API gagal')
  const data = d.data
  if (!data.video) throw new Error('URL video tidak ditemukan')
  return {
    playUrl:   data.video,
    coverUrl:  data.author?.avatar_thumb?.url_list?.[0]  || '',
    avatarUrl: data.author?.avatar_medium?.url_list?.[0] || data.author?.avatar_thumb?.url_list?.[0] || '',
    desc:      data.caption  || '',
    author:    data.author?.nickname   || 'unknown',
    uniqueId:  data.author?.unique_id  || '',
    duration:  data.music?.duration    || 0,
    views:     data.statistic?.views   || 0,
    likes:     data.statistic?.likes   || 0,
    comments:  data.statistic?.comments || 0,
    music:     data.music?.title       || '',
  }
}

async function downloadVideo(videoUrl: string): Promise<Buffer> {
  const res = await axios.get(videoUrl, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer':    'https://www.tiktok.com/',
    },
    timeout:      90_000,
    maxRedirects: 10,
  })
  return Buffer.from(res.data)
}

// ── extract semua teks dari pesan (conversation / caption / dll) ────
function extractText(m: any): string {
  const msg  = m.message || {}
  const parts: string[] = []
  if (msg.conversation)                          parts.push(msg.conversation)
  if (msg.extendedTextMessage?.text)             parts.push(msg.extendedTextMessage.text)
  if (msg.extendedTextMessage?.matchedText)      parts.push(msg.extendedTextMessage.matchedText)
  if (msg.extendedTextMessage?.canonicalUrl)     parts.push(msg.extendedTextMessage.canonicalUrl)
  if (msg.imageMessage?.caption)                 parts.push(msg.imageMessage.caption)
  if (msg.videoMessage?.caption)                 parts.push(msg.videoMessage.caption)
  if (msg.documentMessage?.caption)              parts.push(msg.documentMessage.caption)
  return parts.join(' ')
}

// ── passive handler ─────────────────────────────────────────────────
const handler = {
  tags: ['passive', 'downloader'],

  handler: async (m: any, { Morela, fkontak }: any) => {
    try {
      // ── guard: skip pesan system / status / dari bot sendiri ──────
      if (!m.message)                             return
      if (m.message?.reactionMessage)            return
      if (m.message?.protocolMessage)            return
      if (m.message?.senderKeyDistributionMessage) return
      if (m.chat === 'status@broadcast')          return
      if (m.key?.fromMe)                          return

      // ── cari link TikTok di teks pesan ───────────────────────────
      const text  = extractText(m)
      if (!text) return

      TT_REGEX.lastIndex = 0           // reset stateful regex
      const match = TT_REGEX.exec(text)
      if (!match) return

      const url = match[0].trim()

      // ── mulai proses download ─────────────────────────────────────
      await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

      const tempDir  = path.join(process.cwd(), 'media', 'temp')
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
      const videoOut = path.join(tempDir, `tt_passive_${Date.now()}.mp4`)

      try {
        const data = await fetchNeoxr(url)

        await Morela.sendMessage(m.chat, { react: { text: '📥', key: m.key } })
        const videoBuf = await downloadVideo(data.playUrl)
        const sizeMB   = (videoBuf.length / 1024 / 1024).toFixed(2)
        fs.writeFileSync(videoOut, videoBuf)

        const fk = fkontak || await buildFkontak(Morela)

        const ppUrl = await Morela.profilePictureUrl(Morela.user.id, 'image')
          .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')

        await Morela.sendMessage(m.chat, { react: { text: '📤', key: m.key } })

        const { AIRich, Toolkit } = await import('../../Library/MessageBuilder.js?v=' + Date.now())

        const waVideoUrl = await Toolkit.toUrl(Morela, videoBuf, 'video')
        if (!waVideoUrl) throw new Error('Gagal upload video ke WA server')

        const footerText =
          `${data.author}${data.uniqueId ? ` (@${data.uniqueId})` : ''}\n` +
          `${data.desc.slice(0, 80)}${data.desc.length > 80 ? '...' : ''}\n` +
          `👁️ ${numFmt(data.views)}  ❤️ ${numFmt(data.likes)}  💬 ${numFmt(data.comments)}\n` +
          `⏱️ ${fmtDuration(data.duration)}  📦 ${sizeMB} MB\n` +
          `🎵 ${data.music.slice(0, 50)}${data.music.length > 50 ? '...' : ''}\n` +
          `© ${botName}`

        const profileUrl = data.uniqueId
          ? `https://www.tiktok.com/@${data.uniqueId}`
          : 'https://www.tiktok.com'

        await new AIRich(Morela)
          .setTitle(`🎵 TikTok`)
          .addProduct({
            title:       '',
            brand:       '',
            price:       `${sizeMB} MB`,
            sale_price:  '',
            product_url: profileUrl,
            icon_url:    ppUrl,
            image_url:   ppUrl,
          })
          .addTip(' ')
          .addVideo({
            url:         waVideoUrl,
            duration:    data.duration,
            file_length: videoBuf.length,
            ...(data.coverUrl ? { thumbnail: data.coverUrl } : {}),
          })
          .addSource([
            [data.avatarUrl || ppUrl, profileUrl, `${data.author}${data.uniqueId ? ` (@${data.uniqueId})` : ''}`],
          ])
          .setFooter(footerText)
          .send(m.chat, { quoted: fk })

        await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

      } catch (e: any) {
        console.error('[TT-PASIVE]', e.message)
        await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        await Morela.sendMessage(m.chat,
          { text: `❌ Gagal download TikTok: ${e.message}` },
          { quoted: m }
        )
      } finally {
        try { if (fs.existsSync(videoOut)) fs.unlinkSync(videoOut) } catch {}
      }

    } catch (err: any) {
      console.error('[TT-PASIVE OUTER]', err.message)
    }
  },
}

export default handler