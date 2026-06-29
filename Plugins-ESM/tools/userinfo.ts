import axios from 'axios'
import fs    from 'fs'
import path  from 'path'
import { getUser, getPhoneByLid, getLidByPhone, isRegistered, getPushName } from '../../Database/db.js'
import { kvGet } from '../../Database/kvstore.js'
import { botName, imagePath, CHANNEL_URL } from '../../Library/utils.js'

function resolveLid(rawJid) {
  if (!rawJid || !rawJid.endsWith('@lid')) return null
  const lidNum = rawJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
  const phone  = getPhoneByLid(lidNum)
  return phone ? phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null
}

function sanitizeJid(jid) {
  if (!jid || typeof jid !== 'string') return null
  const t = jid.trim()
  if (!t || t.endsWith('@g.us') || t.endsWith('@lid')) return null
  if (t.endsWith('@s.whatsapp.net')) return t
  const num = t.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
  return num && num.length >= 5 ? num + '@s.whatsapp.net' : null
}

function resolveTarget(m, args, senderJid) {
  if (m.quoted) {
    const raw = m.quoted.sender || m.quoted.key?.participant || m.quoted.key?.remoteJid
    if (raw) {
      const qName = m.quoted.pushName || m.quoted.name || null
      if (raw.endsWith('@lid')) {
        const j = resolveLid(raw)
        if (j) return { jid: j, quotedPushName: qName }
        const d = raw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
        if (d && d.length >= 5) return { jid: d + '@s.whatsapp.net', quotedPushName: qName }
      } else {
        const j = sanitizeJid(raw)
        if (j) return { jid: j, quotedPushName: qName }
      }
    }
  }
  if (m.mentionedJid?.[0]) {
    const raw = m.mentionedJid[0]
    if (raw.endsWith('@lid')) {
      const j = resolveLid(raw)
      if (j) return { jid: j, quotedPushName: null }
      const d = raw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
      if (d && d.length >= 5) return { jid: d + '@s.whatsapp.net', quotedPushName: null }
    } else {
      const j = sanitizeJid(raw)
      if (j) return { jid: j, quotedPushName: null }
    }
  }
  if (args[0]) {
    const n = args[0].replace(/[^0-9]/g, '')
    if (n.length >= 8) return { jid: n + '@s.whatsapp.net', quotedPushName: null }
  }
  return { jid: senderJid || sanitizeJid(m.sender), quotedPushName: null }
}

function findParticipant(participants, num) {
  if (!participants?.length || !num) return null
  return participants.find(p => {
    const pId = p.id || ''
    if (pId.endsWith('@lid')) {
      const lidNum  = pId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
      const phone   = getPhoneByLid(lidNum)
      if (phone) return phone.replace(/[^0-9]/g, '') === num
      return lidNum === num
    }
    return pId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') === num
  }) ?? null
}

