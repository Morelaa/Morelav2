import { getUser, countUsers, countGroups, getAllGroups, getGroup, getUsers, getAllLidMap } from '../../Database/db.js'
import { kvGet } from '../../Database/kvstore.js'
import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { botName } from '../../Library/utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url as string))
const DATA_DIR  = path.join(__dirname, '../../data')

async function sendInteractive(Morela: any, chat: any, headerTitle: string, bodyText: string, fkontak: any) {
  const { generateWAMessageFromContent } = await import('@itsliaaa/baileys')
  const { getMainOwner } = await import('../../System/mainowner.js')
  const { ownerName } = await import('../../Library/utils.js')

  const mainOwnerNum = getMainOwner()
  const now = new Date()
  const end = new Date(now.getTime() + 10 * 60000)

  const buttons: any[] = []
  if (mainOwnerNum) {
    buttons.push({
      name: 'booking_confirmation',
      buttonParamsJson: JSON.stringify({
        start_datetime:         now.toISOString(),
        end_datetime:           end.toISOString(),
        location:               '🇮🇩Indonesia🇮🇩',
        booking_url:            `https://wa.me/${mainOwnerNum}`,
        phone_number:           mainOwnerNum,
        booking_management_url: `https://wa.me/${mainOwnerNum}`,
        description:
          `*◦ 👤 Name  :*  ${ownerName}\n` +
          `*◦ 👑 Status  :*  _Real Owner_\n`,
        email: '',
        display_text: `👑 ᴍᴀɪɴ ᴏᴡɴᴇʀ`,
        display_content: {
          display_language:                  'id',
          display_meeting_type:              'ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ',
          display_bottom_sheet_header:       '々   P R O F I L E     ◦     I N F O   々',
          display_add_to_calendar_cta_text:  'CALENDAR',
          display_view_on_maps_cta_text:     'O W N E R     ◦     C O U N T R Y',
          display_manage_booking_cta_text:   'Follow for More',
          display_manage_booking_not_supported_text: 'OWNER NOT REGISTERED',
          display_read_more:                 'READ MORE'
        }
      })
    })
  } else {
    buttons.push({
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text: `👑 ᴍᴀɪɴ ᴏᴡɴᴇʀ`,
        url: `https://wa.me/${mainOwnerNum}`,
        merchant_url: `https://wa.me/${mainOwnerNum}`
      })
    })
  }

  const msg = generateWAMessageFromContent(
    chat,
    {
      interactiveMessage: {
        header: { title: headerTitle, hasMediaAttachment: false },
        body:   { text: bodyText },
        footer: { text: `© ${botName}` },
        nativeFlowMessage: { messageParamsJson: '{}', buttons }
      }
    },
    { userJid: mainOwnerNum ? `${mainOwnerNum}@s.whatsapp.net` : Morela.user.id, quoted: fkontak }
  )
  return Morela.relayMessage(chat, msg.message, { messageId: msg.key.id })
}

function readJson(filename: unknown) {
  const filePath = path.join(DATA_DIR, filename.endsWith('.json') ? filename : filename + '.json')
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const str = JSON.stringify(JSON.parse(raw), null, 2)
    return str.length > 3000 ? str.slice(0, 3000) + '\n\n...(terpotong)' : str
  } catch (e) { return `❌ Gagal baca: ${(e as Error).message}` }
}

function listJsonFiles() {
  try { return fs.readdirSync(DATA_DIR).filter((f: unknown) => f.endsWith('.json')) } catch { return [] }
}

function shortName(name: string, max: unknown = 25) {
  if (!name) return 'Grup'
  return name.length > max ? name.slice(0, max - 1) + '…' : name
}

const KEY_LABELS = {
  __aiStatus__:               { emoji: '🤖', name: 'Auto AI' },
  __aiHistory__:              { emoji: '🧠', name: 'AI History' },
  __chatCountDB__:            { emoji: '💬', name: 'Topchat' },
  __groupMetadataCache__:     { emoji: '📋', name: 'Group Cache' },
  __messageStore__:           { emoji: '💾', name: 'Message Store' },
  __dymDedup__:               { emoji: '🔍', name: 'Did You Mean' },
  __chatCountTimer__:         { emoji: '⏱️', name: 'Topchat Timer' },
  __chatCountExitRegistered__:{ emoji: '🔒', name: 'Exit Handler' },
  __sock__:                   { emoji: '🔌', name: 'Socket' },
  __scheduledTasks__:         { emoji: '📅', name: 'Scheduled Tasks' },
  __nananaSession__:          { emoji: '🍌', name: 'Nanana Session' },
}

