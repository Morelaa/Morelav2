import * as crypto from 'crypto'
import { kvGet, kvSet } from '../../Database/kvstore.js'

function loadDB() {
  try { return kvGet('sticker_cmd', 'data', {}) } catch {}
  return {}
}

function saveDB(data: unknown[]) {
  try {
    kvSet('sticker_cmd', 'data', data)
    import('./stikertiger.js').then((m: unknown) => m.invalidateStickerCmdCache?.()).catch(() => {})
  } catch {}
}

async function downloadQuoted(m: Record<string, unknown>, downloadContentFromMessage: unknown) {
  if (!m.quoted || m.quoted.mtype !== 'stickerMessage') {
    return { error: '❌ Reply stiker dulu!' }
  }
  try {
    const stream = await downloadContentFromMessage(m.quoted, 'sticker')
    const chunks = []
    for await (const c of stream) chunks.push(c)
    const buffer = Buffer.concat(chunks)
    if (!buffer.length) return { error: '❌ Stiker kosong, coba lagi!' }
    const sha256hex = crypto.createHash('sha256').update(buffer).digest('hex')
    return { buffer, sha256hex }
  } catch (e) {
    return { error: `❌ Gagal download stiker: ${(e as Error).message}` }
  }
}

const handler = async (m: any, { Morela, args, reply, fkontak, downloadContentFromMessage }: any) => {
  const sub = args[0]?.toLowerCase()
  const botName = global.botName || 'Morela'

  if (sub === 'list') {
    const db      = loadDB()
    const entries = Object.entries(db)
    if (!entries.length) return reply(
      `╭╌「 🎴 *Stiker Command* 」\n` +
      `┃ ❌ Belum ada stiker terdaftar!\n` +
      `┃\n` +
      `┃ Cara daftar:\n` +
      `┃ Reply stiker + .stikercmd ping\n` +
      `╰╌\n\n© ${botName}`
    )

    let text = `╭╌「 🎴 *Stiker Command List* 」\n`
    text    += `┃ 📊 Total: *${entries.length} stiker*\n┃\n`
    entries.forEach(([hash, cmd], i) => {
      text += `┃ ${i + 1}. *.${cmd}* → \`${hash.slice(0, 12)}...\`\n`
    })
    text += `╰╌\n\n© ${botName}`
    return reply(text)
  }

  if (sub === 'del' || sub === 'hapus') {
    const { sha256hex, error } = await downloadQuoted(m, downloadContentFromMessage)
    if (error) return reply(error)

    const db = loadDB()
    if (!db[sha256hex]) return reply(
      `⚠️ Stiker ini belum terdaftar di DB!\n` +
      `Hash: \`${sha256hex.slice(0, 16)}...\``
    )

    const cmd = db[sha256hex]
    delete db[sha256hex]
    saveDB(db)

    return reply(
      `╭╌「 🗑️ *Stiker Dihapus* 」\n` +
      `┃ ✅ Berhasil dihapus!\n` +
      `┃ ◦ Command : *.${cmd}*\n` +
      `┃ ◦ Hash    : \`${sha256hex.slice(0, 16)}...\`\n` +
      `╰╌\n\n© ${botName}`
    )
  }

  if (!sub) return reply(
    `╭╌「 🎴 *Stiker Command* 」\n` +
    `┃\n` +
    `┃ *Daftarkan stiker:*\n` +
    `┃ Reply stiker + .stikercmd ping\n` +
    `┃ Reply stiker + .stikercmd menu\n` +
    `┃\n` +
    `┃ *Hapus stiker:*\n` +
    `┃ Reply stiker + .stikercmd del\n` +
    `┃\n` +
    `┃ *Lihat semua:*\n` +
    `┃ .stikercmd list\n` +
    `┃\n` +
    `┃ ⚠️ _Hanya owner yang bisa register_\n` +
    `╰╌\n\n© ${botName}`
  )

  const { sha256hex, error } = await downloadQuoted(m, downloadContentFromMessage)
  if (error) return reply(error)

  const db      = loadDB()
  const isUpdate = !!db[sha256hex]
  const oldCmd   = db[sha256hex]

  db[sha256hex] = sub
  saveDB(db)

  return reply(
    `╭╌「 🎴 *Stiker ${isUpdate ? 'Diupdate' : 'Terdaftar'}!* 」\n` +
    `┃\n` +
    `┃ ✅ *Berhasil!*\n` +
    (isUpdate ? `┃ ◦ Sebelum  : *.${oldCmd}*\n` : '') +
    `┃ ◦ Command  : *.${sub}*\n` +
    `┃ ◦ Hash     : \`${sha256hex.slice(0, 16)}...\`\n` +
    `┃\n` +
    `┃ _Kirim stiker itu → bot auto .${sub}!_\n` +
    `╰╌\n\n© ${botName}`
  )
}

handler.command  = ['stikercmd', 'regstiker', 'stickerreg']
handler.owner    = true
handler.tags     = ['tools']
handler.help     = ['stikercmd <command>', 'stikercmd del', 'stikercmd list']
handler.noLimit  = true

export default handler
