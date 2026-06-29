import axios from 'axios'
import { botName } from '../../Library/utils.js'

const SF_PHP    = 'https://id.savefrom.net/savefrom.php'
const SF_WORKER = 'https://worker.savefrom.net/api/convert'

const COBALT_API = 'https://api.cobalt.tools/api/json'

const DELINE_API = 'https://api.deline.web.id/downloader/ig'

async function fetchSavefrom(igUrl: unknown) {
  const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36'

  let cookieStr = 'vid=300'
  try {
    const page = await axios.get('https://id.savefrom.net/194kC/download-from-instagram', {
      headers: { 'User-Agent': UA },
      timeout: 10000,
      maxRedirects: 3
    })
    const setCookies = page.headers['set-cookie'] || []
    const cookies    = setCookies.map((c: unknown) => c.split(';')[0]).join('; ')
    if (cookies) cookieStr = cookies + '; vid=300'
  } catch {}

  const params = new URLSearchParams({
    sf_url  : String(igUrl),
    new     : '2',
    lang    : 'id',
    country : 'ID',
    os      : 'android',
    browser : 'chrome',
    channel : 'downloader',
    app     : ''
  })

  const res = await axios.post(SF_PHP, params.toString(), {
    headers: {
      'User-Agent'        : UA,
      'Referer'           : 'https://id.savefrom.net/194kC/download-from-instagram',
      'Origin'            : 'https://id.savefrom.net',
      'Content-Type'      : 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept'            : 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With'  : 'XMLHttpRequest',
      'Cookie'            : cookieStr
    },
    timeout: 30000
  })

  const data = res.data

  if (!data || typeof data !== 'object') {
    throw new Error('savefrom: response bukan JSON (kemungkinan captcha)')
  }
  if (data.captcha || data.error) {
    throw new Error('savefrom: ' + (data.error || 'captcha required'))
  }
  if (!data.url?.length) {
    throw new Error('savefrom: tidak ada URL di response')
  }

  return parseSavefrom(data)
}

async function fetchSavefromWorker(igUrl: unknown) {
  const res = await axios.get(SF_WORKER, {
    params : { url: igUrl, lang: 'id' },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Referer'   : 'https://savefrom.net/'
    },
    timeout: 25000
  })
  const data = res.data
  if (!data?.url?.length) throw new Error('worker: no urls')
  return parseSavefrom(data)
}

async function fetchCobalt(igUrl: unknown) {
  const res = await axios.post(COBALT_API, {
    url         : igUrl,
    vCodec      : 'h264',
    vQuality    : '720',
    aFormat     : 'mp3',
    isAudioOnly : false,
    isNoTTWatermark: true
  }, {
    headers: {
      'User-Agent'  : 'Mozilla/5.0',
      'Accept'      : 'application/json',
      'Content-Type': 'application/json'
    },
    timeout: 25000
  })

  const d = res.data
  if (d.status === 'error') throw new Error('cobalt: ' + d.text)
  if (d.status === 'picker') {

    return {
      title : '',
      thumb : '',
      videos: d.picker?.filter((p: unknown) => p.type === 'video').map((p: unknown) => ({ url: p.url, quality: '' })) || [],
      images: d.picker?.filter((p: unknown) => p.type === 'photo').map((p: unknown) => ({ url: p.url, quality: '' })) || []
    }
  }
  if (d.url) {
    return { title: '', thumb: '', videos: [{ url: d.url, quality: '720p' }], images: [] }
  }
  throw new Error('cobalt: unexpected response')
}

async function fetchDeline(igUrl: unknown) {
  const { data } = await axios.get(DELINE_API, {
    params : { url: igUrl },
    timeout: 30000
  })
  if (!data?.status || !data?.result) throw new Error('deline: no result')

  const media = data.result.media
  return {
    title : data.result.title || '',
    thumb : data.result.thumbnail || '',
    videos: (media?.videos || []).map((v: unknown) => ({ url: v, quality: '' })),
    images: (media?.images || []).map((i: unknown) => ({ url: i, quality: '' }))
  }
}

function parseSavefrom(data: unknown[]) {
  const result = { title: data.meta?.title || '', thumb: data.meta?.thumb || '', videos: [], images: [] }

  for (const item of (data.url || [])) {
    const url = item.url || ''
    if (!url) continue
    const ext = (item.ext || '').toLowerCase()

    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) ||
        /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) {
      result.images.push({ url, quality: item.s || '' })
    } else {
      result.videos.push({ url, quality: item.s || '' })

      result.videos.sort((a, b) => {
        const r = q => { const m = q.match(/(\d+)/); return m ? parseInt(m[1]) : 0 }
        return r(b.quality) - r(a.quality)
      })
    }
  }
  return result
}

