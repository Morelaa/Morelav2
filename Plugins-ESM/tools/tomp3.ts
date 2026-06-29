import fs   from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

async function downloadMedia(Morela, quoted) {
  const downloaded = await Morela.downloadMediaMessage(quoted)
  if (!downloaded) throw new Error('downloadMediaMessage return null')

  if (Buffer.isBuffer(downloaded)) return downloaded
  if (downloaded instanceof Uint8Array) return Buffer.from(downloaded)

  const chunks = []
  if (typeof downloaded[Symbol.asyncIterator] === 'function') {
    for await (const chunk of downloaded) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  if (typeof downloaded.pipe === 'function') {
    return new Promise((res, rej) => {
      const parts = []
      downloaded.on('data', c => parts.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
      downloaded.on('end',  () => res(Buffer.concat(parts)))
      downloaded.on('error', rej)
    })
  }

  throw new Error('Format download tidak dikenali')
}

const handler = async (m, { Morela, reply, fkontak }) => {
  const quoted = m.quoted
  if (!quoted) return reply('❌ Reply ke video atau audio dulu!')

  const mtype = quoted.mtype || ''
  const mime  = quoted.message?.videoMessage?.mimetype
    || quoted.message?.audioMessage?.mimetype
    || quoted.message?.documentMessage?.mimetype
    || ''

  const isVideo = mtype === 'videoMessage' || mime.includes('video')
  const isAudio = mtype === 'audioMessage' || mime.includes('audio')

  if (!isVideo && !isAudio) return reply('❌ Reply ke video atau audio!')

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  const tempDir = path.join(process.cwd(), 'media', 'temp')
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

  const stamp      = Date.now()
  const inExt      = isAudio ? 'mp3' : 'mp4'
  const inputPath  = path.join(tempDir, `tomp3_in_${stamp}.${inExt}`)
  const outputPath = path.join(tempDir, `tomp3_out_${stamp}.mp3`)

  try {
    const mediaBuf = await downloadMedia(Morela, quoted)
    fs.writeFileSync(inputPath, mediaBuf)

    await execPromise(`ffmpeg -y -i "${inputPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outputPath}"`)

    if (!fs.existsSync(outputPath)) throw new Error('ffmpeg gagal menghasilkan file output')

    const sizeMB = fs.statSync(outputPath).size / 1024 / 1024
    if (sizeMB > 100) throw new Error('File terlalu besar (>100MB)')

    const title = quoted.message?.videoMessage?.caption
      || quoted.message?.documentMessage?.fileName?.replace(/\.[^/.]+$/, '')
      || 'audio'

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

    await Morela.sendMessage(m.chat, {
      audio:    fs.readFileSync(outputPath),
      mimetype: 'audio/mpeg',
      fileName: `${title}.mp3`,
      ptt:      false
    }, { quoted: fkontak || m })

  } catch (e) {
    console.error('[TOMP3]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {})
    await reply(`❌ Gagal convert: ${e.message}`)
  } finally {
    try { if (fs.existsSync(inputPath))  fs.unlinkSync(inputPath)  } catch {}
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) } catch {}
  }
}

handler.command = ['tomp3', 'mp3', 'videomp3']
handler.tags    = ['tools']
handler.help    = ['tomp3 (reply video/audio) — convert ke MP3']

export default handler
