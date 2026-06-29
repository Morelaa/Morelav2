import { botName } from '../../Library/utils.js'
import { getFullDB as _getFullDB, replaceFullDB as _replaceFullDB } from '../../Database/chatcount.js'

function getDB() {
  if ((globalThis as any).__chatCountDB__) return (globalThis as any).__chatCountDB__
  const data = _getFullDB()
  ;(globalThis as any).__chatCountDB__ = data
  return data
}

function saveDB() {
  try {
    const data = (globalThis as any).__chatCountDB__
    if (data) _replaceFullDB(data)
  } catch (e) { console.error('[TOPCHAT] save error:', (e as Error).message) }
}

function getLeaderboard(scope: string, limit = 12, activeJids?: Set<string>) {
  const db   = getDB()
  const data = db[scope] || {}
  let entries = Object.entries(data)
    .map(([jid, v]: any) => ({ jid, ...v }))

  if (activeJids && activeJids.size > 0) {
    entries = entries.filter((u: any) => {

      if (activeJids.has(u.jid)) return true

      const num = u.jid.split('@')[0]
      for (const aj of activeJids) {
        if (aj.split('@')[0] === num) return true
      }
      return false
    })
  }

  return entries
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, limit)
}

function medal(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`
}

const RELAY_OPT = {
  additionalNodes: [{
    tag: 'biz', attrs: {},
    content: [{
      tag: 'interactive',
      attrs: { type: 'native_flow', v: '1' },
      content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
    }]
  }]
}

async function sendPollTop(
  Morela:  any,
  from:    string,
  m:       any,
  { title, entries, total, allMembers }:
  { title: string; entries: any[]; total: number; allMembers: string[] }
) {
  const top = entries.slice(0, 12)

  const pollVotes = top.map((u: any, i: number) => {
    const pct  = total > 0 ? ((u.count / total) * 100).toFixed(1) : '0'
    const name = (u.name || u.jid.split('@')[0]).slice(0, 18)
    return {
      optionName:      `${medal(i + 1)} ${name} — ${u.count.toLocaleString()} (${pct}%)`,
      optionVoteCount: String(u.count)
    }
  })

  const content = {
    pollResultSnapshotMessage: {
      name:      title,
      pollVotes,
      contextInfo: {
        stanzaId:      m.key?.id || ('TOPCHAT' + Date.now()),
        participant:   m.key?.participant || m.sender || '0@s.whatsapp.net',
        quotedMessage: { conversation: `© ${botName}` },
        mentionedJid:  allMembers   
      },
      pollType: 'POLL'
    }
  }

  return Morela.relayMessage(from, content, RELAY_OPT)
}

const handler = async (m: any, { Morela, args, reply, command, isOwn, isAdmin, senderJid, fkontak }: any) => {
  const sub  = (args[0] || '').toLowerCase()
  const from = m.chat
  const db   = getDB()

  if (command === 'myscore' || command === 'skor') {
    const groupCt  = m.isGroup ? (db[from]?.[senderJid]?.count || 0) : 0
    const globalCt = db['_global']?.[senderJid]?.count || 0
    const name     = m.pushName || senderJid.split('@')[0]

    let groupRank = '-'
    if (m.isGroup) {

      let activeJids: Set<string> | undefined
      try {
        const meta = await Morela.groupMetadata(from)
        activeJids = new Set(meta.participants.map((p: any) => p.id))
      } catch {}
      const sorted = getLeaderboard(from, 999, activeJids)
      const idx    = sorted.findIndex((u: any) => {
        if (u.jid === senderJid) return true
        return u.jid.split('@')[0] === senderJid.split('@')[0]
      })
      groupRank = idx >= 0 ? `#${idx + 1}` : '-'
    }
    const sortedG  = Object.entries(db['_global'] || {}).sort(([, a]: any, [, b]: any) => b.count - a.count)
    const globalRk = sortedG.findIndex(([jid]: any) => jid === senderJid)

    return Morela.sendMessage(from, {
      text:
        `╭╌╌⬡「 📊 *ᴍʏ sᴄᴏʀᴇ* 」\n` +
        `┃ 👤 *${name}*\n┃\n` +
        (m.isGroup
          ? `┃ 🏠 *Grup ini:*\n┃  ◦ 💬 ${groupCt.toLocaleString()} pesan\n┃  ◦ 🏆 Rank *${groupRank}*\n┃\n`
          : '') +
        `┃ 🌐 *Global:*\n` +
        `┃  ◦ 💬 ${globalCt.toLocaleString()} pesan\n` +
        `┃  ◦ 🏆 Rank *${globalRk >= 0 ? `#${globalRk + 1}` : '-'}*\n` +
        `╰╌╌⬡\n\n꒰ © ${botName} ꒱`
    }, { quoted: fkontak || m })
  }

  if (sub === 'reset') {
    if (!isAdmin && !isOwn) return reply('❌ Hanya admin/owner yang bisa reset!')
    if (!m.isGroup)         return reply('❌ Hanya bisa di grup!')
    const total = Object.values(db[from] || {}).reduce((s: number, v: any) => s + v.count, 0)
    delete db[from]; saveDB()
    return reply(`✅ Reset! Total ${total.toLocaleString()} pesan dihapus.\n\n꒰ © ${botName} ꒱`)
  }

  if (sub === 'cleanup') {
    if (!isAdmin && !isOwn) return reply('❌ Hanya admin/owner yang bisa cleanup!')
    if (!m.isGroup)         return reply('❌ Hanya bisa di grup!')
    try {
      const meta       = await Morela.groupMetadata(from)
      const activeNums = new Set(meta.participants.map((p: any) => p.id.split('@')[0]))
      const groupData  = db[from] || {}
      let removed = 0

      for (const jid of Object.keys(groupData)) {
        const num = jid.split('@')[0]
        if (!activeNums.has(num)) {
          delete groupData[jid]
          removed++
        }
      }

      db[from] = groupData
      saveDB()
      return reply(
        `✅ *Cleanup selesai!*\n\n` +
        `┃ Member aktif   : ${activeNums.size}\n` +
        `┃ Data dihapus   : ${removed} member (sudah keluar)\n` +
        `┃ Data tersisa   : ${Object.keys(groupData).length}\n\n꒰ © ${botName} ꒱`
      )
    } catch (e) {
      return reply('❌ Gagal cleanup: ' + (e as Error).message)
    }
  }

  if (sub === 'all') {
    const entries = getLeaderboard('_global', 12)
    if (!entries.length) return reply('❌ Belum ada data chat global.')

    const total   = Object.values(db['_global'] || {}).reduce((s: number, v: any) => s + v.count, 0)
    const members = Object.keys(db['_global'] || {}).length

    await Morela.sendMessage(from, { react: { text: '⏳', key: m.key } })
    try {
      await sendPollTop(Morela, from, m, {
        title:   `🌐 TOP CHAT GLOBAL | ${total.toLocaleString()} pesan | ${members} tercatat`,
        entries, total, allMembers: []
      })
      await Morela.sendMessage(from, { react: { text: '✅', key: m.key } })
    } catch (e) {
      await Morela.sendMessage(from, { react: { text: '❌', key: m.key } })
      reply('❌ Gagal: ' + (e as Error).message)
    }
    return
  }

  if (!m.isGroup) {
    return reply(
      `📊 *Top Chat*\n\n` +
      `• *.topchat* — leaderboard grup\n` +
      `• *.topchat all* — leaderboard global\n` +
      `• *.topchat cleanup* — hapus data member keluar\n` +
      `• *.myscore* — skor kamu\n` +
      `• *.topchat reset* — reset semua data (admin)\n\n꒰ © ${botName} ꒱`
    )
  }

  let groupName    = 'Grup'
  let allMembers: string[] = []
  let activeJids: Set<string> | undefined
  let realMemberCount = 0

  try {
    const meta      = await Morela.groupMetadata(from)
    groupName       = meta.subject || 'Grup'
    allMembers      = meta.participants.map((p: any) => p.id)
    activeJids      = new Set(allMembers)
    realMemberCount = meta.participants.length   
  } catch {}

  const entries = getLeaderboard(from, 12, activeJids)
  if (!entries.length) return reply('❌ Belum ada data chat di grup ini.')

  const total = entries.reduce((s: number, u: any) => s + u.count, 0)

  await Morela.sendMessage(from, { react: { text: '⏳', key: m.key } })
  try {
    await sendPollTop(Morela, from, m, {

      title:   `🏆 TOP CHAT — ${groupName.slice(0, 20)} | ${total.toLocaleString()} pesan | ${realMemberCount} member`,
      entries, total, allMembers
    })
    await Morela.sendMessage(from, { react: { text: '✅', key: m.key } })
  } catch (e) {
    await Morela.sendMessage(from, { react: { text: '❌', key: m.key } })
    reply('❌ Gagal: ' + (e as Error).message)
  }
}

handler.command = ['topchat', 'leaderboard', 'lb', 'myscore', 'skor']
handler.tags    = ['owner']
handler.help    = ['topchat', 'topchat all', 'topchat cleanup', 'myscore']
handler.owner   = true
handler.noLimit = true

export default handler
