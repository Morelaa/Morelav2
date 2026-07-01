import path from 'path'
import yts  from 'yt-search'
import fs   from 'fs'
import { canvas } from '../../Library/canvas-yts.js'

const imagePath = path.join(process.cwd(), 'media/menu.jpg')
const BOT_JID   = '13135550002@s.whatsapp.net'
const botName   = global.botName || 'Morela'

async function buildFkontak(Morela: any) {
  const BOT_NUMBER = BOT_JID.split('@')[0]
  let Mekik: Buffer
  try {
    const pp  = await Morela.profilePictureUrl(BOT_JID, 'image')
    const res = await fetch(pp)
    Mekik = Buffer.from(await res.arrayBuffer())
  } catch {
    Mekik = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : Buffer.alloc(0)
  }
  return {
    key: { participant: '0@s.whatsapp.net', fromMe: false, id: 'StatusBiz', remoteJid: 'status@broadcast' },
    message: {
      contactMessage: {
        displayName: botName,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${botName}\nFN:${botName}\nORG:${botName};\nTEL;type=CELL;type=VOICE;waid=${BOT_NUMBER}:${BOT_NUMBER}\nEND:VCARD`,
        jpegThumbnail: Mekik,
      },
    },
  }
}

function formatNum(n: number) {
  if (!n) return '0'
  const num = parseInt(String(n).replace(/\D/g, '')) || 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B'
  if (num >= 1_000_000)     return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000)         return Math.floor(num / 1_000) + 'K'
  return num.toString()
}

const handler = async (m: any, { Morela, reply, text, fkontak }: any) => {
  if (!text) return reply('Contoh: .yts lady gaga')

  try {
    await Morela.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })

    const res       = await yts(text)
    const rawVideos = res.all.filter((v: any) => v.type === 'video')

    if (!rawVideos.length) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply('Tidak ditemukan hasil untuk: ' + text)
    }

    const videos = rawVideos.slice(0, 15).map((v: any) => ({
      title:    v.title        || 'Unknown Title',
      channel:  v.author?.name || 'Unknown',
      duration: v.timestamp    || '0:00',
      views:    v.views        || 0,
      ago:      v.ago          || '',
      url:      v.url,
      videoId:  v.videoId,
    }))

    const imageBuffer = await canvas(videos, text)
    const listVideos  = videos.slice(0, 9)
    const rows = listVideos.flatMap((v: any, idx: number) => [
      {
        header:      'Video ' + (idx + 1),
        title:       v.title.length > 40 ? v.title.slice(0, 37) + '...' : v.title,
        description: v.duration + '  •  ' + formatNum(v.views) + ' views  •  ' + (v.ago || ''),
        id:          '.ytmp4 ' + v.url,
      },
      {
        header:      'Audio ' + (idx + 1),
        title:       v.title.length > 40 ? v.title.slice(0, 37) + '...' : v.title,
        description: v.duration + '  •  ' + v.channel,
        id:          '.ytmp3 ' + v.url,
      },
    ])

    const top   = videos[0]
    const views = Number(top.views).toLocaleString('id-ID')
    const q     = text.charAt(0).toUpperCase() + text.slice(1)

    const caption =
`┌──「 *YouTube Search* 」
│
│  Kata kunci  » *${q}*
│  Ditemukan   » *${videos.length} video*
│
├──「 *Video Teratas* 」
│
│  Judul    » ${top.title.length > 35 ? top.title.slice(0, 33) + '..' : top.title}
│  Channel  » ${top.channel}
│  Durasi   » ${top.duration}
│  Ditonton » ${views} kali
│  Diupload » ${top.ago || '-'}
│
└─────────────────────
_Ketuk tombol untuk pilih video atau audio_ 👇`

    const { Button } = await import('../../Library/MessageBuilder.js')
    const btn = new Button(Morela)
    btn.setImage(imageBuffer)
    btn.setBody(caption)
    btn.setFooter('© Morela Bot')
    btn.addSelection('Pilih Video / Audio')
    btn.makeSection(
      'Hasil: ' + (text.length > 22 ? text.slice(0, 20) + '..' : text),
      'Top Results'
    )
    rows.forEach((r: any) => btn.makeRow(r.header, r.title, r.description, r.id))
    await btn.send(m.chat, { quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (err: any) {
    console.error('[YTS ERROR]', err)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {})
    reply('Error: ' + err.message)
  }
}

handler.help    = ['yts <judul lagu/video>']
handler.tags    = ['downloader']
handler.command = ['yts', 'ytsearch']

export default handler
