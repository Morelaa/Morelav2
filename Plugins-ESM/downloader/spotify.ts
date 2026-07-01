import axios from 'axios'
import fs    from 'fs'
import path  from 'path'
import { botName } from '../../Library/utils.js'
import { canvasSpotify } from '../../Library/canvas-spotify.js'

const SHAZAM_SEARCH = 'https://www.shazam.com/services/amapi/v1/catalog/ID/search'
const FAA_PLAY      = 'https://api-faa.my.id/faa/ytplay'

const spotSessions = new Map()

const handler = async (m: any, { Morela, text, command, reply, fkontak }: any) => {

  if (command.startsWith('sptdl_')) {
    const idx     = parseInt(command.replace('sptdl_', '')) - 1
    const session = spotSessions.get(m.sender)
    if (!session) return reply('❌ Sesi kadaluarsa! Silakan cari lagi.')

    const track = session.results[idx]
    await Morela.sendMessage(m.chat, { react: { text: '📥', key: m.key } })

    try {
      const querySearch = `${track.title} ${track.artist}`
      const { data: resFaa } = await axios.get(FAA_PLAY, {
        params: { query: querySearch },
        timeout: 60000
      })

      if (!resFaa.status || !resFaa.result?.mp3)
        throw new Error('Gagal mendapatkan file audio dari server download.')

      const dlUrl  = resFaa.result.mp3
      const tempDir = path.join(process.cwd(), 'media', 'temp')
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

      const stamp    = Date.now()
      const audioPath = path.join(tempDir, `${stamp}.mp3`)
      const thumbPath = path.join(tempDir, `${stamp}_thumb.jpg`)

      const [audioRes, thumbRes] = await Promise.all([
        axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 180000 }),
        axios.get(track.thumbnail, { responseType: 'arraybuffer' }).catch(() => null)
      ])

      fs.writeFileSync(audioPath, Buffer.from(audioRes.data))
      const thumbBuffer = thumbRes ? Buffer.from(thumbRes.data) : null
      if (thumbBuffer) fs.writeFileSync(thumbPath, thumbBuffer)

      const sizeMB = fs.statSync(audioPath).size / 1024 / 1024

      await Morela.sendMessage(m.chat, { react: { text: '📤', key: m.key } })

      const { Button, Carousel } = await import('../../Library/MessageBuilder.js?v=' + Date.now())

      const cv   = new Carousel(Morela)
      cv.setBody(
        `🎵 *${track.title}*\n` +
        `👤 ${track.artist}\n` +
        `📊 ${sizeMB.toFixed(2)} MB`
      ).setFooter(`© ${botName}`)

      const card = new Button(Morela)
      if (thumbBuffer) card.setImage(thumbBuffer)
      else             card.setImage('https://i.ytimg.com/vi/default/maxresdefault.jpg')

      cv.addCard(await card.toCard())
      await cv.send(m.chat, { quoted: fkontak || m })

      await Morela.sendMessage(m.chat, {
        audio:    fs.readFileSync(audioPath),
        mimetype: 'audio/mpeg',
        fileName: `${track.title}.mp3`,
        contextInfo: {
          forwardingScore: 999,
          isForwarded:     true,
          forwardedNewsletterMessageInfo: {
            newsletterJid:   '120363420704282055@newsletter',
            newsletterName:  `🎵 ${track.title}`,
            serverMessageId: 143
          }
        }
      }, { quoted: m })

      await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath)
      if (thumbBuffer && fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath)
      spotSessions.delete(m.sender)

    } catch (e) {
      console.error(e)
      reply('❌ Gagal Download: ' + (e as Error).message)
    }
    return
  }

  if (!text?.trim()) return reply(`╭╌「 🎵 *Music Search* 」\n┃ Contoh: *.spotify multo*\n╰╌`)

  await Morela.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })

  try {
    const { data } = await axios.get(SHAZAM_SEARCH, {
      params: { types: 'songs', term: text.trim(), limit: 7 },
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    })

    const songs = data.results?.songs?.data
    if (!songs || songs.length === 0) return reply(`❌ Lagu *${text}* tidak ditemukan.`)

    const results = songs.map(s => ({
      title:     s.attributes.name,
      artist:    s.attributes.artistName,
      thumbnail: s.attributes.artwork.url.replace('{w}', '600').replace('{h}', '600'),
      url:       s.attributes.url
    }))

    spotSessions.set(m.sender, { results })
    setTimeout(() => spotSessions.delete(m.sender), 3 * 60 * 1000)

    const imgBuf = await canvasSpotify(results, text.trim())

    const { Button } = await import('../../Library/MessageBuilder.js')
    const btn = new Button(Morela)
    btn.setImage(imgBuf)
    btn.setBody(`╭╬「 🎵 *Music Search* 」\n┃ 🔍 *${text.trim()}*\n┃ Pilih lagu di bawah 👇\n╰╬\n\n© ${botName}`)
    btn.setFooter('Pencarian Akurat via Shazam Engine')
    results.forEach((t, i) => {
      btn.addReply(`${i + 1}. ${t.title}`.slice(0, 30), `.sptdl_${i + 1}`)
    })
    await btn.send(m.chat, { quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e) {
    console.error(e)
    reply('❌ Search Error: ' + (e as Error).message)
  }
}

handler.command = ['spotify', 'sptfy', 'sptdl_1', 'sptdl_2', 'sptdl_3', 'sptdl_4', 'sptdl_5', 'sptdl_6', 'sptdl_7']
handler.tags    = ['downloader']
handler.help    = ['spotify <judul lagu>']

export default handler
