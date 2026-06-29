import { getGroup } from '../../Database/db.js'
import pluginManager from '../_pluginmanager.js'
import { isSenderAdminInGroup, safeDeleteParticipant, resolveBotAdmin } from '../../Library/resolve.js'
const PREFIX_SYMBOL_REGEX = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/
function isRealBotCommand(text: string): boolean {
  if (!text) return false
  const trimmed = text.trim()
  const prefixMatch = trimmed.match(PREFIX_SYMBOL_REGEX)
  if (!prefixMatch) return false
  const withoutPrefix = trimmed.slice(prefixMatch[0].length)
  const cmd = withoutPrefix.trim().split(/\s+/)[0]?.toLowerCase()
  if (!cmd) return false
  return !!pluginManager.getPlugin(cmd)
}
const LINK_REGEX =
  /(https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[^\s]+|wa\.me\/\d+|instagram\.com\/[^\s]+|t\.me\/[^\s]+|discord\.(gg|com)\/[^\s]+)/i
function extractAllText(m) {
  const parts = []
  const msg   = m.message || {}
  if (msg.conversation)                                             parts.push(msg.conversation)
  if (msg.extendedTextMessage?.text)                               parts.push(msg.extendedTextMessage.text)
  if (msg.extendedTextMessage?.matchedText)                        parts.push(msg.extendedTextMessage.matchedText)
  if (msg.extendedTextMessage?.canonicalUrl)                       parts.push(msg.extendedTextMessage.canonicalUrl)
  if (msg.imageMessage?.caption)                                   parts.push(msg.imageMessage.caption)
  if (msg.videoMessage?.caption)                                   parts.push(msg.videoMessage.caption)
  if (msg.documentMessage?.caption)                                parts.push(msg.documentMessage.caption)
  if (msg.audioMessage?.caption)                                   parts.push(msg.audioMessage.caption)
  if (msg.ephemeralMessage?.message?.conversation)                 parts.push(msg.ephemeralMessage.message.conversation)
  if (msg.ephemeralMessage?.message?.extendedTextMessage?.text)    parts.push(msg.ephemeralMessage.message.extendedTextMessage.text)
  if (msg.ephemeralMessage?.message?.extendedTextMessage?.matchedText)  parts.push(msg.ephemeralMessage.message.extendedTextMessage.matchedText)
  if (msg.ephemeralMessage?.message?.extendedTextMessage?.canonicalUrl) parts.push(msg.ephemeralMessage.message.extendedTextMessage.canonicalUrl)
  if (msg.ephemeralMessage?.message?.imageMessage?.caption)        parts.push(msg.ephemeralMessage.message.imageMessage.caption)
  if (msg.ephemeralMessage?.message?.videoMessage?.caption)        parts.push(msg.ephemeralMessage.message.videoMessage.caption)
  if (msg.viewOnceMessage?.message?.imageMessage?.caption)         parts.push(msg.viewOnceMessage.message.imageMessage.caption)
  if (msg.viewOnceMessage?.message?.videoMessage?.caption)         parts.push(msg.viewOnceMessage.message.videoMessage.caption)
  if (msg.viewOnceMessageV2?.message?.imageMessage?.caption)       parts.push(msg.viewOnceMessageV2.message.imageMessage.caption)
  if (msg.viewOnceMessageV2?.message?.videoMessage?.caption)       parts.push(msg.viewOnceMessageV2.message.videoMessage.caption)
  if (msg.viewOnceMessageV2?.message?.extendedTextMessage?.text)   parts.push(msg.viewOnceMessageV2.message.extendedTextMessage.text)
  if (msg.viewOnceMessageV2?.message?.extendedTextMessage?.matchedText)  parts.push(msg.viewOnceMessageV2.message.extendedTextMessage.matchedText)
  if (msg.viewOnceMessageV2?.message?.extendedTextMessage?.canonicalUrl) parts.push(msg.viewOnceMessageV2.message.extendedTextMessage.canonicalUrl)
  if (msg.documentWithCaptionMessage?.message?.documentMessage?.caption) parts.push(msg.documentWithCaptionMessage.message.documentMessage.caption)
  if (msg.documentWithCaptionMessage?.message?.imageMessage?.caption)    parts.push(msg.documentWithCaptionMessage.message.imageMessage.caption)
  if (msg.documentWithCaptionMessage?.message?.videoMessage?.caption)    parts.push(msg.documentWithCaptionMessage.message.videoMessage.caption)
  if (msg.buttonsMessage?.contentText)                             parts.push(msg.buttonsMessage.contentText)
  if (msg.templateMessage?.hydratedTemplate?.hydratedContentText) parts.push(msg.templateMessage.hydratedTemplate.hydratedContentText)
  if (msg.listMessage?.description)                                parts.push(msg.listMessage.description)
  if (msg.listMessage?.title)                                      parts.push(msg.listMessage.title)
  for (const key of ['pollCreationMessage', 'pollCreationMessageV2', 'pollCreationMessageV3']) {
    const poll = msg[key]
    if (!poll) continue
    if (poll.name) parts.push(poll.name)
    if (Array.isArray(poll.options)) {
      for (const opt of poll.options) {
        if (opt.optionName) parts.push(opt.optionName)
      }
    }
  }
  return parts.join(' ')
}
function hasProhibitedContent(m) {
  const msg = m.message || {}
  const text = extractAllText(m)
  if (text && LINK_REGEX.test(text)) {
    console.log('[ANTILINK] link di teks:', text.match(LINK_REGEX)?.[0])
    return true
  }
  if (msg.groupInviteMessage) {
    console.log('[ANTILINK] direct group invite message')
    return true
  }
  function checkCtx(ctx) {
    if (!ctx) return false
    if (ctx.inviteLinkGroupTypeV2 || ctx.inviteLinkGroupType) return true
    if (ctx.inviteLinkJoinV2)                                  return true
    const adUrl = ctx.externalAdReply?.sourceUrl
    if (adUrl && (
      adUrl.includes('chat.whatsapp.com') ||
      adUrl.includes('wa.me')             ||
      adUrl.includes('whatsapp.com/channel')
    )) return true
    return false
  }
  if (checkCtx(msg.extendedTextMessage?.contextInfo)) {
    console.log('[ANTILINK] invite di extendedText contextInfo')
    return true
  }
  if (checkCtx(msg.extendedTextMessage)) {
    console.log('[ANTILINK] invite di root extendedTextMessage')
    return true
  }
  for (const key of ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage']) {
    if (checkCtx(msg[key]?.contextInfo)) {
      console.log(`[ANTILINK] invite di ${key} contextInfo`)
      return true
    }
  }
  const voMsg = msg.viewOnceMessage?.message || msg.viewOnceMessageV2?.message
  if (voMsg) {
    if (checkCtx(voMsg.extendedTextMessage?.contextInfo)) return true
    for (const key of ['imageMessage', 'videoMessage']) {
      if (checkCtx(voMsg[key]?.contextInfo)) return true
    }
  }
  const ephMsg = msg.ephemeralMessage?.message
  if (ephMsg) {
    if (checkCtx(ephMsg.extendedTextMessage?.contextInfo)) return true
    for (const key of ['imageMessage', 'videoMessage']) {
      if (checkCtx(ephMsg[key]?.contextInfo)) return true
    }
  }
  return false
}
export default {
  tags: ['group', 'antilink'],
  handler: async (m, { Morela, isOwn, isAdmin, botAdmin }) => {
    if (!m.message) return
    if (!m.isGroup) return
    if (m.fromMe)   return
    const from      = m.chat
    const groupData = getGroup(from)
    if (!groupData?.antilink) return
    if (!botAdmin) {
      // LID bot mungkin belum ter-map saat botAdmin dievaluasi — cek ulang secara live
      const recheckAdmin = await resolveBotAdmin(Morela, from)
      if (!recheckAdmin) {
        console.warn('[ANTILINK] Bot bukan admin di grup ini (setelah re-check live), tidak bisa delete')
        return
      }
      console.log('[ANTILINK] botAdmin false tapi re-check live: bot ADALAH admin, lanjut')
    }
    const rawText = extractAllText(m)
    if (rawText && isRealBotCommand(rawText)) return
    if (isOwn) return
    const senderRaw = (m.key.participant || m.key.remoteJid || '') as string
    let senderIsAdmin = isAdmin 
    if (!senderIsAdmin && senderRaw.endsWith('@lid')) {
      senderIsAdmin = await isSenderAdminInGroup(Morela, from, senderRaw)
      if (senderIsAdmin) {
        console.log(`[ANTILINK] LID ${senderRaw} ternyata admin setelah re-check, skip`)
      }
    }
    if (senderIsAdmin) return
    if (!hasProhibitedContent(m)) return
    try {
      const deleteParticipant = safeDeleteParticipant(senderRaw)
      if (senderRaw.endsWith('@lid') && deleteParticipant === senderRaw) {
        console.warn(`[ANTILINK] LID ${senderRaw.split('@')[0]} belum di-map, delete mungkin gagal`)
      } else if (senderRaw.endsWith('@lid')) {
        console.log(`[ANTILINK] LID resolved: ${senderRaw.split('@')[0]} → ${deleteParticipant}`)
      }
      await Morela.sendMessage(from, {
        delete: {
          remoteJid:   from,
          fromMe:      false,
          id:          m.key.id,
          participant: deleteParticipant
        }
      })
      console.log(`[ANTILINK] ✅ Deleted from ${senderRaw.split('@')[0]} (${deleteParticipant}) in ${from.slice(0, 15)}...`)
    } catch (e) {
      console.error('[ANTILINK] ❌ Delete failed:', (e as Error).message)
    }
  }
}