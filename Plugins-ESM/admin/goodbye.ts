import { getGroup, updateGroup, getPushName } from '../../Database/db.js'
import { ButtonV2 } from '../../Library/MessageBuilder.js'
import { toPhoneJid, isLidJid, resolveLidToPhone, normNum, findParticipant } from '../../Library/resolve.js'

const botName = global.botname || 'Morela'

// Wrapper tipis di atas toPhoneJid: tetap tolak JID grup (@g.us), karena
// goodbye.ts dipakai untuk JID member yang keluar, bukan JID grup.
function sanitizeJid(jid: string | null | undefined): string | null {
  if (!jid || typeof jid !== 'string') return null
  const t = jid.trim()
  if (!t || t.endsWith('@g.us')) return null
  return toPhoneJid(t)
}

export async function sendGoodbye(
  Morela,
  groupJid,
  memberJid,
  groupName,
  memberCount,
  pushname,
  phoneNumberHint = null
) {
  const safeJid = sanitizeJid(memberJid)
  if (!safeJid) {
    console.warn('[GOODBYE] JID tidak valid, skip:', memberJid)
    return
  }

  const _rawLidNum = memberJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
  const _isLid     = isLidJid(memberJid)

  let _phone = _isLid ? resolveLidToPhone(memberJid) : null

  if (!_phone && phoneNumberHint) {
    _phone = String(phoneNumberHint).replace(/[^0-9]/g, '') || null
  }

  if (!_phone && _isLid) {
    try {
      const _meta = await Morela.groupMetadata(groupJid)
      const _part = findParticipant(_meta?.participants, memberJid)
      if (_part) {
        const _pn = (_part as any).phoneNumber
        if (_pn) _phone = String(_pn).replace(/[^0-9]/g, '') || null
      }
    } catch (e) {
      console.warn('[GOODBYE] groupMetadata fallback gagal:', (e as Error).message)
    }
  }

  const userNum  = _phone ? _phone : (_isLid ? _rawLidNum : normNum(safeJid))
  const phoneJid = _phone ? `${_phone}@s.whatsapp.net` : safeJid

  const username =
    (typeof pushname === 'string' && pushname.trim() ? pushname.trim() : null) ||
    getPushName(memberJid)                                                      ||
    getPushName(_rawLidNum)                                                     ||
    (_phone ? getPushName(`${_phone}@s.whatsapp.net`) : null)                  ||
    (_phone ? getPushName(_phone) : null)                                       ||
    userNum

  const bodyText =
    `Sampai jumpa @${userNum} 👋\n\n` +
    `Semoga ketemu lagi di grup *${groupName}* 🌸` +
    (username && username !== userNum ? `\nNama: *${username}*` : '')

  try {
    let ppUrl: string | null = null
    try {
      ppUrl = await Morela.profilePictureUrl(safeJid, 'image')
    } catch {}

    const ppThumb: string | null = ppUrl || 'https://cdn.ornzora.eu.cc/92fb27b5-5ffd-4f5f-905a-9b8d0573a1af-upload-1780208822400.jpg'

    const btn = new ButtonV2(Morela)
      .setTitle(groupName)
      .setSubtitle(`👥 Sisa ${memberCount} member`)
      .setBody(bodyText)
      .setFooter(`© ${botName}`)
      .setContextInfo({ mentionedJid: [phoneJid] })

    if (ppThumb) btn.setThumbnail(ppThumb)

    btn.addButton('Menu', '.menu')
    btn.addButton('Profil', `.userinfo ${userNum}`)

    const msg = await btn.build(groupJid, { userJid: Morela.user?.id })
    await Morela.relayMessage(groupJid, msg.message, { messageId: msg.key.id })

    console.log(`[GOODBYE] ✅ ${username} (@${userNum}) | pp=${!!ppUrl}`)
  } catch (e) {
    console.error('[GOODBYE] ButtonV2 error:', (e as Error).message)
    try {
      await Morela.sendMessage(groupJid, { text: bodyText, mentions: [phoneJid] })
    } catch {}
  }
}

const handler = async (m, { Morela, args, reply }) => {
  const from       = m.chat
  const mode       = (args[0] || '').toLowerCase()
  const hasMention = m.mentionedJid?.length > 0

  if (!hasMention) {
    const groupData = getGroup(from) || {}
    const current   = groupData.goodbye || false

    if (!mode || mode === 'status' || mode === 'cek') {
      return reply(
        `👋 *GOODBYE STATUS*\n\n` +
        `Goodbye : ${current ? '🟢 AKTIF' : '🔴 NONAKTIF'}\n\n` +
        `• *.goodbye on/off* — atur goodbye\n` +
        `• *.goodbye @tag* — test manual`
      )
    }
    if (mode === 'on') {
      if (current) return reply('⚠️ Goodbye sudah aktif!')
      updateGroup(from, { goodbye: true })
      return reply('✅ *Goodbye Diaktifkan!* 👋')
    }
    if (mode === 'off') {
      if (!current) return reply('⚠️ Goodbye sudah nonaktif!')
      updateGroup(from, { goodbye: false })
      return reply('✅ *Goodbye Dinonaktifkan!*')
    }
    return reply('❌ Gunakan: .goodbye on / off / status / @tag')
  }

  try {
    const groupMeta   = await Morela.groupMetadata(from)
    const groupName   = groupMeta.subject || 'Group'
    const memberCount = groupMeta.participants?.length || 0
    const targetJid   = m.mentionedJid[0]
    const safeTarget  = sanitizeJid(targetJid)
    if (!safeTarget) return reply('❌ JID target tidak valid!')

    const participant = findParticipant(groupMeta.participants, safeTarget)
    const pushname    = participant?.notify || participant?.name || null

    await sendGoodbye(Morela, from, safeTarget, groupName, memberCount, pushname)
    reply('✅ Goodbye test terkirim!')
  } catch (e) {
    console.error('[GOODBYE CMD ERROR]', (e as Error).message)
    reply(`❌ Error: ${(e as Error).message}`)
  }
}

handler.help    = ['goodbye on', 'goodbye off', 'goodbye @tag']
handler.tags    = ['group']
handler.command = ['goodbye', 'testgoodbye', 'setgoodbye']
handler.group   = true
handler.admin   = true
handler.noLimit = true

export default handler
