import { getGroup, updateGroup, getPushName } from '../../Database/db.js'
import {
  isLidJid,
  resolveLidToPhone,
  normNum,
  findParticipant,
  safeKickJid,
  safeDeleteParticipant,
  resolveBotAdmin,
} from '../../Library/resolve.js'

const _floodMap = new Map()

const CFG = {
  FLOOD_MAX        : 5,
  FLOOD_WINDOW     : 2000,
  PRODUCT_DESC_MAX : 1000,
  TEXT_MAX         : 8000,
  ZALGO_RATIO      : 0.40,
  ZALGO_MIN_LEN    : 20,
}

setInterval(() => {
  const now = Date.now()
  for (const [k, d] of _floodMap) {
    if (now - (d.lastAt || 0) > 30000) _floodMap.delete(k)
  }
}, 5 * 60 * 1000)

function isProductVirtex(m) {
  const product = m.message?.productMessage?.product
  if (!product) return false
  const desc  = product.description || ''
  const title = product.title || ''
  return desc.length > CFG.PRODUCT_DESC_MAX || title.length > CFG.PRODUCT_DESC_MAX
}

function isLongTextVirtex(m) {
  const texts = [
    m.message?.conversation,
    m.message?.extendedTextMessage?.text,
    m.message?.imageMessage?.caption,
    m.message?.videoMessage?.caption,
    m.message?.documentMessage?.caption,
  ].filter(Boolean)
  return texts.some(t => t.length > CFG.TEXT_MAX)
}

function isZalgoVirtex(m) {
  const text = (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.body || ''
  )
  if (!text || text.length < CFG.ZALGO_MIN_LEN) return false
  if (/^[.!/,>$=]/.test(text.trim())) return false

  let nonAscii = 0
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (
      (code >= 0x0300 && code <= 0x036F) ||
      (code >= 0x0483 && code <= 0x0489) ||
      (code >= 0x1DC0 && code <= 0x1DFF) ||
      (code >= 0x20D0 && code <= 0x20FF) ||
      (code >= 0xFE20 && code <= 0xFE2F) ||
      code > 0xFFFF
    ) nonAscii++
  }
  return (nonAscii / text.length) > CFG.ZALGO_RATIO
}

function isDangerousType(m) {
  const DANGEROUS = ['groupInviteMessage', 'contactsArrayMessage']
  return DANGEROUS.includes(m.mtype || '')
}

function isCommandMessage(m) {
  const text = m.body || m.text || m.message?.conversation || ''
  return /^[.!/,>$=]/.test(text.trim())
}

async function deleteBulk(sock, chatId, senderJid) {
  try {
    const store    = globalThis.__messageStore__
    const arr      = store?.messages?.[chatId]?.array || []
    const toDelete = arr.filter(x => {
      const s = x.key?.participant || x.key?.remoteJid || ''
      return s === senderJid
    })
    for (const msg of toDelete) {
      try {

        const rawPart = msg.key.participant || msg.key.remoteJid || ''
        const deletePart = safeDeleteParticipant(rawPart)
        await sock.sendMessage(chatId, {
          delete: {
            remoteJid:   chatId,
            fromMe:      false,
            id:          msg.key.id,
            participant: deletePart
          }
        })
      } catch {}
      await new Promise(r => setTimeout(r, 100))
    }
    if (toDelete.length > 0)
      console.log(`[ANTI-VIRTEX] 🗑️ Deleted ${toDelete.length} msgs from ${senderJid.split('@')[0]}`)
  } catch {}
}

async function deleteMsg(sock, m) {
  try {

    const rawPart = m.key.participant || m.key.remoteJid || ''
    const deletePart = safeDeleteParticipant(rawPart)
    await sock.sendMessage(m.chat, {
      delete: {
        remoteJid:   m.chat,
        fromMe:      false,
        id:          m.key.id,
        participant: deletePart
      }
    })
  } catch {}
}

async function kickAndNotify(sock, m, senderJid, reason, botAdmin, fkontak) {
  const isLid         = isLidJid(senderJid)
  const rawLidNum     = senderJid.split('@')[0]
  const resolvedPhone = isLid ? resolveLidToPhone(senderJid) : null
  const phoneNum      = resolvedPhone || normNum(senderJid)
  const mentionJid    = resolvedPhone ? `${phoneNum}@s.whatsapp.net` : senderJid
  const displayName   =
    getPushName(senderJid) || getPushName(rawLidNum) ||
    (resolvedPhone ? getPushName(`${phoneNum}@s.whatsapp.net`) : null) ||
    (resolvedPhone ? getPushName(phoneNum) : null) ||
    m.pushName || (resolvedPhone ? `+${phoneNum}` : rawLidNum)

  await deleteBulk(sock, m.chat, senderJid)

  await sock.sendMessage(m.chat, {
    text:
      `🚫 *Anti Virtex — Terdeteksi!*\n\n` +
      `@${phoneNum} dikeluarkan dari grup karena:\n` +
      `⚡ *${reason}*\n\n` +
      `Nama: *${displayName}*\n` +
      `_Tindakan: Kick + hapus semua pesan_`,
    mentions: [mentionJid]
  }, { quoted: fkontak || m })

  const _effectiveBotAdmin = botAdmin || await resolveBotAdmin(sock, m.chat)
  if (_effectiveBotAdmin) {
    try {
      // Resolve ke p.id asli dari metadata grup dulu — kick pakai @lid mentah
      // bisa silent-fail kalau bukan id yang terdaftar di participants.
      const meta   = await sock.groupMetadata(m.chat)
      const target = findParticipant(meta?.participants, senderJid)
      const kickJid = safeKickJid(target) || senderJid
      await sock.groupParticipantsUpdate(m.chat, [kickJid], 'remove')
      console.log(`[ANTI-VIRTEX] 🚪 Kicked ${displayName} (${phoneNum}) — ${reason}`)
    } catch (e) {
      console.error('[ANTI-VIRTEX] kick error:', e.message)
    }
  }
}

