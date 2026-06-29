// @ts-nocheck
import { downloadContentFromMessage } from "@itsliaaa/baileys"

// ─────────────────────────────────────────────
//  RVO2 — Read View-Once (Admin / Owner / Premium)
//  Akses: isOwn || isPrem || isAdmin
// ─────────────────────────────────────────────

const handler = async (
  m: any,
  { Morela, reply, isOwn, isPrem, isAdmin }: any
) => {

  // ── 1. Cek akses ──────────────────────────────
  const bisaAkses = isOwn || isPrem || isAdmin
  if (!bisaAkses) {
    return reply(
      `🔒 *Akses Ditolak!*\n\n` +
      `Fitur *rvo2* hanya bisa digunakan oleh:\n` +
      `│ 👑 Owner\n` +
      `│ ⭐ Premium\n` +
      `│ 🛡️ Admin Grup\n\n` +
      `_Hubungi owner untuk upgrade akun._`
    )
  }

  // ── 2. Ambil quoted message ────────────────────
  const ctxInfo =
    m.message?.extendedTextMessage?.contextInfo ||
    m.message?.imageMessage?.contextInfo        ||
    m.message?.videoMessage?.contextInfo        ||
    m.message?.documentMessage?.contextInfo     ||
    m.message?.audioMessage?.contextInfo        ||
    {}

  const quoted = ctxInfo.quotedMessage

  if (!quoted) {
    return reply(
      `❗ *Cara Pakai rvo2:*\n\n` +
      `Reply pesan *view-once* (foto / video / audio) lalu ketik:\n` +
      `*.rvo2*\n\n` +
      `_Pastikan kamu reply langsung ke pesan view-once._`
    )
  }

  // ── 3. Resolve pesan dari berbagai wrapper ─────
  const msg =
    quoted.viewOnceMessageV2?.message          ||
    quoted.viewOnceMessageV2Extension?.message ||
    quoted.viewOnceMessage?.message            ||
    quoted.ephemeralMessage?.message           ||
    quoted

  // ── 4. Ambil media ────────────────────────────
  const media =
    msg.imageMessage    ||
    msg.videoMessage    ||
    msg.audioMessage    ||
    msg.documentMessage

  if (!media) {
    return reply(
      `❌ *Media tidak ditemukan!*\n\n` +
      `Pastikan kamu reply langsung ke pesan *view-once*\n` +
      `bukan pesan biasa atau teks.`
    )
  }

  // ── 5. Tentukan tipe media ─────────────────────
  const mime = media.mimetype || ""
  let type: "image" | "video" | "audio" | "document" = "document"

  if      (mime.startsWith("image/"))  type = "image"
  else if (mime.startsWith("video/"))  type = "video"
  else if (mime.startsWith("audio/"))  type = "audio"

  // ── 6. Reaksi loading ─────────────────────────
  await Morela.sendMessage(m.chat, {
    react: { text: "⏳", key: m.key }
  })

  try {
    // ── 7. Download media ────────────────────────
    let stream
    try {
      stream = await downloadContentFromMessage(media, type)
    } catch (dlErr: any) {
      // Media sudah expired / bad decrypt
      if (
        dlErr.message?.includes("bad decrypt") ||
        dlErr.message?.includes("decrypt")
      ) {
        await Morela.sendMessage(m.chat, {
          react: { text: "❌", key: m.key }
        })
        return reply(
          `⚠️ *Media sudah kedaluwarsa!*\n\n` +
          `Pesan view-once ini sudah tidak bisa dibuka lagi\n` +
          `karena medianya sudah dihapus dari server WhatsApp.`
        )
      }
      throw dlErr
    }

    // ── 8. Konversi stream → buffer ──────────────
    let buffer = Buffer.from([])
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
    }

    // ── 9. Tentukan label pengirim ────────────────
    let labelRole = "🔓"
    if      (isOwn)   labelRole = "👑 Owner"
    else if (isPrem)  labelRole = "⭐ Premium"
    else if (isAdmin) labelRole = "🛡️ Admin"

    // ── 10. Kirim media ke chat ───────────────────
    await Morela.sendMessage(
      m.chat,
      {
        [type]: buffer,
        mimetype: mime,
        caption:
          (media.caption ? `📝 ${media.caption}\n\n` : "") +
          `🔓 *View-once dibuka oleh ${labelRole}*`
      },
      { quoted: m }
    )

    // ── 11. Reaksi sukses ─────────────────────────
    await Morela.sendMessage(m.chat, {
      react: { text: "✅", key: m.key }
    })

  } catch (e: any) {
    console.error("[RVO2]", e?.message || e)

    await Morela.sendMessage(m.chat, {
      react: { text: "❌", key: m.key }
    })

    return reply(
      `❌ *Gagal membuka view-once!*\n\n` +
      `Error: ${e?.message || "Unknown error"}`
    )
  }
}

// ─── Meta plugin ──────────────────────────────
handler.command = ["rvo2"]
handler.tags    = ["tools"]
handler.help    = ["rvo2 (reply pesan view-once)"]

// ⚠️ Tidak pakai handler.owner / .premium / .admin
// karena kombinasi OR ditangani manual di dalam handler.
// noLimit untuk owner & premium (user biasa bisa kena limit normal).
handler.noLimit = false

export default handler