async function resolveName(Morela, m, targetJid, num, quotedPushName, isSelf, participants) {
  const store = (globalThis).__botStore__

  if (store?.groupMetadata && m.isGroup) {
    const gmParticipants = store.groupMetadata[m.chat]?.participants
    if (gmParticipants?.length) {
      const p = findParticipant(gmParticipants, num)
      const n = p?.notify || p?.name || p?.verifiedName
      if (typeof n === 'string' && n.trim()) return n.trim()
    }
  }

  if (store?.contacts) {
    const candidates = [targetJid, num + '@s.whatsapp.net', num + '@c.us']
    for (const c of candidates) {
      const contact = store.contacts[c]
      const n = contact?.notify || contact?.name || contact?.verifiedName
      if (typeof n === 'string' && n.trim()) return n.trim()
    }
  }

  const _lidForTarget = getLidByPhone(num)
  const _lidNum       = _lidForTarget ? _lidForTarget.split('@')[0] : null
  const dbName =
    (_lidNum ? getPushName(_lidNum) : null)          ||
    getPushName(num)                                 ||
    getPushName(targetJid)                           ||
    getPushName(num + '@s.whatsapp.net')
  if (typeof dbName === 'string' && dbName.trim()) return dbName.trim()

  if (participants?.length) {
    const p = findParticipant(participants, num)
    const n = p?.notify || p?.name
    if (typeof n === 'string' && n.trim()) return n.trim()
  }

  if (quotedPushName?.trim()) return quotedPushName.trim()

  if (typeof m.pushName === 'string' && m.pushName.trim()) {
    const senderNum = (m.sender || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
    if (isSelf || senderNum === num) return m.pushName.trim()
  }

  if (m.isGroup) {
    try {
      const meta = await Morela.groupMetadata(m.chat)
      if (meta?.participants?.length) {
        const p = findParticipant(meta.participants, num)
        const n = p?.notify || p?.name || p?.verifiedName
        if (typeof n === 'string' && n.trim()) return n.trim()
      }
    } catch {}
  }

  return null
}

async function fetchPP(Morela, jid) {
  const num = jid.split('@')[0].split(':')[0]
  const candidates = [jid, num + '@s.whatsapp.net', num + '@c.us'].filter((v, i, a) => a.indexOf(v) === i)
  for (const c of candidates) {
    try {
      const pp  = await Morela.profilePictureUrl(c, 'image')
      if (!pp) continue
      const res = await axios.get(pp, { responseType: 'arraybuffer', timeout: 8000 })
      if (res.data?.byteLength > 500) return Buffer.from(res.data)
    } catch {}
  }
  return null
}

async function fetchBio(Morela, jid) {
  const num = jid.split('@')[0].split(':')[0]
  const candidates = [jid, num + '@s.whatsapp.net', num + '@c.us'].filter((v, i, a) => a.indexOf(v) === i)
  for (const c of candidates) {
    try {
      const res  = await Morela.fetchStatus(c)

      const item = Array.isArray(res) ? res[0] : res
      const text = item?.status?.status || item?.status || item?.text || null
      if (typeof text === 'string' && text.trim()) return text.trim()
    } catch {}
  }
  return null
}

function loadList(store, key) {
  try {
    return kvGet(store, key, [])
  } catch { return [] }
}

function formatWIB() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date()).replace('.', ':') + ' WIB'
}

