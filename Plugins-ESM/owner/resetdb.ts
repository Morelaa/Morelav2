import { isMainOwner } from '../../Library/resolve.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { bi, sendCard, imagePath, botName, botVersion, CHANNEL_URL, OWNER_WA } from '../../Library/utils.js'
import { clearAllLimits, cancelPendingWrite } from '../../Database/usagelimit.js'
import { clearDBCache, cancelPendingWrites } from '../../Database/db.js'
import { getDB } from '../../Database/sqlite.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url as string))
const DATA_DIR  = path.join(__dirname, '../../data')

const PROTECTED = new Set(['Own.json', 'Prem.json', 'mainowner.json', 'SewaGrub.json'])
const PROTECTED_LABELS = ['own (kv_store)', 'prem (kv_store)', 'mainowner (kv_store)', 'sewagrub (tabel)']

const handler = async (m: any, { Morela, reply, fkontak }: any) => {
  const send = (text) => Morela.sendMessage(m.chat, { text }, { quoted: fkontak || m })

  if (!isMainOwner(m)) return send('❌ Fitur ini hanya untuk Main Owner!')

  try { cancelPendingWrites() } catch {}
  try { cancelPendingWrite()  } catch {}

  let allJsonFiles: string[] = []
  try {
    allJsonFiles = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json') && !PROTECTED.has(f))
      .sort()
  } catch (e) {
    return reply(`❌ Gagal membaca direktori data:\n${(e as Error).message}`)
  }

  const results: { file: string; ok: boolean; err?: string }[] = []
  let sukses = 0, gagal = 0

  for (const file of allJsonFiles) {
    const filePath = path.join(DATA_DIR, file)
    try {
      fs.writeFileSync(filePath, '{}', 'utf-8')
      results.push({ file, ok: true })
      sukses++
    } catch (e) {
      results.push({ file, ok: false, err: (e as Error).message })
      gagal++
    }
  }

  // ── reset tabel SQLite (pengganti file json yang dulu kena wipe juga) ──────
  // Tetap dijaga (setara PROTECTED file lama): own, prem, mainowner (kv_store),
  // sama tabel sewagrub (dulu SewaGrub.json).
  const sqliteResults: { table: string; ok: boolean; err?: string }[] = []
  try {
    const db = getDB()
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM users').run()
      db.prepare('DELETE FROM groups').run()
      db.prepare('DELETE FROM lidmap').run()
      db.prepare('DELETE FROM pushname').run()
      db.prepare('DELETE FROM stats_commands').run()
      db.prepare('DELETE FROM stats_users').run()
      db.prepare('DELETE FROM stats_hours').run()
      db.prepare('DELETE FROM stats_days').run()
      db.prepare('DELETE FROM stats_meta').run()
      db.prepare('DELETE FROM chat_counts').run()
      db.prepare(`DELETE FROM kv_store WHERE store NOT IN ('own', 'prem', 'mainowner')`).run()
    })
    tx()
    for (const t of ['users', 'groups', 'lidmap', 'pushname', 'stats_*', 'chat_counts', 'kv_store']) {
      sqliteResults.push({ table: t, ok: true })
    }
  } catch (e) {
    sqliteResults.push({ table: 'morela.db', ok: false, err: (e as Error).message })
  }

  try { clearAllLimits() } catch {}
  try { clearDBCache()   } catch {}

  let txt = `*╔══〔 🧹 ʀᴇꜱᴇᴛ ᴅᴀᴛᴀʙᴀꜱᴇ 〕══╗*\n\n`

  txt += `*📂 ꜰɪʟᴇ ᴊꜱᴏɴ ᴅɪʀᴇꜱᴇᴛ (${sukses + gagal} ꜰɪʟᴇ):*\n`
  results.forEach((r, i) => {
    const num  = String(i + 1).padStart(2, '0')
    const icon = r.ok ? '✅' : '❌'
    txt += `◦❒ ${bi(num)}. ${icon} ${bi(r.file)}${!r.ok ? `\n        ↳ ${r.err}` : ''}\n`
  })

  txt += `\n*🗄️ ᴛᴀʙᴇʟ sqlite ᴅɪʀᴇꜱᴇᴛ (${sqliteResults.filter(r => r.ok).length}):*\n`
  sqliteResults.forEach((r, i) => {
    const num  = String(i + 1).padStart(2, '0')
    const icon = r.ok ? '✅' : '❌'
    txt += `◦❒ ${bi(num)}. ${icon} ${bi(r.table)}${!r.ok ? `\n        ↳ ${r.err}` : ''}\n`
  })

  txt += `\n*🔒 ᴅɪᴊᴀɢᴀ (ᴛɪᴅᴀᴋ ᴅɪᴜʙᴀʜ):*\n`
  PROTECTED_LABELS.forEach((f, i) => {
    txt += `◦❒ ${bi(String(i + 1).padStart(2, '0'))}. 🔒 ${bi(f)}\n`
  })

  txt += `\n*╔══〔 📊 ʀᴇᴋᴀᴘ 〕══╗*\n`
  txt += `◦❒ ꜱᴜᴋꜱᴇꜱ : ${bi(String(sukses))} ꜰɪʟᴇ\n`
  txt += `◦❒ ɢᴀɢᴀʟ   : ${bi(String(gagal))} ꜰɪʟᴇ\n`
  txt += `*╚══════════════════╝*\n\n`
  txt += `✅ _Cache RAM sudah otomatis di-clear. Tidak perlu restart bot!_`

  const imgBuf = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null
  const quoted = fkontak || m

  try {
    if (imgBuf) {

      await sendCard(Morela, m.chat, txt, imgBuf, quoted)
    } else {

      await Morela.sendMessage(m.chat, {
        text: ' ',
        footer: txt,
        interactiveButtons: [{
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: 'Chat Owner',
            url:          OWNER_WA,
            merchant_url: OWNER_WA
          })
        }],
        hasMediaAttachment: false
      }, { quoted })
    }
  } catch {

    reply(
      `🧹 *RESET DATABASE SELESAI*\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📂 File JSON (game):\n` +
      results.map(r => r.ok ? `✅ ${r.file}` : `❌ ${r.file} — ${r.err}`).join('\n') +
      `\n\n🗄️ Tabel SQLite:\n` +
      sqliteResults.map(r => r.ok ? `✅ ${r.table}` : `❌ ${r.table} — ${r.err}`).join('\n') +
      `\n━━━━━━━━━━━━━━━\n` +
      `📊 Sukses: ${sukses} | Gagal: ${gagal}\n\n` +
      `🔒 Dijaga: ${PROTECTED_LABELS.join(', ')}\n\n` +
      `✅ Cache RAM sudah otomatis di-clear. Tidak perlu restart!`
    )
  }
}

handler.help    = ['resetdb']
handler.tags    = ['owner']
handler.command = ['resetdb', 'resetcache', 'clrdb']
handler.mainOwner = true
handler.noLimit = true

export default handler
