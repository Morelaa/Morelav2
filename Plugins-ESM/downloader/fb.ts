import axios from 'axios'
import { buildFkontak, botName } from '../../Library/utils.js'

const BASE = 'https://fbdownloader.to'
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const SC_MAP: Record<string, string> = {
  a:'ᴀ', b:'ʙ', c:'ᴄ', d:'ᴅ', e:'ᴇ', f:'ꜰ', g:'ɢ', h:'ʜ', i:'ɪ',
  j:'ᴊ', k:'ᴋ', l:'ʟ', m:'ᴍ', n:'ɴ', o:'ᴏ', p:'ᴘ', q:'q', r:'ʀ',
  s:'ꜱ', t:'ᴛ', u:'ᴜ', v:'ᴠ', w:'ᴡ', x:'x', y:'ʏ', z:'ᴢ'
}
const sc         = (t: string) => t.toLowerCase().split('').map(c => SC_MAP[c] ?? c).join('')
const spacedBold = (t: string) => t.toUpperCase().split('').map(c =>
  c >= 'A' && c <= 'Z' ? String.fromCodePoint(0x1D400 + c.charCodeAt(0) - 65) : c
).join(' ')

async function getToken() {
  const res  = await axios.get(`${BASE}/id`, { headers: { 'User-Agent': UA }, timeout: 10000 })
  const html = res.data as string
  const k_exp   = html.match(/k_exp="(\d+)"/)?.[1]        || ''
  const k_token = html.match(/k_token="([a-f0-9]+)"/)?.[1] || ''
  if (!k_exp || !k_token) throw new Error('Gagal ambil token')
  return { k_exp, k_token }
}

async function fbDownload(url: string) {
  const { k_exp, k_token } = await getToken()
  const params = new URLSearchParams({ k_exp, k_token, p: 'home', q: url, lang: 'id', v: 'v2', w: '' })
  const res = await axios.post(`${BASE}/api/ajaxSearch`, params.toString(), {
    headers: {
      'Content-Type':     'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer':          `${BASE}/id`,
      'User-Agent':       UA,
    },
    timeout: 15000
  })
  const d = res.data as any
  if (d.status !== 'ok') throw new Error('Gagal fetch data video')
  const html  = d.data as string
  const title = html.match(/<h3>([^<]+)<\/h3>/)?.[1] || 'Facebook Video'
  const thumb = html.match(/img src="([^"&]+)/)?.[1]  || ''
  const rows  = [...html.matchAll(/<td class="video-quality">([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>\s*<a href="([^"]+)"/g)]
  const links = rows.map(m => ({ quality: m[1].trim(), url: m[3] }))
  return { title, thumb, links }
}

function pickBestLink(links: { quality: string; url: string }[]) {
  const priority = ['1080p', '720p', '480p', '360p']
  for (const p of priority) {
    const found = links.find(l => l.quality.includes(p))
    if (found) return found
  }
  return links[0]
}

const handler = async (m: any, { Morela, reply, text, fkontak }: any) => {
  const fk = fkontak || await buildFkontak(Morela)

  if (!text) return reply(
    `┌──「 ${spacedBold('fb dl')} 」\n` +
    `│\n` +
    `│  ✧ ${sc('cara pakai')} :\n` +
    `│    *.fb <link facebook>*\n` +
    `│\n` +
    `│  ✧ ${sc('contoh')} :\n` +
    `│    *.fb https://fb.watch/xxx*\n` +
    `│    *.fb https://facebook.com/share/r/xxx*\n` +
    `│\n` +
    `╰─────────────────────\n` +
    `_© ${botName}_`
  )

  if (!text.match(/facebook\.com|fb\.watch|fb\.me/i))
    return reply(`❌ ${sc('link tidak valid, masukkan link facebook yang benar.')}`)

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  let result: any
  try {
    result = await fbDownload(text.trim())
  } catch (e: any) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply(`❌ Gagal mengambil data: ${e.message}`)
  }

  if (!result.links.length) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply(`❌ ${sc('tidak ada link download ditemukan.')}`)
  }

  const best = pickBestLink(result.links)

  await reply(`📥 _${sc('mengunduh')} ${best.quality}..._`)

  let vidBuf: Buffer
  try {
    const r = await axios.get(best.url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': UA },
      timeout: 60000,
      maxContentLength: 200 * 1024 * 1024
    })
    vidBuf = Buffer.from(r.data)
  } catch (e: any) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply(`❌ Gagal download video: ${e.message}`)
  }

  await Morela.sendMessage(m.chat, {
    video:    vidBuf,
    mimetype: 'video/mp4',
    caption:
      `┌──「 ${spacedBold('fb dl')}   ◦   ${sc('selesai')} 」\n` +
      `│\n` +
      `│  ✧ ${sc('judul')}    : *${result.title}*\n` +
      `│  ✧ ${sc('kualitas')} : *${best.quality}*\n` +
      `│\n` +
      `╰─────────────────────\n` +
      `_© ${botName}_`
  }, { quoted: fk })

  await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
}

handler.help    = ['fb <link>']
handler.tags    = ['downloader']
handler.command = ['fb']

export default handler