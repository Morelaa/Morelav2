import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  bi, sendCard, imagePath, botName
} from '../../Library/utils.js'
import {
  setSewa, getSewa, delSewa, getAllSewa, resetReminders
} from '../../Database/sewagrub.js'
import { isMainOwner, normNum, isLidJid, resolveLidToPhone } from '../../Library/resolve.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url as string))

const BULAN: Record<string, number> = {
  januari: 1,   jan: 1,
  februari: 2,  feb: 2,
  maret: 3,     mar: 3,
  april: 4,     apr: 4,
  mei: 5,
  juni: 6,      jun: 6,
  juli: 7,      jul: 7,
  agustus: 8,   agt: 8,   aug: 8,
  september: 9, sep: 9,
  oktober: 10,  okt: 10,  oct: 10,
  november: 11, nov: 11,
  desember: 12, des: 12,  dec: 12,
}

function parseDate(text: string): Date | null {
  if (!text) return null
  const t = text.trim().toLowerCase()

  const m1 = t.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/)
  if (m1) {
    const day   = parseInt(m1[1])
    const month = BULAN[m1[2]]
    if (!month || day < 1 || day > 31) return null
    const yearExplicit = !!m1[3]
    const year  = yearExplicit ? parseInt(m1[3]) : new Date().getFullYear()
    const d = new Date(year, month - 1, day, 23, 59, 59, 999)
    if (!yearExplicit && d.getTime() < Date.now()) d.setFullYear(d.getFullYear() + 1)
    return d
  }

  const m2 = t.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/)
  if (m2) {
    const day   = parseInt(m2[1])
    const month = parseInt(m2[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const yearExplicit = !!m2[3]
    const year  = yearExplicit ? parseInt(m2[3]) : new Date().getFullYear()
    const d = new Date(year, month - 1, day, 23, 59, 59, 999)
    if (!yearExplicit && d.getTime() < Date.now()) d.setFullYear(d.getFullYear() + 1)
    return d
  }

  return null
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jakarta'
  })
}

function timeUntil(ts: number): string {
  const diff = ts - Date.now()
  if (diff <= 0) return '⚠️ Sudah expired'
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins  = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0)  return `${days} hari ${hours} jam lagi`
  if (hours > 0) return `${hours} jam ${mins} menit lagi`
  return `${mins} menit lagi`
}

