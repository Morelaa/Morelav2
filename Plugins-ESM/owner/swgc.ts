import fs     from 'fs'
import path   from 'path'
import crypto from 'crypto'
import { PassThrough } from 'stream'
import { fileURLToPath } from 'url'
import * as baileys from '@itsliaaa/baileys'
import { Button } from '../../Library/MessageBuilder.js'
import { botName, imagePath } from '../../Library/utils.js'

const { generateWAMessageContent, generateWAMessageFromContent } = baileys

const __filename = fileURLToPath(import.meta.url as string)
const __dirname  = path.dirname(__filename)

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface PendingData {
  rawContent: {
    text?:            string
    image?:           Buffer
    video?:           Buffer
    audio?:           Buffer
    caption?:         string
    mimetype?:        string
    ptt?:             boolean
    font?:            number
    backgroundColor?: string
  }
  tempFile?:  string
  timestamp:  number
}

export const pendingSwgc = new Map<string, PendingData>()

// ─────────────────────────────────────────
// CORE: Send Group Status
// generateWAMessageContent → generateWAMessageFromContent → relayMessage
// ─────────────────────────────────────────
async function sendGroupStatus(Morela: any, jid: string, content: Record<string, unknown>) {
  const backgroundColor = content.backgroundColor as string | undefined
  const contentCopy     = { ...content }
  delete contentCopy.backgroundColor

  const inside = await generateWAMessageContent(contentCopy as any, {
    upload:          Morela.waUploadToServer,
    backgroundColor: backgroundColor
  })

  const secret = crypto.randomBytes(32)
  const msg    = generateWAMessageFromContent(jid, {
    messageContextInfo: { messageSecret: secret },
    groupStatusMessageV2: {
      message: {
        ...inside,
        messageContextInfo: { messageSecret: secret }
      }
    }
  }, {})

  await Morela.relayMessage(jid, msg.message, { messageId: msg.key.id })
  return msg
}

// ─────────────────────────────────────────
// HELPER: audio → ogg opus
// ─────────────────────────────────────────
async function toOggOpus(buffer: Buffer): Promise<Buffer> {
  let ffmpeg: any
  try {
    const mod = await import('fluent-ffmpeg')
    ffmpeg    = mod.default
  } catch {
    return buffer
  }
  return new Promise((resolve, reject) => {
    const input  = new PassThrough()
    const output = new PassThrough()
    const chunks: Buffer[] = []
    input.end(buffer)
    ffmpeg(input)
      .noVideo()
      .audioCodec('libopus')
      .format('ogg')
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)))
      .pipe(output)
    output.on('data', (c: Buffer) => chunks.push(c))
  })
}

// ─────────────────────────────────────────
// HELPER: build content siap kirim
// ─────────────────────────────────────────
async function buildContent(raw: PendingData['rawContent']): Promise<Record<string, unknown>> {
  if (raw.image) return { image: raw.image, caption: raw.caption || '' }
  if (raw.video) return { video: raw.video, caption: raw.caption || '' }
  if (raw.audio) {
    const audioBuffer = await toOggOpus(raw.audio)
    return { audio: audioBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }
  }
  if (raw.text) {
    return {
      text:            raw.text,
      font:            raw.font ?? 0,
      backgroundColor: raw.backgroundColor ?? '#128C7E'
    }
  }
  return {}
}

function getMediaLabel(raw: PendingData['rawContent']): string {
  if (raw.text)  return 'Teks'
  if (raw.image) return 'Gambar'
  if (raw.video) return 'Video'
  if (raw.audio) return 'Audio'
  return 'Media'
}

function cleanupTemp(tempFile?: string) {
  if (!tempFile) return
  setTimeout(() => {
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile) } catch {}
  }, 5000)
}

