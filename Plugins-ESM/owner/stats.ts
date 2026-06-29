import { getStats, resetStats } from '../../Database/stats.js'
import { botName } from '../../Library/utils.js'
import { resolveDisplayName } from '../../Library/resolve.js'

function uptime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d} hari ${h % 24} jam`
  if (h > 0) return `${h} jam ${m % 60} menit`
  return `${m} menit ${s % 60} detik`
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

const handler = async (m: any, { Morela, command, reply }: any) => {
  if (command === 'resetstats') {
    resetStats()
    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
    return reply('✅ Stats direset!')
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  const stats    = getStats()
  const topCmds  = (Object.entries(stats.commands || {}) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const topUsers = (Object.entries(stats.users    || {}) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const topHours = (Object.entries(stats.hours    || {}) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const topDays  = (Object.entries(stats.days     || {}) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const age      = uptime(Date.now() - (stats.startedAt || Date.now()))
  const total    = stats.total || 0

  const DAYS_ID: Record<string, string> = {
    Sunday: 'Minggu', Monday: 'Senin', Tuesday: 'Selasa',
    Wednesday: 'Rabu', Thursday: 'Kamis', Friday: 'Jumat', Saturday: 'Sabtu'
  }

  // Resolve nama user
  const resolvedNames = new Map<string, string>()
  for (const [jid] of topUsers) {
    try {
      const name = await resolveDisplayName(Morela, m, jid, {})
      resolvedNames.set(jid, name)
    } catch {
      resolvedNames.set(jid, '+' + jid.split('@')[0].split(':')[0].slice(-8))
    }
  }

  // optionName: label doang (tanpa angka count)
  // optionVoteCount: angka asli → WA tampilkan di kanan + bar proporsional
  const pollVotes = [
    ...topCmds.map(([cmd, count], i) => ({
      optionName:      `🏆 ${medal(i + 1)} .${cmd}`,
      optionVoteCount: String(count)
    })),
    ...topUsers.map(([jid, count], i) => {
      const name = resolvedNames.get(jid) || jid.split('@')[0]
      return {
        optionName:      `👤 ${medal(i + 1)} ${name.slice(0, 15)}`,
        optionVoteCount: String(count)
      }
    }),
    ...topHours.map(([hour, count], i) => ({
      optionName:      `🕐 ${medal(i + 1)} ${hour.padStart(2,'0')}:00-${(+hour+1).toString().padStart(2,'0')}:00`,
      optionVoteCount: String(count)
    })),
    ...topDays.map(([day, count], i) => ({
      optionName:      `📅 ${medal(i + 1)} ${DAYS_ID[day] || day}`,
      optionVoteCount: String(count)
    }))
  ]

  try {
    const content = {
      pollResultSnapshotMessage: {
        name: `📊 STATS DASHBOARD | ${total.toLocaleString()}x | ⏱ ${age}`,
        pollVotes,
        contextInfo: {
          stanzaId:      m.key?.id || ('STATS' + Date.now()),
          participant:   m.key?.participant || m.sender || '0@s.whatsapp.net',
          quotedMessage: { conversation: `© ${botName}` },
          mentionedJid:  []
        },
        pollType: 'POLL'
      }
    }

    await Morela.relayMessage(m.chat, content, RELAY_OPT)
    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
  } catch (err: any) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Error: ${err.message}`)
  }
}

handler.command = ['stats', 'botstats', 'resetstats']
handler.owner   = true
handler.tags    = ['owner']
handler.help    = ['stats — dashboard statistik bot']
handler.noLimit = true

export default handler