function isGroupStatusMap(val: unknown) {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return false
  const keys = Object.keys(val)
  if (!keys.length) return false
  return keys.some((k: unknown) => k.endsWith('@g.us') || k.endsWith('@s.whatsapp.net'))
}

function resolveGroupName(jid: string) {
  try {
    const groups = getAllGroups()
    return groups[jid]?.name || jid.split('@')[0].slice(-8) + '...'
  } catch { return jid.split('@')[0].slice(-8) + '...' }
}

function buildKeyLines(key: string, val: unknown) {
  const label = KEY_LABELS[key] || { emoji: '⚙️', name: key.replace(/__/g, '') }
  const title = `${label.emoji} *${label.name}*`

  if (isGroupStatusMap(val)) {
    const activeEntries = Object.entries(val).filter(([, v]) => {
      if (typeof v === 'boolean') return v
      if (typeof v === 'object' && v !== null) return true
      return !!v
    })
    return `${title}: ${activeEntries.length} aktif`
  }

  let desc = ''
  if (val === null || val === undefined)  desc = '❌ tidak aktif'
  else if (typeof val === 'boolean')      desc = val ? '✅ aktif' : '❌ tidak aktif'
  else if (typeof val === 'number')       desc = String(val)
  else if (typeof val === 'string')       desc = val.slice(0, 60)
  else if (val instanceof Map)            desc = `${val.size} entry`
  else if (val instanceof Set)            desc = `${val.size} entry`
  else if (typeof val === 'function')     desc = 'function'
  else if (Array.isArray(val))            desc = `${val.length} item`
  else if (key === '__aiHistory__') {
    const users = Object.keys(val).length
    const msgs  = Object.values(val).reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0)
    desc = `${users} user, ${msgs} pesan`
  }
  else if (key === '__chatCountDB__') {
    const groups = Object.keys(val).filter((k: unknown) => k !== '_global').length
    const total  = val._global ? Object.keys(val._global).length : 0
    desc = `${groups} grup, ${total} user tercatat`
  }
  else if (key === '__nananaSession__') {
    const age = Math.round((Date.now() - val.createdAt) / 60000)
    desc = `aktif, ${age} menit lalu`
  }
  else {
    const size = Object.keys(val).length
    desc = size === 0 ? '(kosong)' : `${size} entries`
  }

  return `${title}: ${desc}`
}

function buildFeatureSection() {
  const skip = new Set([
    '__dirname', '__filename', '__extends', '__assign', '__rest',
    '__decorate', '__param', '__esDecorate', '__runInitializers', '__propKey',
    '__setFunctionName', '__metadata', '__awaiter', '__generator', '__exportStar',
    '__createBinding', '__values', '__read', '__spread', '__spreadArrays',
    '__spreadArray', '__await', '__asyncGenerator', '__asyncDelegator', '__asyncValues',
    '__makeTemplateObject', '__importStar', '__importDefault', '__classPrivateFieldGet',
    '__classPrivateFieldSet', '__classPrivateFieldIn', '__addDisposableResource',
    '__disposeResources', '__rewriteRelativeImportExtension'
  ])
  const filtered = Object.keys(globalThis).filter((k: unknown) => /^__[a-zA-Z].*__$/.test(k) && !skip.has(k))
  if (!filtered.length) return `⚡ *FITUR AKTIF*\n  • (tidak ada)`
  const lines = filtered.map((k: unknown) => buildKeyLines(k, globalThis[k]))
  return `⚡ *FITUR AKTIF (${filtered.length})*\n\n` + lines.join('\n\n')
}

