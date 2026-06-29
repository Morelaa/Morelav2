import axios   from 'axios'
import FormData from 'form-data'
import fs       from 'fs'
import path     from 'path'
import { bi, CHANNEL_URL, botName, buildFkontak } from '../../Library/utils.js'

const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0'

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

async function tikwmFetch(url: string) {
  let expanded = url
  try {
    const r = await axios.get(url, {
      maxRedirects: 10, timeout: 10000,
      headers: { 'User-Agent': UA_DESKTOP },
      validateStatus: () => true,
    })
    expanded = r.request?.res?.responseUrl || r.config?.url || url
  } catch {}

  const form = new FormData()
  form.append('url', expanded)
  form.append('count', '12')
  form.append('cursor', '0')
  form.append('web', '1')
  form.append('hd', '1')

  const res = await axios.post('https://www.tikwm.com/api/', form, {
    headers: { ...form.getHeaders(), 'User-Agent': UA_DESKTOP },
    timeout: 30000,
  })

  const d = res.data
  if (!d || d.code !== 0) throw new Error(d?.msg || 'TikWM API gagal')
  return d.data
}

async function downloadBuf(url: string): Promise<Buffer> {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': UA_DESKTOP, 'Referer': 'https://www.tiktok.com/' },
    timeout: 90000,
  })
  return Buffer.from(res.data)
}

const handler = async (m: any, { Morela, args, reply, fkontak }: any) => {
  const url = args[0]

  if (!url) return reply(
    `╭╌「 🎵 *${bi('TikTok Downloader')}* 」\n` +
    `┃ Download video & slide TikTok tanpa watermark\n` +
    `╰╌\n\n` +
    `*Command:*\n` +
    `┃ .tt2 <link>  — auto-detect video/slide\n\n` +
    `© ${botName}`
  )

  if (!url.includes('tiktok.com') && !url.includes('vm.tiktok')) {
    return reply('❌ Link tidak valid!\nContoh: .tt2 https://vm.tiktok.com/xxx')
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  const tempDir  = path.join(process.cwd(), 'media', 'temp')
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
  const videoOut = path.join(tempDir, `tt2_${Date.now()}.mp4`)

  try {
    const { Button, Carousel } = await import('../../Library/MessageBuilder.js?v=' + Date.now())

    const d        = await tikwmFetch(url)
    const isSlide  = Array.isArray(d.images) && d.images.length > 0
    const desc     = d.title || ''
    const author   = d.author?.nickname || d.author?.unique_id || 'unknown'
    const uniqueId = d.author?.unique_id || ''
    const music    = d.music_info?.title || d.music || ''
    const views    = d.play_count || 0
    const likes    = d.digg_count || 0
    const comments = d.comment_count || 0
    const fk       = await buildFkontak(Morela)

    if (isSlide) {
      const images: string[] = d.images.map((img: any) =>
        typeof img === 'string' ? img : img?.url || img
      ).filter(Boolean)

      await Morela.sendMessage(m.chat, { react: { text: '📥', key: m.key } })

      const cv = new Carousel(Morela)
      cv.setBody(
        `🖼️ *${author}*\n` +
        `📝 ${desc.slice(0, 60)}${desc.length > 60 ? '...' : ''}\n` +
        `👁️ ${numFmt(views)}  ❤️ ${numFmt(likes)}  💬 ${numFmt(comments)}\n` +
        `🖼️ ${images.length} gambar  🎵 ${music.slice(0, 30)}${music.length > 30 ? '...' : ''}`
      ).setFooter(`© ${botName}`)

      for (const imgUrl of images) {
        try {
          const buf  = await downloadBuf(imgUrl)
          const card = new Button(Morela).setImage(buf)
          cv.addCard(await card.toCard())
        } catch {}
      }

      await cv.send(m.chat, { quoted: fk })

      const audioUrl = d.music_info?.play || null
      if (audioUrl) {
        await Morela.sendMessage(m.chat, {
          audio: { url: audioUrl }, mimetype: 'audio/mpeg', ptt: false,
        }, { quoted: fk })
      }

    } else {
      const playUrl = d.hdplay || d.play || d.wmplay
      if (!playUrl) throw new Error('URL video tidak ditemukan')

      await Morela.sendMessage(m.chat, { react: { text: '📥', key: m.key } })
      const videoBuf = await downloadBuf(playUrl)
      const sizeMB   = (videoBuf.length / 1024 / 1024).toFixed(2)
      fs.writeFileSync(videoOut, videoBuf)

      await Morela.sendMessage(m.chat, { react: { text: '📤', key: m.key } })

      const cv = new Carousel(Morela)
      cv.setBody(
        `🎵 *${author}*\n` +
        `📝 ${desc.slice(0, 60)}${desc.length > 60 ? '...' : ''}\n` +
        `👁️ ${numFmt(views)}  ❤️ ${numFmt(likes)}  💬 ${numFmt(comments)}\n` +
        `⏱️ ${fmtDuration(d.duration || 0)}  📦 ${sizeMB} MB\n` +
        `🎵 ${music.slice(0, 40)}${music.length > 40 ? '...' : ''}`
      ).setFooter(`© ${botName}`)

      const card = new Button(Morela).setVideo(fs.readFileSync(videoOut))
      cv.addCard(await card.toCard())
      await cv.send(m.chat, { quoted: fk })
    }

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[TT2]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Gagal: ${e.message}`)
  } finally {
    try { if (fs.existsSync(videoOut)) fs.unlinkSync(videoOut) } catch {}
  }
}

handler.command  = ['tt2', 'tiktok2']
handler.tags     = ['downloader']
handler.help     = ['tt2 <link>']
handler.noLimit  = false
handler.owner    = false
handler.premium  = false
handler.group    = false
handler.private  = false
handler.admin    = false
handler.botAdmin = false

export default handler
