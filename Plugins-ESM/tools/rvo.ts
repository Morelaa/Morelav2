import { downloadContentFromMessage } from "@itsliaaa/baileys"
import axios from "axios"
import FormData from "form-data"
import { getTgToken, getTgChatId } from "../../Library/tg_global.js"
import { kvGet, kvSet } from "../../Database/kvstore.js"

// ── Duplikat cache ──────────────────────────────────────────────
const _sentCache = new Set<string>()

function loadSentCache() {
  try {
    const arr = kvGet<string[]>('rvo_sent', 'list', [])
    for (const k of arr) _sentCache.add(k)
  } catch {}
}

function markSent(hash: string) {
  _sentCache.add(hash)
  try {
    kvSet('rvo_sent', 'list', [..._sentCache].slice(-500))
  } catch {}
}

loadSentCache()

// ── Kirim buffer ke Telegram ────────────────────────────────────
async function sendToTelegram(buffer: Buffer, type: string, mime: string, caption: string) {
  const token  = getTgToken()
  const chatId = getTgChatId()
  if (!token || !chatId) {
    console.log("[RVO] Skip — token/chatId belum diset")
    return
  }

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
    "video/mp4": "mp4", "video/quicktime": "mov",
    "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav",
    "application/pdf": "pdf"
  }
  const ext      = extMap[mime] || "bin"
  const fileName = `rvo_${Date.now()}.${ext}`

  const captionMap: Record<string, string> = {
    image:    caption || "📸 [RVO SPY] ViewOnce Foto dari WhatsApp",
    video:    caption || "🎥 [RVO SPY] ViewOnce Video dari WhatsApp",
    audio:    caption || "🎵 [RVO SPY] ViewOnce Audio dari WhatsApp",
    document: caption || "📄 [RVO SPY] ViewOnce Dokumen dari WhatsApp"
  }

  const fieldMap:    Record<string, string> = { image: "photo", video: "video", audio: "audio", document: "document" }
  const endpointMap: Record<string, string> = { image: "sendPhoto", video: "sendVideo", audio: "sendAudio", document: "sendDocument" }

  try {
    const form = new FormData()
    form.append("chat_id", chatId)
    form.append("caption", captionMap[type] || caption)
    form.append(
      fieldMap[type] || "document",
      buffer,
      { filename: fileName, contentType: mime }
    )

    await axios.post(
      `https://api.telegram.org/bot${token}/${endpointMap[type] || "sendDocument"}`,
      form,
      { headers: form.getHeaders(), maxBodyLength: Infinity, timeout: 60000 }
    )
    console.log("[RVO] ✅ Terkirim ke Telegram")
  } catch (e: any) {
    console.error("[RVO] ❌ Gagal kirim:", e?.response?.data?.description || e.message)
  }
}

// ── Download & kirim media ──────────────────────────────────────
async function processAndSend(media: any) {
  const mime = media.mimetype || ""
  let type: "image" | "video" | "audio" | "document" = "document"
  if (mime.startsWith("image/"))      type = "image"
  else if (mime.startsWith("video/")) type = "video"
  else if (mime.startsWith("audio/")) type = "audio"

  const hash = media.fileSha256
    ? Buffer.from(media.fileSha256).toString("base64")
    : null

  if (hash && _sentCache.has(hash)) {
    console.log("[RVO] Skip duplikat:", hash.slice(0, 10))
    return
  }

  let stream: any
  try {
    stream = await downloadContentFromMessage(media, type)
  } catch (e: any) {
    if (e.message?.includes("decrypt") || e.message?.includes("bad decrypt")) {
      console.log("[RVO] Media expired, skip")
      return
    }
    throw e
  }

  let buffer = Buffer.from([])
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])

  console.log(`[RVO] Download OK ${buffer.length} bytes → kirim ke Telegram...`)
  await sendToTelegram(buffer, type, mime, media.caption || "")
  if (hash) markSent(hash)
}

