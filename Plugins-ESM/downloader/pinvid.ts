/**
 * 📌 Pinterest Video
 * Disesuaikan untuk bot Morela
 */

import fetch from 'node-fetch'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { Button, Carousel } from '../../Library/MessageBuilder.js'
import { botName } from '../../Library/utils.js'

const execAsync = promisify(exec)

// Parse master m3u8 → ambil sub-m3u8 resolusi tertinggi
async function getBestSubM3u8(masterUrl: string): Promise<string> {
  const res  = await fetch(masterUrl)
  const text = await res.text()
  const base = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1)

  // Ambil semua baris STREAM-INF dan URL-nya
  const lines    = text.split('\n').map(l => l.trim()).filter(Boolean)
  let bestBw     = 0
  let bestSub    = ''

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
      const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/)
      const bw      = bwMatch ? parseInt(bwMatch[1]) : 0
      const subUrl  = lines[i + 1]
      if (subUrl && !subUrl.startsWith('#') && bw > bestBw) {
        bestBw  = bw
        bestSub = subUrl.startsWith('http') ? subUrl : base + subUrl
      }
    }
  }

  if (!bestSub) throw new Error('Tidak ada stream dalam m3u8')
  return bestSub
}

// Parse sub-m3u8 → dapat base URL file .cmfv dan .cmfa
async function getCmfUrls(subUrl: string): Promise<{ cmfv: string, cmfa: string | null }> {
  const res  = await fetch(subUrl)
  const text = await res.text()
  const base = subUrl.substring(0, subUrl.lastIndexOf('/') + 1)

  // Ambil EXT-X-MAP URI (file .cmfv)
  const mapMatch = text.match(/#EXT-X-MAP:URI="([^"]+)"/)
  if (!mapMatch) throw new Error('Tidak ada EXT-X-MAP di sub-m3u8')

  const cmfvFile = mapMatch[1]
  const cmfv     = cmfvFile.startsWith('http') ? cmfvFile : base + cmfvFile

  // Ambil audio .cmfa dari master (ganti _720w.m3u8 → _audio.cmfa pattern)
  const cmfa = cmfv.replace(/_\d+w\.cmfv$/, '_audio.cmfa')

  return { cmfv, cmfa }
}

// Download cmfv + cmfa lalu merge jadi mp4
async function downloadPinVideo(m3u8Url: string, outPath: string): Promise<void> {
  const subUrl         = await getBestSubM3u8(m3u8Url)
  const { cmfv, cmfa } = await getCmfUrls(subUrl)

  const tmpV = outPath + '_v.cmfv'
  const tmpA = outPath + '_a.cmfa'

  try {
    const [vRes, aRes] = await Promise.all([
      fetch(cmfv),
      cmfa ? fetch(cmfa).catch(() => null) : Promise.resolve(null)
    ])

    fs.writeFileSync(tmpV, Buffer.from(await vRes.arrayBuffer()))

    if (aRes) {
      fs.writeFileSync(tmpA, Buffer.from(await aRes.arrayBuffer()))
      await execAsync(
        `ffmpeg -y -loglevel error -i "${tmpV}" -i "${tmpA}" -c copy "${outPath}"`,
        { timeout: 60000 }
      )
    } else {
      // Tidak ada audio, video only
      await execAsync(
        `ffmpeg -y -loglevel error -i "${tmpV}" -c copy "${outPath}"`,
        { timeout: 60000 }
      )
    }
  } finally {
    if (fs.existsSync(tmpV)) fs.unlinkSync(tmpV)
    if (fs.existsSync(tmpA)) fs.unlinkSync(tmpA)
  }
}

const handler = async (m: any, { Morela, text, usedPrefix, command, reply, fkontak }: any) => {
  if (!text) return reply(
    `⚠️ *Contoh penggunaan:*\n${usedPrefix + command} [query]\n\n` +
    `*Contoh:*\n${usedPrefix + command} anime\n${usedPrefix + command} landscape video\n${usedPrefix + command} cooking tutorial`
  )

  await Morela.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })

  try {
    const query  = `${text} video`
    const apiUrl = `https://api.codeteam.web.id/api/v1/pinterest-search?query=${encodeURIComponent(query)}`

    const response = await fetch(apiUrl)
    const result   = await response.json() as any

    if (result.status !== 'success' || !result.data || result.data.length === 0)
      return reply('❌ *Tidak ditemukan video!* Coba dengan query lain.')

    const videoItems = result.data.filter((item: any) =>
      item.videoUrl &&
      item.videoUrl.includes('.m3u8') &&
      item.videoUrl !== 'gak ada'
    )

    if (videoItems.length === 0)
      return reply('❌ *Video tidak ditemukan!* Tidak ada video dalam hasil pencarian.')

    const picked = videoItems.sort(() => Math.random() - 0.5).slice(0, 5)

    const tempDir = path.join(process.cwd(), 'media', 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    await Morela.sendMessage(m.chat, { react: { text: '📥', key: m.key } })

    const cards: any[] = []

    for (const item of picked) {
      const outPath = path.join(tempDir, `pinvid_${Date.now()}.mp4`)
      try {
        await downloadPinVideo(item.videoUrl, outPath)

        if (!fs.existsSync(outPath)) continue

        const videoBuf = fs.readFileSync(outPath)
        fs.unlinkSync(outPath)

        const card = new Button(Morela)
        card.setVideo(videoBuf)
        card.setTitle(item.title?.trim() || 'Pinterest Video')
        card.setBody(
          `👤 ${item.pinner || 'Unknown'}\n` +
          `📋 ${item.boardName || '-'}`
        )
        card.setFooter(`© ${botName}`)

        cards.push(await card.toCard())
        if (cards.length >= 5) break
      } catch (e) {
        console.error('[PINVID] skip item:', e)
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath)
        continue
      }
    }

    if (cards.length === 0)
      return reply('❌ Semua video gagal diproses. Coba query lain.')

    await Morela.sendMessage(m.chat, { react: { text: '📤', key: m.key } })

    const cv = new Carousel(Morela)
    cv.setBody(`📌 *Hasil Pinterest Video*\n_Query: ${text}_`)
      .setFooter(`© ${botName}`)

    cv.addCard(cards)
    await cv.send(m.chat, { quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[PINVID ERROR]', e)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply('❌ *Terjadi kesalahan!* ' + e.message)
  }
}

handler.help     = ['pinvid <query>']
handler.tags     = ['search']
handler.command  = ['pinterestvideo', 'pinvid']
handler.limit    = true
handler.register = true

export default handler