// ─────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────
const handler = async (m: any, { Morela, args, text, reply, fkontak, command }: any) => {

  // ── CANCEL ──────────────────────────────
  if (command === 'cancelswgc') {
    const pending = pendingSwgc.get(m.sender)
    if (pending) {
      cleanupTemp(pending.tempFile)
      pendingSwgc.delete(m.sender)
    }
    return reply(`✅ *Posting story dibatalkan.*`)
  }

  // ── CONFIRM (dari interactive button) ───
  if (args[0] === '--confirm' && args[1]) {
    const targetGroupId = args[1]
    const pending       = pendingSwgc.get(m.sender)

    if (!pending) {
      return reply(`⚠️ *Tidak ada data pending.*\n\n_Silakan kirim ulang media + .swgc_`)
    }

    let groupName = 'Grup'
    try {
      const meta = await Morela.groupMetadata(targetGroupId)
      groupName  = meta.subject || 'Grup'
    } catch {}

    await Morela.sendMessage(m.chat, { react: { text: '🕕', key: m.key } })

    try {
      const content = await buildContent(pending.rawContent)
      await sendGroupStatus(Morela, targetGroupId, content)
      await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
      await reply(`✅ *Berhasil up story ke grup ${groupName}*`)
    } catch (err: any) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      await reply(
        `❌ *ᴇʀʀᴏʀ*\n\n` +
        `> Gagal posting story.\n` +
        `> _${err?.message || 'Unknown error'}_`
      )
    } finally {
      cleanupTemp(pending.tempFile)
      pendingSwgc.delete(m.sender)
    }
    return
  }

  // ── AMBIL MEDIA / TEKS ───────────────────
  const tempDir = path.join(process.cwd(), 'temp')
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

  let rawContent: PendingData['rawContent'] = {}
  let tempFile: string | undefined

  // cek quoted
  const qMsg = m.quoted
  if (qMsg) {
    const qType = qMsg.mtype || ''
    if (qType === 'imageMessage' || qType === 'videoMessage' || qType === 'audioMessage') {
      try {
        const buffer = await qMsg.download()
        if (!buffer) return reply(`❌ Gagal mengambil media dari pesan yang di-reply.`)
        const ext    = qType === 'imageMessage' ? 'jpg' : qType === 'videoMessage' ? 'mp4' : 'mp3'
        tempFile     = path.join(tempDir, `swgc_${Date.now()}.${ext}`)
        fs.writeFileSync(tempFile, buffer)
        if      (qType === 'imageMessage') { rawContent.image = buffer; rawContent.caption = text || qMsg.message?.imageMessage?.caption || '' }
        else if (qType === 'videoMessage') { rawContent.video = buffer; rawContent.caption = text || qMsg.message?.videoMessage?.caption || '' }
        else                               { rawContent.audio = buffer }
      } catch (e: any) {
        return reply(`❌ Gagal mengambil media.\n> _${e?.message}_`)
      }
    }
  }

  // cek pesan langsung
  if (!Object.keys(rawContent).length) {
    const mType = m.mtype || ''
    if (mType === 'imageMessage' || mType === 'videoMessage' || mType === 'audioMessage') {
      try {
        const buffer = await m.download()
        if (!buffer) return reply(`❌ Gagal mengambil media.`)
        const ext    = mType === 'imageMessage' ? 'jpg' : mType === 'videoMessage' ? 'mp4' : 'mp3'
        tempFile     = path.join(tempDir, `swgc_${Date.now()}.${ext}`)
        fs.writeFileSync(tempFile, buffer)
        if      (mType === 'imageMessage') { rawContent.image = buffer; rawContent.caption = text || m.msg?.caption || '' }
        else if (mType === 'videoMessage') { rawContent.video = buffer; rawContent.caption = text || m.msg?.caption || '' }
        else                               { rawContent.audio = buffer }
      } catch (e: any) {
        return reply(`❌ Gagal mengambil media.\n> _${e?.message}_`)
      }
    }
  }

  // cek teks
  if (!Object.keys(rawContent).length) {
    if (text && text.trim()) {
      rawContent.text            = text.trim()
      rawContent.font            = 0
      rawContent.backgroundColor = '#128C7E'
    } else {
      return reply(
        `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
        `> \`.swgc teks\`  — Story teks\n` +
        `> Reply gambar/video/audio + \`.swgc\`\n` +
        `> Kirim gambar/video/audio + caption \`.swgc\``
      )
    }
  }

  // ── KIRIM LANGSUNG KALAU DI GRUP ─────────
  const isFromGroup = m.chat?.endsWith('@g.us')
  if (isFromGroup) {
    await Morela.sendMessage(m.chat, { react: { text: '🕕', key: m.key } })
    try {
      const content = await buildContent(rawContent)
      await sendGroupStatus(Morela, m.chat, content)
      await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
    } catch (err: any) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      await reply(`❌ *Gagal post story.*\n> _${err?.message || 'Unknown error'}_`)
    } finally {
      cleanupTemp(tempFile)
    }
    return
  }

  // ── DM: simpan pending, tampilkan pilihan grup ─
  pendingSwgc.set(m.sender, { rawContent, tempFile, timestamp: Date.now() })

  try {
    global.isFetchingGroups = true
    const groups    = await Morela.groupFetchAllParticipating()
    global.isFetchingGroups = false
    const groupList = Object.entries(groups) as [string, any][]

    if (groupList.length === 0) {
      pendingSwgc.delete(m.sender)
      cleanupTemp(tempFile)
      return reply(`⚠️ *Bot tidak berada di grup manapun.*`)
    }

    const mediaLabel      = getMediaLabel(rawContent)
    const MAX_PER_SECTION = 10

    // ── Pakai Button dari MessageBuilder ─────
    let thumbnail: Buffer | undefined
    try {
      if (fs.existsSync(imagePath)) thumbnail = fs.readFileSync(imagePath)
    } catch {}

    const bodyText =
      `📋 *ᴘɪʟɪʜ ɢʀᴜᴘ ᴜɴᴛᴜᴋ ᴘᴏsᴛ sᴛᴏʀʏ*\n\n` +
      `> Media     : *${mediaLabel}*\n` +
      `> Total Grup: *${groupList.length}*\n\n` +
      `_Pilih grup dari daftar di bawah untuk posting story._`

    const btn = new Button(Morela)
      .setBody(bodyText)
      .setFooter(`© ${botName}`)

    if (thumbnail) btn.setImage(thumbnail)

    // build selection dengan semua grup
    btn.addSelection('🏠 Pilih Grup')

    for (let i = 0; i < groupList.length; i += MAX_PER_SECTION) {
      const slice     = groupList.slice(i, i + MAX_PER_SECTION)
      const sectionTitle = `Grup ${i + 1}–${Math.min(i + MAX_PER_SECTION, groupList.length)} dari ${groupList.length}`
      btn.makeSection(sectionTitle)
      for (const [id, meta] of slice) {
        btn.makeRow(
          meta.subject?.slice(0, 20) || 'Grup',
          (meta.subject || 'Unknown Group').slice(0, 40),
          id,
          `.swgc --confirm ${id}`
        )
      }
    }

    btn.addReply('❌ Batal', '.cancelswgc')

    await btn.send(m.chat, { quoted: fkontak || m })

  } catch (err: any) {
    global.isFetchingGroups = false
    await reply(
      `❌ *ᴇʀʀᴏʀ*\n\n` +
      `> Gagal mengambil daftar grup.\n` +
      `> _${err?.message || 'Unknown error'}_`
    )
    cleanupTemp(tempFile)
    pendingSwgc.delete(m.sender)
  }
}

handler.command  = ['swgc', 'statusgrup', 'swgroup', 'groupstory', 'toswgc', 'cancelswgc']
handler.owner    = false
handler.group    = false
handler.noLimit  = true
handler.tags     = ['tools']
handler.help     = ['swgc <teks>', 'swgc (reply media)']

export default handler
export { sendGroupStatus }