// ── Handler utama ───────────────────────────────────────────────
const handler = async (m: any, _ctx: any) => {
  if (!getTgToken() || !getTgChatId()) return

  try {
    const rawMsg = m.message

    // ══ MODE 1: View-once MASUK LANGSUNG ═══════════════════════
    // smsg set mtype = 'viewOnceMessage' / 'viewOnceMessageV2' / dll
    // m.msg sudah di-unwrap smsg → langsung berisi imageMessage/videoMessage
    if (
      m.mtype === 'viewOnceMessage' ||
      m.mtype === 'viewOnceMessageV2' ||
      m.mtype === 'viewOnceMessageV2Extension'
    ) {
      // m.msg sudah di-unwrap oleh smsg → berisi imageMessage / videoMessage langsung
      const media =
        m.msg?.imageMessage    ||
        m.msg?.videoMessage    ||
        m.msg?.audioMessage    ||
        m.msg?.documentMessage ||
        // fallback: baca langsung dari m.message jika belum di-unwrap
        rawMsg?.[m.mtype]?.message?.imageMessage    ||
        rawMsg?.[m.mtype]?.message?.videoMessage    ||
        rawMsg?.[m.mtype]?.message?.audioMessage    ||
        rawMsg?.[m.mtype]?.message?.documentMessage

      if (media) {
        console.log("[RVO] ✅ MODE 1 — view-once langsung, mtype:", m.mtype)
        await processAndSend(media)
        return
      }
    }

    // ══ MODE 2: Reply ke view-once ══════════════════════════════
    // smsg sudah unwrap m.quoted → berisi imageMessage/videoMessage langsung
    // quotedMessage raw di contextInfo juga masih tersedia
    if (!m.quoted) return

    // CARA A: pakai m.quoted yang sudah di-unwrap smsg
    // m.quoted.mtype = 'imageMessage', m.quoted berisi field imageMessage langsung
    const quotedMtype = m.quoted?.mtype as string | undefined

    if (quotedMtype === 'imageMessage' || quotedMtype === 'videoMessage' ||
        quotedMtype === 'audioMessage' || quotedMtype === 'documentMessage') {
      // m.quoted sudah IS the media object (smsg unwrap ke dalam)
      // tapi kita butuh raw media object dengan mimetype dll
      // ambil dari contextInfo quotedMessage langsung
      const ctxInfo =
        rawMsg?.extendedTextMessage?.contextInfo ||
        rawMsg?.imageMessage?.contextInfo        ||
        rawMsg?.videoMessage?.contextInfo        ||
        rawMsg?.audioMessage?.contextInfo        ||
        rawMsg?.documentMessage?.contextInfo     ||
        {}

      const quotedRaw = ctxInfo?.quotedMessage
      if (!quotedRaw) return

      // quotedRaw = { imageMessage: {...} } — ambil medianya
      const media =
        quotedRaw.viewOnceMessageV2?.message?.imageMessage    ||
        quotedRaw.viewOnceMessageV2?.message?.videoMessage    ||
        quotedRaw.viewOnceMessageV2?.message?.audioMessage    ||
        quotedRaw.viewOnceMessageV2?.message?.documentMessage ||
        quotedRaw.viewOnceMessageV2Extension?.message?.imageMessage ||
        quotedRaw.viewOnceMessageV2Extension?.message?.videoMessage ||
        quotedRaw.viewOnceMessage?.message?.imageMessage      ||
        quotedRaw.viewOnceMessage?.message?.videoMessage      ||
        quotedRaw.imageMessage    ||  // ← ini yang ketemu dari eval: quotedKeys = ["imageMessage"]
        quotedRaw.videoMessage    ||
        quotedRaw.audioMessage    ||
        quotedRaw.documentMessage

      if (media) {
        console.log("[RVO] ✅ MODE 2 — reply ke view-once, quotedMtype:", quotedMtype)
        await processAndSend(media)
      }
    }

  } catch (e) {
    console.error("[RVO] Error:", e)
  }
}

handler.tags = ['passive']

export default handler