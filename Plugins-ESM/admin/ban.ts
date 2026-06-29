import fs   from 'fs'
import { bi, buildFkontak, sendCard, menuBuf as defaultMenuBuf, CHANNEL_URL, imagePath, botName } from '../../Library/utils.js'
import { banUser, getUser, getUsers, getPushName } from '../../Database/db.js'
import { resolveTarget as resolveTargetUser, normNum } from '../../Library/resolve.js'

const handler = async (m: any, { Morela, command, args, senderJid, fkontak }: any) => {

  const imgBuf  = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : defaultMenuBuf
  const send    = (text) => sendCard(Morela, m.chat, text + `\n\n© ${botName}`, imgBuf, fkontak)

  if (command === 'banlist') {
    const usersRaw = getUsers()
    const banned   = Object.values(usersRaw).filter((u: unknown) => u.is_banned === 1)

    if (!banned.length) {
      return send(
        `🚫 *BAN LIST*\n\n` +
        `✅ Tidak ada user yang di-ban saat ini.`
      )
    }

    const list = banned.map((u, i) => {
      const num  = u.number || u.jid?.replace('@s.whatsapp.net', '') || '???'
      const nama = u.name || getPushName(num) || getPushName(u.jid || '') || 'User'
      return `│ ${i + 1}. +${num} — ${nama}`
    }).join('\n')

    return send(
      `🚫 *BAN LIST*\n\n` +
      `╭─────────────────────\n` +
      `${list}\n` +
      `╰─────────────────────\n\n` +
      `📊 Total banned: *${banned.length} user*`
    )
  }

  const targetJid = resolveTargetUser(m, args, { minDigits: 10 }).jid

  if (!targetJid) {
    const isBan = command === 'ban'
    return send(
      `${isBan ? '🚫' : '✅'} *${isBan ? 'Ban' : 'Unban'} User*\n\n` +
      `📌 *Cara pakai:*\n` +
      `╭─────────────────────\n` +
      `│ .${command} 628xxx\n` +
      `│ .${command} @mention\n` +
      `│ Reply pesan + .${command}\n` +
      `╰─────────────────────`
    )
  }

  const targetNum = normNum(targetJid)

  if (senderJid && targetJid === senderJid) {
    return send(`❌ Tidak bisa ban diri sendiri!`)
  }

  const userData    = getUser(targetJid)
  const namaTarget  = userData?.name || getPushName(targetNum) || getPushName(targetJid) || 'User'
  const sudahBanned = userData?.is_banned === 1

  if (command === 'ban') {
    if (sudahBanned) {
      return send(
        `⚠️ *Sudah Di-ban!*\n\n` +
        `📱 Nomor : +${targetNum}\n` +
        `👤 Nama  : ${namaTarget}\n\n` +
        `User ini sudah di-ban sebelumnya.\n` +
        `Gunakan *.unban* untuk mencabut ban.`
      )
    }

    banUser(targetJid, 1)

    return send(
      `🚫 *User Di-ban!*\n\n` +
      `╭─────────────────────\n` +
      `│ 📱 Nomor  : +${targetNum}\n` +
      `│ 👤 Nama   : ${namaTarget}\n` +
      `│ 🔒 Status : Banned\n` +
      `╰─────────────────────\n\n` +
      `User tidak bisa menggunakan bot lagi.\n` +
      `Gunakan *.unban* untuk mencabut.`
    )
  }

  if (command === 'unban') {
    if (!sudahBanned) {
      return send(
        `⚠️ *Tidak Di-ban!*\n\n` +
        `📱 Nomor : +${targetNum}\n` +
        `👤 Nama  : ${namaTarget}\n\n` +
        `User ini tidak sedang di-ban.`
      )
    }

    banUser(targetJid, 0)

    return send(
      `✅ *User Di-unban!*\n\n` +
      `╭─────────────────────\n` +
      `│ 📱 Nomor  : +${targetNum}\n` +
      `│ 👤 Nama   : ${namaTarget}\n` +
      `│ 🔓 Status : Aktif kembali\n` +
      `╰─────────────────────\n\n` +
      `User sudah bisa menggunakan bot lagi.`
    )
  }
}

handler.command = ['ban', 'unban', 'banlist']
handler.owner   = true
handler.tags    = ['owner']
handler.help    = ['ban <nomor/reply/mention>', 'unban <nomor/reply/mention>', 'banlist']
handler.noLimit = true

export default handler