const handler = async (m, {
  Morela, args, reply, fkontak,
  senderJid,
  isOwn: runtimeIsOwn,
  isPrem: runtimeIsPrem,
  participants
}) => {

  const { jid: targetJid, quotedPushName } = resolveTarget(m, args, senderJid)
  if (!targetJid) return reply('❌ Target tidak valid. Reply, mention, atau tulis nomornya.')

  const isSelf = !!(senderJid && targetJid === senderJid)
  const num    = targetJid.split('@')[0].split(':')[0]

  const userData = getUser(targetJid) || {}

  let isOwner, isPrem
  if (isSelf) {
    isOwner = !!runtimeIsOwn
    isPrem  = !!runtimeIsPrem
  } else {
    const ownerList = loadList('own', 'list')
    const premList  = loadList('prem', 'list')
    isOwner = ownerList.some(o => String(o).replace(/[^0-9]/g, '') === num)
    isPrem  = premList.some(p  => String(p).replace(/[^0-9]/g, '') === num) || !!userData.premium
  }

  const isBanned = userData.is_banned === 1
  const lidJid   = getLidByPhone(num)

  let isTargetAdmin  = false
  let isTargetOwner  = false
  if (m.isGroup) {
    let p = participants?.length ? findParticipant(participants, num) : null
    if (!p) {
      try {
        const meta = await Morela.groupMetadata(m.chat)
        p = findParticipant(meta?.participants, num)
      } catch {}
    }
    if (p) {
      isTargetAdmin = p.admin === 'admin' || p.admin === 'superadmin'
      isTargetOwner = p.admin === 'superadmin'
    }
  }

  const isReg = !!userData.registered || isRegistered(targetJid)

  let statusLabel
  if (isBanned)                 statusLabel = 'BLACKLISTED'
  else if (isOwner)             statusLabel = 'OWNER'
  else if (isPrem)              statusLabel = 'PREMIUM'
  else if (isTargetOwner)       statusLabel = 'OWNER GRUP'
  else if (isTargetAdmin)       statusLabel = 'ADMIN GRUP'
  else if (isReg)               statusLabel = 'MEMBER'
  else                          statusLabel = 'TIDAK TERDAFTAR'

  const banReason = userData.ban_reason || 'Tanpa alasan'

  const resolvedName = await resolveName(Morela, m, targetJid, num, quotedPushName, isSelf, participants)
  const displayName  = userData.name || userData.regName || resolvedName || num

  const tags = []
  if (isOwner)          tags.push('👑 Owner')
  if (isPrem)           tags.push('⭐ Premium')
  if (userData.noLimit) tags.push('♾️ No Limit')
  if (isTargetOwner)    tags.push('👑 Owner Grup')
  else if (isTargetAdmin) tags.push('🛡️ Admin Grup')
  const trustedLabel = tags.length ? tags.join(' • ') : 'Tidak ada akses khusus.'

  const [ppBuffer, bio] = await Promise.all([
    fetchPP(Morela, targetJid),
    fetchBio(Morela, targetJid),
  ])

  const caption =
    `◦ Name: *${displayName}*\n` +
    `◦ Number: *${num}*\n` +
    `◦ JID: \`${targetJid}\`\n` +
    `◦ LID: ${lidJid || 'Tidak diketahui'}\n` +
    `◦ Status: *${statusLabel}*\n` +
    `◦ Bio: _${bio || 'Tidak ada bio / privat'}_\n` +
    `◦ Banned: ${isBanned ? 'YA ❌' : 'TIDAK ✅'}\n` +
    (isBanned ? `◦ *Reason:* _${banReason}_\n` : '') +
    `\n📋 *TRUSTED ACCESS*\n` +
    `_${trustedLabel}_\n` +
    `\n🕐 *Last Update:* ${formatWIB()}\n` +
    `_Gunakan tombol di bawah untuk menyalin_`

  const imgBuf = ppBuffer || (fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null)

  const interactiveButtons = [
    {
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Name',   copy_code: displayName })
    },
    {
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Number', copy_code: num })
    },
    {
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify({ display_text: '📋 Copy JID',    copy_code: targetJid })
    },
    ...(lidJid ? [{
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify({ display_text: '📋 Copy LID',    copy_code: lidJid })
    }] : []),
    ...(bio ? [{
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Bio',    copy_code: bio })
    }] : [])
  ]

  // Upload PP sebagai header image jika ada
  let ppImgMsg: any = null
  if (imgBuf) {
    try {
      const uploaded = await Morela.sendMessage('867051314767696@bot', { image: imgBuf, caption: '' }) as any
      ppImgMsg = uploaded?.message?.imageMessage
    } catch {}
  }

  try {
    await Morela.relayMessage(m.chat, {
      interactiveMessage: {
        ...(ppImgMsg
          ? { header: { hasMediaAttachment: true, imageMessage: ppImgMsg } }
          : { header: { hasMediaAttachment: false } }
        ),
        body:   { text: caption },
        footer: { text: `© ${botName}` },
        contextInfo: {
          forwardingScore: 9,
          isForwarded:     true,
          mentionedJid:    [targetJid],
          quotedMessage:   fkontak?.message
        },
        nativeFlowMessage: { buttons: interactiveButtons }
      }
    }, { messageId: Morela.generateMessageTag() })
  } catch (e) {
    console.error('[USERINFO] ❌', e.message)
    try { await reply(caption) } catch {}
  }
}

handler.command = ['userinfo', 'cekuser', 'infouser']
handler.tags    = ['tools']
handler.help    = [
  'userinfo          — info diri sendiri',
  'userinfo @tag     — info via mention',
  'userinfo (reply)  — info via reply pesan',
  'userinfo 6281xxx  — info via nomor'
]
handler.noLimit = true

export default handler