import pluginManager from '../_pluginmanager.js'
import { botName, buildFkontak } from '../../Library/utils.js'
import { ButtonV2 } from '../../Library/MessageBuilder.js'
import { isSelfMode } from '../../System/selfmode.js'
import { isRegistered, getPushName, getPhoneByLid } from '../../Database/db.js'  

const DYM_IMG = 'https://cdn.ornzora.eu.cc/c6dbc61a-8eb9-4725-adf4-9d4e05bf4953-upload-1780181470322.jpg'

if (!(globalThis as Record<string, unknown>).__dymDedup__) (globalThis as Record<string, unknown>).__dymDedup__ = new Map()
function isDuplicate(key: string) {
  const now = Date.now()
  if ((globalThis as Record<string, unknown>).__dymDedup__.has(key) && now - (globalThis as Record<string, unknown>).__dymDedup__.get(key) < 5000) return true
  ;(globalThis as Record<string, unknown>).__dymDedup__.set(key, now)
  for (const [k, t] of (globalThis as Record<string, unknown>).__dymDedup__)
    if (now - t > 10000) (globalThis as Record<string, unknown>).__dymDedup__.delete(k)
  return false
}

function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

function findSimilar(input: string, allCmds: string[], threshold = 3) {
  return allCmds
    .map(cmd => ({
      cmd,
      dist: levenshtein(input.toLowerCase(), cmd.toLowerCase()),
    }))
    .filter(x => x.dist <= threshold)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 2)
    .map(x => ({
      cmd:        x.cmd,
      similarity: Math.round((1 - x.dist / Math.max(x.cmd.length, input.length)) * 100),
    }))
}

export default {
  tags: ['passive', 'didyoumean'],

  handler: async (m, { Morela, isOwn }) => {
    try {
      if (!m.message)                               return
      if (m.message?.reactionMessage)              return
      if (m.message?.protocolMessage)              return
      if (m.message?.senderKeyDistributionMessage) return
      if (m.chat === 'status@broadcast')           return
      if (m.key?.fromMe)                           return

      if (m.isGroup && isSelfMode(m.chat) && !isOwn) return

      if (!isOwn) {
        const userJid = m.sender || m.key?.participant || m.key?.remoteJid
        if (userJid && !isRegistered(userJid)) return
      }

      const body = m.body || m.text || ''
      if (!body) return

      const prefixMatch = body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/i)
      if (!prefixMatch) return
      const prefix = prefixMatch[0]
      const cmd    = body.slice(prefix.length).trim().split(' ')[0].toLowerCase()
      if (!cmd) return

      if (pluginManager.getPlugin(cmd)) return
      if (isOwn && ['>', '=>', '$'].some(p => body.startsWith(p))) return
      if (isDuplicate(`${m.chat}:${cmd}:${m.key?.id || ''}`)) return

      const senderJid  = m.sender || m.key?.participant || m.key?.remoteJid || ''
      const _isLid     = senderJid.endsWith('@lid')
      const _rawLidNum = senderJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')

      const _phone     = _isLid ? (getPhoneByLid(_rawLidNum) || null) : null

      const userNum    = _phone
        ? _phone
        : (_isLid ? _rawLidNum : senderJid.split('@')[0].split(':')[0])

      const phoneJid   = _phone
        ? `${_phone}@s.whatsapp.net`
        : (_isLid ? senderJid : `${userNum}@s.whatsapp.net`)

      const allCmds  = [...pluginManager.plugins.keys()]
      const similars = findSimilar(cmd, allCmds)

      const bodyText = similars.length > 0
        ? `Halo @${userNum} 👋, mungkin fitur ini yang sedang anda cari ?`
        : `Halo @${userNum} 👋\nCommand *${prefix}${cmd}* tidak tersedia.\nKetik *${prefix}menu* untuk semua command.`

      let footerText = ''
      if (similars.length > 0) {
        similars.forEach(({ cmd: c, similarity }) => {
          footerText += `[ ◦ COMMAND    : ${prefix}${c}\n`
          footerText += `  ◦ SIMILARITY : ${similarity}% ]\n\n`
        })
      }
      footerText += `© ${botName}`

      const fk  = await buildFkontak(Morela)

      const btn = new ButtonV2(Morela)
        .setTitle('DIDYOUMEAN ❓')
        .setSubtitle('')
        .setBody(bodyText)
        .setFooter(footerText)
        .setThumbnail(DYM_IMG)
        .setContextInfo({ mentionedJid: [phoneJid] })

      if (similars.length > 0) {
        similars.forEach(({ cmd: c }) => {
          btn.addButton(`${prefix}${c}`, `${prefix}${c}`)
        })
      } else {
        btn.addButton('📋 Menu', `${prefix}menu`)
      }

      const msg = await btn.build(m.chat, { userJid: Morela.user?.id })
      await Morela.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

    } catch {

    }
  }
}