async function handleFlood(sock, m, senderJid, botAdmin, fkontak) {
  const isLid         = isLidJid(senderJid)
  const rawLidNum     = senderJid.split('@')[0]
  const resolvedPhone = isLid ? resolveLidToPhone(senderJid) : null
  const phoneNum      = resolvedPhone || normNum(senderJid)
  const mentionJid    = resolvedPhone ? `${phoneNum}@s.whatsapp.net` : senderJid
  const displayName   =
    getPushName(senderJid) || getPushName(rawLidNum) ||
    (resolvedPhone ? getPushName(`${phoneNum}@s.whatsapp.net`) : null) ||
    (resolvedPhone ? getPushName(phoneNum) : null) ||
    m.pushName || (resolvedPhone ? `+${phoneNum}` : rawLidNum)

  await deleteBulk(sock, m.chat, senderJid)

  const grp   = getGroup(m.chat) || {}
  const warns = grp.warns || {}
  if (!warns[senderJid]) warns[senderJid] = { count: 0 }
  warns[senderJid].count++
  warns[senderJid].updatedAt = Date.now()
  updateGroup(m.chat, { warns })

  const count = warns[senderJid].count

  await sock.sendMessage(m.chat, {
    text:
      `⚡ *Anti Virtex — Flood Terdeteksi!*\n\n` +
      `@${phoneNum} mengirim pesan terlalu cepat!\n` +
      `Nama: *${displayName}*\n` +
      `🗑️ Semua pesan dihapus\n` +
      `⚠️ Peringatan: *${count}/3*\n\n` +
      (count >= 3 ? '🚫 Batas penuh → kick!' : 'Ulangi lagi → akan dikick.'),
    mentions: [mentionJid]
  }, { quoted: fkontak || m })

  if (count >= 3 && botAdmin) {
    const meta   = await sock.groupMetadata(m.chat)
    const target = findParticipant(meta?.participants, senderJid)
    const kickJid = safeKickJid(target) || senderJid
    await sock.groupParticipantsUpdate(m.chat, [kickJid], 'remove')
    warns[senderJid].count = 0
    updateGroup(m.chat, { warns })
    console.log(`[ANTI-VIRTEX] 🚪 Kicked ${displayName} (${phoneNum}) after 3 flood warns`)
  }
}

export default {
  tags: ['group', 'anti', 'passive'],

  handler: async (m, { Morela, isOwn, isAdmin, botAdmin, fkontak }) => {
    if (!m.isGroup)                              return
    if (!m.message)                              return
    if (isOwn || isAdmin)                        return
    if (m.message?.reactionMessage)              return
    if (m.message?.protocolMessage)              return
    if (m.message?.senderKeyDistributionMessage) return
    if (m.chat === 'status@broadcast')           return

    const grp = getGroup(m.chat)
    if (!grp?.antivirtex) return

    const senderJid = m.sender || m.key?.participant || m.key?.remoteJid || ''
    if (!senderJid) return

    if (isProductVirtex(m))
      return kickAndNotify(Morela, m, senderJid, 'Product Message Virtex (deskripsi panjang)', botAdmin, fkontak)

    if (isLongTextVirtex(m))
      return kickAndNotify(Morela, m, senderJid, 'Teks ekstrem panjang (>8000 karakter)', botAdmin, fkontak)

    if (isZalgoVirtex(m))
      return kickAndNotify(Morela, m, senderJid, 'Karakter unicode/zalgo berlebihan', botAdmin, fkontak)

    if (isDangerousType(m))
      return kickAndNotify(Morela, m, senderJid, `Tipe pesan berbahaya: ${m.mtype}`, botAdmin, fkontak)

    if (isCommandMessage(m)) return

    const key = `${m.chat}:${senderJid}`
    const now = Date.now()

    if (!_floodMap.has(key)) _floodMap.set(key, { timestamps: [], lastAt: now })
    const data = _floodMap.get(key)
    data.lastAt = now

    data.timestamps = data.timestamps.filter(t => now - t < CFG.FLOOD_WINDOW)
    data.timestamps.push(now)

    if (data.timestamps.length >= CFG.FLOOD_MAX) {
      data.timestamps = []
      await handleFlood(Morela, m, senderJid, botAdmin, fkontak)
    }
  }
}