const handler = async (m: any, { Morela, reply, args, fkontak }: any) => {

  const send = (header: string, body: string) => sendInteractive(Morela, m.chat, header, body, fkontak)
  const sub  = args[0]?.toLowerCase()

  if (sub === 'json') {
    const file = args[1]
    if (file) {
      const content = readJson(file)
      if (!content) return send(`C E K D B   ◦   J S O N`, `*乂  ᴄᴇᴋᴅʙ   ◦   ᴊꜱᴏɴ*\n✧ ꜱᴛᴀᴛᴜꜱ : ❌ *File tidak ditemukan*\n✧ ꜰɪʟᴇ : _${file}.json_`)
      return send(`C E K D B   ◦   J S O N`, `*乂  ᴄᴇᴋᴅʙ   ◦   ${file}.json*\n\n\`\`\`${content}\`\`\``)
    }
    const files = listJsonFiles()
    if (!files.length) return send(`C E K D B   ◦   J S O N`, `*乂  ᴄᴇᴋᴅʙ   ◦   ᴊꜱᴏɴ*\n✧ ɪɴꜰᴏ : _Tidak ada file JSON_`)
    return send(
      `C E K D B   ◦   J S O N`,
      `*乂  ᴄᴇᴋᴅʙ   ◦   ᴊꜱᴏɴ ꜰɪʟᴇꜱ (${files.length})*\n\n` +
      files.map((f: string, i: number) => {
        const size = fs.statSync(path.join(DATA_DIR, f)).size
        const kb   = size >= 1024 ? (size / 1024).toFixed(1) + ' KB' : size + ' B'
        return `✧ ${i + 1}. _${f}_ *(${kb})*`
      }).join('\n') +
      `\n\n✧ ɢᴜɴᴀᴋᴀɴ : _.cekdb json <nama>_`
    )
  }

  if (sub === 'own')  return send(`C E K D B   ◦   O W N`, `*乂  ᴄᴇᴋᴅʙ   ◦   ᴏᴡɴ*\n\n\`\`\`${JSON.stringify(kvGet('own', 'list', []), null, 2)}\`\`\``)
  if (sub === 'prem') return send(`C E K D B   ◦   P R E M`, `*乂  ᴄᴇᴋᴅʙ   ◦   ᴘʀᴇᴍ*\n\n\`\`\`${JSON.stringify(kvGet('prem', 'list', []), null, 2)}\`\`\``)
  if (sub === 'lid')  return send(`C E K D B   ◦   L I D`, `*乂  ᴄᴇᴋᴅʙ   ◦   ʟɪᴅᴍᴀᴘ*\n\n\`\`\`${JSON.stringify(getAllLidMap(), null, 2).slice(0, 3000)}\`\`\``)
  if (sub === 'self') return send(`C E K D B   ◦   S E L F`, `*乂  ᴄᴇᴋᴅʙ   ◦   ꜱᴇʟꜰᴍᴏᴅᴇ ɢʟᴏʙᴀʟ*\n\n\`\`\`${JSON.stringify({ active: kvGet('selfmode_global', 'active', false) }, null, 2)}\`\`\``)

  if (sub === 'user') {
    const target = m.mentionedJid?.[0] ||
      (args[1] ? args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : m.sender)
    const u = getUser(target)
    if (!u) return send(`C E K D B   ◦   U S E R`, `*乂  ᴄᴇᴋᴅʙ   ◦   ᴜꜱᴇʀ*\n✧ ꜱᴛᴀᴛᴜꜱ : ❌ *User tidak ditemukan*\n✧ ᴊɪᴅ : _${target}_`)
    const regDate = u.registered_at
      ? new Date(u.registered_at * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      : '-'
    return send(
      `C E K D B   ◦   U S E R`,
      `*乂  ᴄᴇᴋᴅʙ   ◦   ᴅᴀᴛᴀ ᴜꜱᴇʀ*\n` +
      `✧ ᴊɪᴅ     : _${u.jid}_\n` +
      `✧ ɴᴏᴍᴏʀ   : _${u.number}_\n` +
      `✧ ɴᴀᴍᴀ    : _${u.name || '-'}_\n` +
      `✧ ᴘʀᴇᴍɪᴜᴍ : _${u.is_premium === 1 ? '✅ Ya' : '❌ Tidak'}_\n` +
      `✧ ʙᴀɴɴᴇᴅ  : _${u.is_banned  === 1 ? '🚫 Ya' : '✅ Tidak'}_\n` +
      `✧ ᴅᴀꜰᴛᴀʀ  : _${regDate}_`
    )
  }

  if (sub === 'group') {
    const gid = args[1]?.trim()
    if (!gid) return send(`C E K D B   ◦   G R O U P`, `*乂  ᴄᴇᴋᴅʙ   ◦   ɢʀᴏᴜᴘ*\n✧ ꜱᴛᴀᴛᴜꜱ : ❌ *Masukkan Group JID*`)
    const g = getGroup(gid)
    if (!g) return send(`C E K D B   ◦   G R O U P`, `*乂  ᴄᴇᴋᴅʙ   ◦   ɢʀᴏᴜᴘ*\n✧ ꜱᴛᴀᴛᴜꜱ : ❌ *Grup tidak ditemukan*\n✧ ᴊɪᴅ : _${gid}_`)
    const updDate = g.updated_at
      ? new Date(g.updated_at * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      : '-'
    const onOff = (v) => v ? '🟢 ON' : '🔴 OFF'
    return send(
      `C E K D B   ◦   G R O U P`,
      `*乂  ᴄᴇᴋᴅʙ   ◦   ᴅᴀᴛᴀ ɢʀᴜᴘ*\n` +
      `✧ ɴᴀᴍᴀ      : _${g.name || '-'}_\n` +
      `✧ ᴏᴡɴᴇʀ     : _${g.owner || '-'}_\n` +
      `✧ ᴍᴇᴍʙᴇʀ    : _${g.participants?.length || 0}_\n\n` +
      `*乂  ꜰɪᴛᴜʀ*\n` +
      `✧ ᴡᴇʟᴄᴏᴍᴇ  : ${onOff(g.welcome)}\n` +
      `✧ ɢᴏᴏᴅʙʏᴇ  : ${onOff(g.goodbye)}\n` +
      `✧ ᴀɴᴛɪʟɪɴᴋ : ${onOff(g.antilink)}\n` +
      `✧ ꜱᴇʟꜰ ᴍᴏᴅᴇ: ${onOff(g.selfmode)}\n\n` +
      `✧ ᴅᴇꜱᴄ   : _${g.desc?.slice(0, 40) || '-'}_\n` +
      `✧ ᴜᴘᴅᴀᴛᴇ : _${updDate}_`
    )
  }

  if (sub === 'groups') {
    const list = Object.entries(getAllGroups())
    if (!list.length) return send(`C E K D B   ◦   G R O U P S`, `*乂  ᴄᴇᴋᴅʙ   ◦   ʟɪꜱᴛ ɢʀᴜᴘ*\n✧ ɪɴꜰᴏ : _Belum ada grup_`)
    const lines = list.slice(0, 25).map(([, g], i) => {
      const badges = [g.antilink ? '🔗' : '', g.welcome ? '👋' : '', g.goodbye ? '🚪' : '', g.selfmode ? '🤖' : ''].filter(Boolean).join('')
      return `✧ ${i + 1}. _${shortName(g.name)}_ (${g.participants?.length || 0}) ${badges}`
    })
    return send(
      `C E K D B   ◦   G R O U P S`,
      `*乂  ᴄᴇᴋᴅʙ   ◦   ʟɪꜱᴛ ɢʀᴜᴘ (${list.length})*\n\n` +
      lines.join('\n') +
      (list.length > 25 ? `\n✧ _...+${list.length - 25} lainnya_` : '') +
      `\n\n✧ 🔗=Antilink 👋=Welcome 🚪=Goodbye 🤖=SelfMode`
    )
  }

  if (sub === 'users') {
    const usersRaw = getUsers()
    const list = Object.values(usersRaw)
    if (!list.length) return send(`C E K D B   ◦   U S E R S`, `*乂  ᴄᴇᴋᴅʙ   ◦   ʟɪꜱᴛ ᴜꜱᴇʀ*\n✧ ɪɴꜰᴏ : _Belum ada user_`)
    const lines = list.map((u, i) =>
      `✧ ${i + 1}. _${u.name || 'User'}_ — ${u.number}` +
      (u.is_premium === 1 ? ' 💎' : '') + (u.is_banned === 1 ? ' 🚫' : '')
    )
    return send(`C E K D B   ◦   U S E R S`, `*乂  ᴄᴇᴋᴅʙ   ◦   ʟɪꜱᴛ ᴜꜱᴇʀ (${list.length})*\n\n` + lines.join('\n'))
  }

  if (sub === 'banned' || sub === 'premium') {
    const usersRaw = getUsers()
    const field = sub === 'banned' ? 'is_banned' : 'is_premium'
    const emoji = sub === 'banned' ? '🚫' : '💎'
    const label = sub === 'banned' ? 'ʙᴀɴɴᴇᴅ' : 'ᴘʀᴇᴍɪᴜᴍ'
    const list  = Object.values(usersRaw).filter((u: unknown) => u[field] === 1)
    if (!list.length) return send(`C E K D B   ◦   ${sub.toUpperCase()}`, `*乂  ᴄᴇᴋᴅʙ   ◦   ${label}*\n✧ ɪɴꜰᴏ : _Tidak ada_`)
    return send(
      `C E K D B   ◦   ${sub.toUpperCase()}`,
      `*乂  ᴄᴇᴋᴅʙ   ◦   ${emoji} ${label} (${list.length})*\n\n` +
      list.map((u, i) => `✧ ${i + 1}. _${u.name || 'User'}_ — ${u.number}`).join('\n')
    )
  }

  if (sub === 'features' || sub === 'fitur') {
    return send(`C E K D B   ◦   F I T U R`, `*乂  ᴄᴇᴋᴅʙ   ◦   ꜰɪᴛᴜʀ ᴀᴋᴛɪꜰ*\n\n` + buildFeatureSection())
  }

  if (!sub) {
    const totalUsers  = countUsers()
    const totalGroups = countGroups()

    let banCount = 0
    try {
      const usersRaw = getUsers()
      for (const u of Object.values(usersRaw)) {
        if (u.is_banned === 1) banCount++
      }
    } catch {}

    let welcomeOn = 0, goodbyeOn = 0, antilinkOn = 0, selfmodeOn = 0
    const welcomeGroups = [], goodbyeGroups = [], antilinkGroups = [], selfmodeGroups = []
    try {
      for (const [, g] of Object.entries(getAllGroups())) {
        const name = shortName(g.name)
        if (g.welcome)  { welcomeOn++;  welcomeGroups.push(name)  }
        if (g.goodbye)  { goodbyeOn++;  goodbyeGroups.push(name)  }
        if (g.antilink) { antilinkOn++; antilinkGroups.push(name) }
        if (g.selfmode) { selfmodeOn++; selfmodeGroups.push(name) }
      }
    } catch {}

    const listGrp = (arr) => arr.length ? arr.map((n: unknown) => `  • _${n}_`).join('\n') : '  • _(tidak ada)_'

    return send(
      `C E K D B   ◦   O V E R V I E W`,
      `*乂  ᴄᴇᴋᴅʙ   ◦   ᴅᴀᴛᴀʙᴀꜱᴇ ᴏᴠᴇʀᴠɪᴇᴡ*\n\n` +
      `*乂  ᴜꜱᴇʀꜱ*\n` +
      `✧ ᴛᴏᴛᴀʟ : _${totalUsers} user_\n` +
      `✧ ʙᴀɴɴᴇᴅ : _${banCount}_\n\n` +
      `*乂  ɢʀᴏᴜᴘꜱ (${totalGroups})*\n\n` +
      `✧ *ᴡᴇʟᴄᴏᴍᴇ ᴏɴ* (${welcomeOn})\n${listGrp(welcomeGroups)}\n\n` +
      `✧ *ɢᴏᴏᴅʙʏᴇ ᴏɴ* (${goodbyeOn})\n${listGrp(goodbyeGroups)}\n\n` +
      `✧ *ᴀɴᴛɪʟɪɴᴋ ᴏɴ* (${antilinkOn})\n${listGrp(antilinkGroups)}\n\n` +
      `✧ *ꜱᴇʟꜰ ᴍᴏᴅᴇ ᴏɴ* (${selfmodeOn})\n${listGrp(selfmodeGroups)}\n\n` +
      buildFeatureSection()
    )
  }

  return send(`C E K D B   ◦   E R R O R`, `*乂  ᴄᴇᴋᴅʙ   ◦   ᴇʀʀᴏʀ*\n✧ ꜱᴛᴀᴛᴜꜱ : ❌ *Sub-command tidak dikenal*\n✧ ɪɴꜰᴏ : _user, users, group, groups, banned, premium, json, fitur, own, prem, lid, self_`)
}

handler.help    = ['cekdb']
handler.tags    = ['owner']
handler.command = ['cekdb', 'checkdb', 'dbinfo']
handler.owner   = true
handler.noLimit = true

export default handler
