/**
 * 🗳️ Vote Kick
 * - Member ketik .votekick + reply/mention/nomor
 * - 3 vote berbeda → auto kick
 * - Admin, owner, bot aman
 */

import { botName } from '../../Library/utils.js'
import {
  normNum,
  resolveLidToPhone,
  findParticipant,
  resolveNameFromParticipant,
  resolveTarget,
  getMentionJid,
} from '../../Library/resolve.js'

const voteData:     Record<string, Record<string, Set<string>>> = {}
const expireTimers: Record<string, NodeJS.Timeout>              = {}

const VOTE_THRESHOLD = 3
const VOTE_EXPIRE_MS = 10 * 60 * 1000

// ── Vote storage helpers ────────────────────────────────────────────────
function getVotes(groupJid: string, targetKey: string): Set<string> {
  if (!voteData[groupJid])             voteData[groupJid] = {}
  if (!voteData[groupJid][targetKey])  voteData[groupJid][targetKey] = new Set()
  return voteData[groupJid][targetKey]
}

function clearVotes(groupJid: string, targetKey: string) {
  delete voteData[groupJid]?.[targetKey]
  const key = `${groupJid}::${targetKey}`
  if (expireTimers[key]) { clearTimeout(expireTimers[key]); delete expireTimers[key] }
}

function scheduleExpire(groupJid: string, targetKey: string) {
  const key = `${groupJid}::${targetKey}`
  if (expireTimers[key]) clearTimeout(expireTimers[key])
  expireTimers[key] = setTimeout(() => clearVotes(groupJid, targetKey), VOTE_EXPIRE_MS)
}

// ── HANDLER ────────────────────────────────────────────────────────────
const handler = async (m: any, { Morela, args, senderJid, reply, fkontak, botAdmin }: any) => {
  const groupJid = m.chat
  if (!groupJid?.endsWith('@g.us')) return reply('❌ Fitur ini hanya untuk grup.')
  if (!botAdmin) return reply('❌ Bot bukan admin grup, tidak bisa kick.')

  const { raw: rawTarget } = resolveTarget(m, args)
  if (!rawTarget) return reply(
    `🗳️ *Vote Kick*\n\n` +
    `📌 Cara pakai:\n` +
    `╭─────────────────────\n` +
    `│ Reply pesan + *.votekick*\n` +
    `│ .votekick @mention\n` +
    `│ .votekick 628xxx\n` +
    `╰─────────────────────\n` +
    `_Butuh ${VOTE_THRESHOLD} vote untuk kick member_`
  )

  // Ambil metadata grup
  let meta: any
  try { meta = await Morela.groupMetadata(groupJid) }
  catch { return reply('❌ Gagal ambil data grup.') }

  const participants = meta.participants as any[]

  // Cari participant target — LID-safe 4 tingkat fallback via resolve.ts
  const targetP = findParticipant(participants, rawTarget)
  if (!targetP) return reply('❌ Target tidak ditemukan dalam grup.')

  // Target aman: admin / superadmin
  if (targetP.admin === 'admin' || targetP.admin === 'superadmin')
    return reply('⚠️ Tidak bisa vote kick admin atau owner grup.')

  // Target aman: bot sendiri
  const botNum         = normNum(Morela.user.id)
  const targetNum      = normNum(targetP.id)
  const targetLidPhone = resolveLidToPhone(targetP.id)
  if (targetNum === botNum || targetLidPhone === botNum)
    return reply('⚠️ Tidak bisa vote kick bot.')

  // Voter tidak boleh vote diri sendiri
  const senderNum = normNum(senderJid) || (resolveLidToPhone(senderJid) ?? '') || ''
  const targetKey = targetP.id  // pakai p.id asli sebagai key (stabil)

  if (senderNum && (targetNum === senderNum || targetLidPhone === senderNum))
    return reply('⚠️ Tidak bisa vote kick diri sendiri.')

  // ── Tambah vote ──────────────────────────────────────────────────────
  const voterKey = senderNum || senderJid
  const votes    = getVotes(groupJid, targetKey)

  if (votes.has(voterKey))
    return reply(`⚠️ Kamu sudah vote kick orang ini.\n_Vote saat ini: ${votes.size}/${VOTE_THRESHOLD}_`)

  votes.add(voterKey)
  scheduleExpire(groupJid, targetKey)

  const current = votes.size

  // Resolve display info via resolve.ts
  const displayName = resolveNameFromParticipant(targetP, m.quoted?.pushName)
  const phoneNum    = targetLidPhone || targetNum
  const mentionJid  = getMentionJid(targetP.id)

  // Belum cukup vote
  if (current < VOTE_THRESHOLD) {
    const remaining = VOTE_THRESHOLD - current
    const voterList = [...votes].map((v, i) => `│ ${i + 1}. +${v}`).join('\n')

    return Morela.sendMessage(groupJid, {
      text:
        `🗳️ *Vote Kick* — ${current}/${VOTE_THRESHOLD}\n\n` +
        `👤 Target: @${phoneNum} *(${displayName})*\n\n` +
        `╭─────────────────────\n` +
        `${voterList}\n` +
        `╰─────────────────────\n\n` +
        `⏳ Butuh *${remaining} vote lagi* untuk kick!\n` +
        `_Vote akan reset dalam 10 menit_`,
      mentions: [mentionJid]
    }, { quoted: m })
  }

  // ── Vote cukup → kick! ───────────────────────────────────────────────
  clearVotes(groupJid, targetKey)

  try {
    // Kick pakai targetP.id asli — bukan construct sendiri (sesuai RESOLVENAMEGUIDE.MD)
    await Morela.groupParticipantsUpdate(groupJid, [targetP.id], 'remove')

    await Morela.sendMessage(groupJid, {
      text:
        `🗳️ *Vote Kick Berhasil!*\n\n` +
        `👤 @${phoneNum} *(${displayName})* telah di-kick dari grup\n` +
        `📊 Total vote: ${VOTE_THRESHOLD}/${VOTE_THRESHOLD}\n\n` +
        `© ${botName}`,
      mentions: [mentionJid]
    }, { quoted: fkontak || m })

  } catch (e: any) {
    console.error('[VOTEKICK] Kick failed:', e.message)
    reply('❌ Gagal kick: ' + e.message)
  }
}

handler.help    = ['votekick <reply/mention/nomor>']
handler.tags    = ['group']
handler.command = ['votekick', 'vkick']
handler.group   = true

export default handler