const handler = async (m: any, { Morela, command, args, text, reply, isOwn, fkontak }: any) => {

  const rawSender = m.sender ?? ''
  const senderNum = isLidJid(rawSender)
    ? (resolveLidToPhone(rawSender) || normNum(rawSender))
    : normNum(rawSender)

  if (!isMainOwner(senderNum)) return

  const imgBuf = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null
  const send   = (txt: string) => imgBuf
    ? sendCard(Morela, m.chat, txt + `\n\n© ${botName}`, imgBuf, fkontak || m)
    : reply(txt)

  if (['sewabot', 'sewagrub', 'sewagrup'].includes(command)) {

    if (!text) return send(
      `╭──「 🔑 *Sewa Bot* 」\n` +
      `│\n` +
      `│  Atur tanggal bot otomatis keluar dari grup.\n` +
      `│\n` +
      `│  📌 *Format (di dalam grup):*\n` +
      `│  ┌──────────────────────────\n` +
      `│  │ .sewabot 7 april\n` +
      `│  │ .sewabot 7 april 2026\n` +
      `│  │ .sewabot 7/4/2026\n` +
      `│  └──────────────────────────\n` +
      `│\n` +
      `│  📌 *Format (dari mana saja):*\n` +
      `│  ┌──────────────────────────\n` +
      `│  │ .sewabot <groupid> 7 april\n` +
      `│  │ .sewabot 120363xxx@g.us 26 april\n` +
      `│  └──────────────────────────\n` +
      `│\n` +
      `│  🔒 Data PERMANEN — tidak terhapus .resetdb\n` +
      `│\n` +
      `╰─────────────────────`
    )

    let targetGroupId: string
    let dateText: string

    const firstArg = (text.trim().split(/\s+/)[0] ?? '')
    const isJidArg = firstArg.endsWith('@g.us') ||
                     /^\d{15,}$/.test(firstArg)  

    if (isJidArg) {

      targetGroupId = firstArg.endsWith('@g.us') ? firstArg : firstArg + '@g.us'
      dateText      = text.trim().slice(firstArg.length).trim()
    } else if (m.isGroup) {

      targetGroupId = m.chat
      dateText      = text.trim()
    } else {
      return send(
        `❌ *Harus di dalam grup atau sertakan Group ID!*\n\n` +
        `Contoh:\n` +
        `• .sewabot *120363xxx@g.us* 26 april\n` +
        `• .sewabot *120363xxx* 26 april`
      )
    }

    if (!dateText) return send(
      `❌ *Tanggal tidak boleh kosong!*\n\n` +
      `Contoh: .sewabot ${targetGroupId} *26 april*`
    )

    const expiry = parseDate(dateText)
    if (!expiry) return send(
      `❌ *Format tanggal tidak dikenali!*\n\n` +
      `Contoh yang valid:\n` +
      `• .sewabot <id> *7 april*\n` +
      `• .sewabot <id> *7 april 2026*\n` +
      `• .sewabot <id> *7/4/2026*\n\n` +
      `Nama bulan: januari, februari, maret, april,\n` +
      `mei, juni, juli, agustus, september, oktober,\n` +
      `november, desember`
    )

    if (expiry.getTime() <= Date.now()) return send(
      `❌ *Tanggal sudah lewat!*\n\n` +
      `Masukkan tanggal yang akan datang.`
    )

    const addedByNum = senderNum

    let groupName = targetGroupId
    try {
      const meta = await Morela.groupMetadata(targetGroupId)
      groupName  = meta?.subject ?? targetGroupId
    } catch {}

    const now = new Date()

    resetReminders(targetGroupId)

    setSewa({
      groupId:         targetGroupId,
      groupName,
      ownerJid:        m.sender,
      startDate:       now.toISOString().split('T')[0],
      expiryDate:      expiry.toISOString().split('T')[0],
      expiryTimestamp: expiry.getTime(),
      addedBy:         addedByNum,
    })

    return send(
      `✅ *Sewa Bot Berhasil Diset!*\n\n` +
      `📛 Grup     : ${groupName}\n` +
      `🔑 JID      : ${targetGroupId}\n` +
      `📅 Mulai    : ${formatDate(now.getTime())}\n` +
      `⏰ Expired  : ${formatDate(expiry.getTime())}\n` +
      `🕐 Sisa     : ${timeUntil(expiry.getTime())}\n\n` +
      `_Bot akan otomatis keluar dari grup ini_\n` +
      `_ketika tanggal expired tiba._\n\n` +
      `_🔒 Data ini tidak terhapus meski .resetdb_`
    )
  }

  if (['listsewabot', 'listsewagrub', 'listsewa'].includes(command)) {
    const all = Object.values(getAllSewa())
    if (all.length === 0) return send(
      `📋 *List Sewa Bot*\n\n` +
      `📭 Belum ada grup yang terdaftar sewa.\n\n` +
      `Tambahkan dengan:\n` +
      `• .sewabot <tanggal> (di dalam grup)`
    )

    let txt = `╭──「 📋 *List Sewa Bot* 」\n│\n`
    txt += `│  Total: *${all.length} grup*\n│\n`

    for (let i = 0; i < all.length; i++) {
      const s       = all[i]
      const expired = s.expiryTimestamp <= Date.now()
      const icon    = expired ? '⚠️' : '🟢'

      txt += `│  ${icon} *${i + 1}. ${s.groupName}*\n`
      txt += `│      ├ Expired : ${formatDate(s.expiryTimestamp)}\n`
      txt += `│      ├ Sisa    : ${timeUntil(s.expiryTimestamp)}\n`
      txt += `│      ├ Diset   : +${s.addedBy}\n`
      txt += `│      └ JID     : ${s.groupId}\n`
      if (i < all.length - 1) txt += `│\n`
    }

    txt += `│\n╰─────────────────────`
    return send(txt)
  }

  if (['ceksewabot', 'ceksewagrub', 'ceksewa'].includes(command)) {
    if (!m.isGroup) return reply('❌ Gunakan command ini di dalam grup!')

    const entry = getSewa(m.chat)
    if (!entry) return send(
      `ℹ️ *Grup ini tidak terdaftar sewa.*\n\n` +
      `Set dengan: .sewabot <tanggal>`
    )

    const expired = entry.expiryTimestamp <= Date.now()

    return send(
      `🔑 *Info Sewa Grup Ini*\n\n` +
      `📛 Nama     : ${entry.groupName}\n` +
      `📅 Mulai    : ${formatDate(new Date(entry.startDate + 'T00:00:00').getTime())}\n` +
      `⏰ Expired  : ${formatDate(entry.expiryTimestamp)}\n` +
      `🕐 Sisa     : ${timeUntil(entry.expiryTimestamp)}\n` +
      `👤 Diset by : +${entry.addedBy}\n\n` +
      `${expired
        ? '⚠️ _Status: EXPIRED — Bot akan segera keluar_'
        : '✅ _Status: Aktif — Bot akan keluar saat expired_'}`
    )
  }

  if (['delsewabot', 'delsewagrub', 'delsewa'].includes(command)) {

    let targetJid = text?.trim() || ''

    if (!targetJid) {
      if (!m.isGroup) return reply('❌ Kirim di dalam grup atau ketik:\n.delsewabot <group-jid>')
      targetJid = m.chat
    }

    if (!targetJid.endsWith('@g.us')) return send(
      `❌ *JID tidak valid!*\n\n` +
      `Format JID grup: 120363xxx@g.us\n\n` +
      `Atau kirim command ini di dalam grup tanpa argumen.`
    )

    const entry = getSewa(targetJid)
    if (!entry) return send(
      `⚠️ *Data sewa tidak ditemukan!*\n\n` +
      `JID: ${targetJid}\n\n` +
      `Cek daftar sewa dengan: .listsewabot`
    )

    delSewa(targetJid)

    return send(
      `🗑️ *Data Sewa Dihapus!*\n\n` +
      `📛 Grup : ${entry.groupName}\n` +
      `⏰ Was   : ${formatDate(entry.expiryTimestamp)}\n\n` +
      `Bot _tidak_ akan otomatis keluar dari grup ini.`
    )
  }
}

handler.command = [
  'sewabot', 'sewagrub', 'sewagrup',
  'listsewabot', 'listsewagrub', 'listsewa',
  'ceksewabot', 'ceksewagrub', 'ceksewa',
  'delsewabot', 'delsewagrub', 'delsewa',
]
handler.owner   = true
handler.tags    = ['owner']
handler.help    = [
  'sewabot <tanggal>',
  'listsewabot',
  'ceksewabot',
  'delsewabot [jid]',
]
handler.noLimit = true

export default handler