async function fetchIG(igUrl: unknown) {
  const sources = [
    { name: 'SaveFrom',        fn: () => fetchSavefrom(igUrl) },
    { name: 'SaveFrom Worker', fn: () => fetchSavefromWorker(igUrl) },
    { name: 'Cobalt',          fn: () => fetchCobalt(igUrl) },
    { name: 'Deline',          fn: () => fetchDeline(igUrl) },
  ]

  for (const src of sources) {
    try {
      const result = await src.fn()
      if (result && (result.videos.length > 0 || result.images.length > 0)) {
        console.log(`[IG] ✅ Source: ${src.name}`)
        return result
      }
    } catch (e) {
      console.warn(`[IG] ❌ ${src.name}: ${(e as Error).message}`)
    }
  }
  return null
}

async function downloadBuf(url: string) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout     : 60000,
    headers     : {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
      'Referer'   : 'https://www.instagram.com/'
    },
    maxRedirects: 5
  })
  return Buffer.from(res.data)
}

const handler = async (m: any, { Morela, text, reply }: any) => {
  const url = text?.trim()

  if (!url) return reply(
    `╭──「 📸 *Instagram Downloader* 」\n` +
    `│\n│  Masukkan link Instagram!\n│\n` +
    `│  📌 *Contoh:*\n` +
    `│  .ig https://instagram.com/p/xxxxx\n` +
    `│  .ig https://instagram.com/reel/xxx\n│\n` +
    `│  ✦ Post • Reel • TV • Stories • Carousel\n│\n` +
    `╰─────────────────────`
  )

  const isIgUrl = /instagram\.com\/(p|reel|tv|stories|share\/reel)\//i.test(url) ||
                  /instagr\.am\//i.test(url)

  if (!isIgUrl) return reply(
    `╭──「 ❌ *Link Tidak Valid* 」\n│\n` +
    `│  Format: /p/xxx  /reel/xxx  /tv/xxx\n│\n` +
    `╰─────────────────────`
  )

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  const result = await fetchIG(url)

  if (!result || (result.videos.length === 0 && result.images.length === 0)) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return Morela.sendMessage(m.chat, {
      text:
        `╭──「 ❌ *Gagal Mengambil Media* 」\n│\n` +
        `│  Kemungkinan:\n` +
        `│  • Akun private\n│  • Post sudah dihapus\n` +
        `│  • Link tidak valid\n│  • Coba lagi beberapa saat\n│\n` +
        `╰─────────────────────`
    }, { quoted: m })
  }

  const total = result.videos.length + result.images.length

  await Morela.sendMessage(m.chat, {
    text:
      `╭──「 📸 *Instagram Downloader* 」\n│\n` +
      `│  🖼️ *Gambar* » ${result.images.length} file\n` +
      `│  🎬 *Video*  » ${result.videos.length} file\n` +
      `│  📦 *Total*  » ${total} media\n` +
      (result.title ? `│  📝 » ${result.title.slice(0, 45)}\n` : '') +
      `│\n╰─────────────────────`
  }, { quoted: m })

  let sent = 0

  for (let i = 0; i < result.images.length; i++) {
    try {
      const buf = await downloadBuf(result.images[i].url)
      await Morela.sendMessage(m.chat, {
        image  : buf,
        caption: result.images.length > 1 ? `🖼️ ${i+1}/${result.images.length} • © ${botName}` : `📸 © ${botName}`
      }, { quoted: m })
      sent++
    } catch {
      try {
        await Morela.sendMessage(m.chat, {
          image  : { url: result.images[i].url },
          caption: `📸 © ${botName}`
        }, { quoted: m })
        sent++
      } catch (e) { console.error('[IG img]', (e as Error).message) }
    }
  }

  for (let i = 0; i < result.videos.length; i++) {
    const vid = result.videos[i]
    try {
      const buf    = await downloadBuf(vid.url)
      const sizeMB = buf.length / (1024 * 1024)
      if (sizeMB > 100) {
        await Morela.sendMessage(m.chat, {
          text: `⚠️ Video ${i+1} terlalu besar (${sizeMB.toFixed(1)} MB)\n${vid.url}`
        }, { quoted: m })
        continue
      }
      await Morela.sendMessage(m.chat, {
        video   : buf,
        mimetype: 'video/mp4',
        caption : result.videos.length > 1
          ? `🎬 ${i+1}/${result.videos.length}${vid.quality ? ` • ${vid.quality}` : ''} • © ${botName}`
          : `🎬 © ${botName}`
      }, { quoted: m })
      sent++
    } catch {
      try {
        await Morela.sendMessage(m.chat, {
          video   : { url: vid.url },
          mimetype: 'video/mp4',
          caption : `🎬 © ${botName}`
        }, { quoted: m })
        sent++
      } catch (e) { console.error('[IG vid]', (e as Error).message) }
    }
  }

  await Morela.sendMessage(m.chat, {
    react: { text: sent > 0 ? '✅' : '❌', key: m.key }
  })

  if (sent === 0) {
    await Morela.sendMessage(m.chat, {
      text: `❌ Semua media gagal dikirim. Coba lagi atau gunakan link lain.`
    }, { quoted: m })
  }
}

handler.help    = ['ig <url>', 'instagram <url>']
handler.tags    = ['downloader']
handler.command = ['ig', 'instagram', 'igdl', 'insta']

export default handler
