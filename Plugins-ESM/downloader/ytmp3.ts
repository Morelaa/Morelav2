import fs   from 'fs'
import path from 'path'
import axios from 'axios'
import { bi, CHANNEL_URL, imagePath, botName } from '../../Library/utils.js'

const FAA_BASE = 'https://api-faa.my.id/faa'

function extractVideoId(url: string) {
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
  return match ? match[1] : null
}

const handler = async (m: any, { Morela, reply, fkontak }: any) => {
  let url = ''

  const interactive = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (interactive?.paramsJson) {
    try {
      const parsed = JSON.parse(interactive.paramsJson)
      url = (parsed.id || '').replace(/^(\.ytmp3|\.yta|\.mp3)\s*/i, '').trim()
    } catch {}
  }

  if (!url && m.text) url = m.text.replace(/^(\.ytmp3|\.yta|\.mp3)\s*/i, '').trim()
  if (!url) return reply('📝 Contoh: *.ytmp3 <link YouTube>*')
  if (!url.match(/(youtube\.com|youtu\.be)/)) return reply('❌ Link YouTube tidak valid')

  await Morela.sendMessage(m.chat, { react: { text: '📥', key: m.key } })

  try {
    const videoId  = extractVideoId(url)
    const thumbUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : null

    let title   = 'YouTube Audio'
    let channel = 'Unknown'
    try {
      const oembed = await axios.get(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { timeout: 10000 }
      )
      title   = oembed.data.title       || title
      channel = oembed.data.author_name || channel
    } catch {}

    const res  = await axios.get(`${FAA_BASE}/ytmp3`, { params: { url }, timeout: 120000 })
    const data = res.data
    const dlUrl =
      data?.result?.mp3          ||
      data?.result?.download_url ||
      data?.result?.url          ||
      data?.download_url         ||
      data?.url                  ||
      data?.link                 ||
      data?.audio                ||
      null

    if (!dlUrl) throw new Error(`API tidak memberikan link download. Respon: ${JSON.stringify(data).slice(0, 150)}`)

    const tempDir  = path.join(process.cwd(), 'media', 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const stamp    = Date.now()
    const audioOut = path.join(tempDir, `${stamp}.mp3`)
    const thumbOut = path.join(tempDir, `${stamp}_thumb.jpg`)

    const audioRes = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 120000 })
    fs.writeFileSync(audioOut, Buffer.from(audioRes.data))

    const sizeMB = fs.statSync(audioOut).size / 1024 / 1024

    let thumbBuffer: Buffer | null = null
    if (thumbUrl) {
      try {
        const tr  = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 10000 })
        thumbBuffer = Buffer.from(tr.data)
        fs.writeFileSync(thumbOut, thumbBuffer)
      } catch {}
    }

    await Morela.sendMessage(m.chat, { react: { text: '📤', key: m.key } })

    const { Button, Carousel } = await import('../../Library/MessageBuilder.js?v=' + Date.now())

    const cv = new Carousel(Morela)
    cv.setBody(
      `🎵 *${title}*\n` +
      `👤 ${channel}\n` +
      `📊 ${sizeMB.toFixed(2)} MB`
    ).setFooter(`© ${botName}`)

    const card = new Button(Morela)

    if (thumbBuffer) {
      card.setImage(thumbBuffer)
    } else if (thumbUrl) {
      card.setImage(thumbUrl)
    } else {

      card.setImage('https://i.ytimg.com/vi/default/maxresdefault.jpg')
    }

    cv.addCard(await card.toCard())
    await cv.send(m.chat, { quoted: fkontak || m })   

    await Morela.sendMessage(m.chat, {
      audio:    fs.readFileSync(audioOut),
      mimetype: 'audio/mpeg',
      fileName: `${title}.mp3`,
      contextInfo: {
        forwardingScore: 999,
        isForwarded:     true,
        forwardedNewsletterMessageInfo: {
          newsletterJid:   '120363420704282055@newsletter',
          newsletterName:  `🎵 ${title}`,
          serverMessageId: 143,
        },
      },
    }, { quoted: m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

    fs.unlinkSync(audioOut)
    if (thumbBuffer && fs.existsSync(thumbOut)) fs.unlinkSync(thumbOut)

  } catch (e: any) {
    console.error('[YTMP3 ERROR]', e)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply('❌ Gagal download audio: ' + e.message)
  }
}

handler.command = ['ytmp3', 'yta', 'mp3']
handler.tags    = ['downloader']
handler.help    = ['ytmp3 <link YouTube>']

export default handler