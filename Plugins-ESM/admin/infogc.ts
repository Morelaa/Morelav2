import fs   from 'fs'
import path from 'path'
import { botName, imagePath } from '../../Library/utils.js'
import { getAllGroups, getGroup, getPushName, deleteGroup, updateGroup } from '../../Database/db.js'
import { isSelfMode } from '../../System/selfmode.js'
import { ButtonV2 } from '../../Library/MessageBuilder.js'
import {
  isLidJid,
  resolveLidToPhone,
  normNum,
  findParticipant,
  findBotParticipant,
  isParticipantAdmin,
} from '../../Library/resolve.js'
function resolveOwnerName(ownerRaw: string, participants: any[]): string {
  if (!ownerRaw || ownerRaw === '-') return '-'
  const isLid = isLidJid(ownerRaw)
  const num   = isLid ? (resolveLidToPhone(ownerRaw) || normNum(ownerRaw)) : normNum(ownerRaw)
  const fromDB = getPushName(num) || getPushName(num + '@s.whatsapp.net')
  if (fromDB?.trim()) return fromDB.trim()
  if (participants?.length) {
    const p = findParticipant(participants, num)
    const name = p?.notify || p?.name || p?.verifiedName
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return num || ownerRaw
}
async function getGroupPP(Morela: any, groupJid: string): Promise<string | Buffer> {
  try {
    const url = await Morela.profilePictureUrl(groupJid, 'image')
    if (url) return url
  } catch {}
  if (fs.existsSync(imagePath)) return fs.readFileSync(imagePath)
  return 'https://cdn.ornzora.eu.cc/92fb27b5-5ffd-4f5f-905a-9b8d0573a1af-upload-1780208822400.jpg'
}
async function isGroupBotAdmin(Morela: any, groupJid: string, botJid: string): Promise<boolean> {
  try {
    const meta = await Morela.groupMetadata(groupJid)
    let participants = meta?.participants || []
    let botParticipant = findBotParticipant(participants, botJid)
    if (!botParticipant) {
      // Cache/metadata bisa basi, coba fetch ulang sekali sebelum nyerah.
      try {
        const liveMeta = await Morela.groupMetadata(groupJid)
        participants   = liveMeta?.participants || []
        botParticipant = findBotParticipant(participants, botJid)
      } catch {}
    }
    return isParticipantAdmin(botParticipant)
  } catch {
    return false
  }
}
function buildRows(groups: { jid: string; name: string; memberCount: number }[]) {
  return groups.map((g, i) => ({
    header:      `𝔊𝔯𝔲𝔭 ${i + 1}`,
    title:       g.name.length > 40 ? g.name.slice(0, 37) + '...' : g.name,
    description: `𝔐𝔢𝔪𝔟𝔢𝔯 : ${g.memberCount}  ◦  ${g.jid.replace('@g.us', '')}`,
    id:          `.infogc ${g.jid}`
  }))
}
const handler = async (m: any, { Morela, command, text, reply, isOwn, fkontak }: any) => {
  if (command === 'masukgc' || command === 'joingc') {
    if (!text) {
      return reply(
        `乂  *𝔐𝔞𝔰𝔲𝔨 𝔊𝔯𝔲𝔭*\n\n` +
        `\t◦  *𝔉𝔬𝔯𝔪𝔞𝔱* : .masukgc https://chat.whatsapp.com/xxxxx\n\n` +
        `_𝔅𝔬𝔱 𝔞𝔨𝔞𝔫 𝔟𝔢𝔯𝔤𝔞𝔟𝔲𝔫𝔤 𝔨𝔢 𝔤𝔯𝔲𝔭 𝔪𝔢𝔩𝔞𝔩𝔲𝔦 𝔩𝔦𝔫𝔨 𝔦𝔫𝔳𝔦𝔱𝔢._`
      )
    }
    const codeMatch = text.match(/(?:chat\.whatsapp\.com\/|whatsapp\.com\/invite\/)([A-Za-z0-9_-]+)/i)
    if (!codeMatch) {
      return reply(`乂  *𝔏𝔦𝔫𝔨 𝔱𝔦𝔡𝔞𝔨 𝔳𝔞𝔩𝔦𝔡*\n\n\t◦  Gunakan format : https://chat.whatsapp.com/XXXXXX`)
    }
    const inviteCode = codeMatch[1]
    try {
      await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
      const result = await Morela.groupAcceptInvite(inviteCode)
      await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
      return reply(
        `乂  *𝔅𝔢𝔯𝔥𝔞𝔰𝔦𝔩 𝔐𝔞𝔰𝔲𝔨 𝔊𝔯𝔲𝔭*\n\n` +
        `\t◦  *𝔎𝔬𝔡𝔢* : ${inviteCode}\n` +
        `\t◦  *𝔍𝔦𝔡*  : ${result || 'tidak tersedia'}`
      )
    } catch (e: any) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      const msg = (e?.message || '').toLowerCase()
      const info = msg.includes('gone')
        ? 'Link sudah tidak valid / kedaluwarsa.'
        : msg.includes('not-authorized') || msg.includes('forbidden')
          ? 'Bot tidak diizinkan bergabung.'
          : msg.includes('already') || msg.includes('participant')
            ? 'Bot sudah ada di dalam grup.'
            : e?.message || 'Error tidak diketahui.'
      return reply(`乂  *𝔊𝔞𝔤𝔞𝔩 𝔐𝔞𝔰𝔲𝔨 𝔊𝔯𝔲𝔭*\n\n\t◦  *𝔄𝔩𝔞𝔰𝔞𝔫* : ${info}`)
    }
  }
  if (command === 'outgc') {
    if (!text || !text.trim().endsWith('@g.us')) {
      return reply(
        `乂  *𝔒𝔲𝔱 𝔊𝔯𝔲𝔭*\n\n` +
        `\t◦  *𝔉𝔬𝔯𝔪𝔞𝔱* : .outgc <jid@g.us>\n\n` +
        `_Gunakan infogc dulu untuk pilih grup._`
      )
    }
    const targetJid = text.trim()
    let groupName = targetJid
    try {
      const meta = await Morela.groupMetadata(targetJid)
      groupName = meta?.subject || targetJid
    } catch {}
    try {
      await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
      await Morela.groupLeave(targetJid)
      deleteGroup(targetJid)
      await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
      return reply(
        `乂  *𝔅𝔬𝔱 𝔅𝔢𝔯𝔥𝔞𝔰𝔦𝔩 𝔎𝔢𝔩𝔲𝔞𝔯*\n\n` +
        `\t◦  *𝔑𝔞𝔪𝔞* : ${groupName}\n` +
        `\t◦  *𝔍𝔦𝔡*  : ${targetJid.replace('@g.us', '')}`
      )
    } catch (e: any) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(
        `乂  *𝔊𝔞𝔤𝔞𝔩 𝔎𝔢𝔩𝔲𝔞𝔯*\n\n` +
        `\t◦  *𝔑𝔞𝔪𝔞*  : ${groupName}\n` +
        `\t◦  *𝔈𝔯𝔯𝔬𝔯* : ${e?.message || 'Unknown error'}`
      )
    }
  }
  if (command === 'infogc' && text && text.trim().endsWith('@g.us')) {
    const targetJid = text.trim()
    await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
    let meta: any = null
    try { meta = await Morela.groupMetadata(targetJid) } catch {}
    const dbData    = getGroup(targetJid)
    const name      = meta?.subject || dbData?.subject || targetJid
    const members   = meta?.participants?.length ?? dbData?.participants?.length ?? 0
    const ownerRaw  = meta?.owner || dbData?.owner || '-'
    const desc      = String(meta?.desc || dbData?.desc || '-').slice(0, 60)
    const parts     = meta?.participants || dbData?.participants || []
    const ownerName = resolveOwnerName(ownerRaw, parts)
    // FIX INFOGC: pakai Morela.decodeJid() biar konsisten sama cara
    // Morela.ts resolve botJid — Morela.user?.id mentah kadang masih
    // ada suffix device (:xx) atau format @lid yang bikin compare gagal.
    let botJid = ''
    try {
      const decoded = await Morela.decodeJid(Morela.user?.id ?? '')
      botJid = decoded.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
    } catch {
      botJid = Morela.user?.id || ''
    }
    const isAdmin   = await isGroupBotAdmin(Morela, targetJid, botJid)
    const selfMode  = isSelfMode(targetJid)
    const dbG       = dbData as any
    const welcome   = dbG?.welcome   ?? false
    const goodbye   = dbG?.goodbye   ?? false
    const antilink  = dbG?.antilink  ?? false
    const antigrup  = dbG?.antigrup  ?? false
    const openclose = dbG?.openclose ?? false
    const yn    = (v: boolean) => v ? '√' : 'x'
    const onoff = (v: boolean) => v ? 'ON' : 'OFF'
    const bodyText =
      `乂  *𝔊 𝔯 𝔬 𝔲 𝔭   𝔦 𝔫 𝔣 𝔬*\n\n` +
      `\t◦  *𝔑𝔞𝔪𝔞*   : ${name}\n` +
      `\t◦  *𝔍𝔦𝔡*    : ${targetJid.replace('@g.us', '')}\n` +
      `\t◦  *𝔐𝔢𝔪𝔟𝔢𝔯* : ${members}\n` +
      `\t◦  *𝔒𝔴𝔫𝔢𝔯*  : ${ownerName}\n` +
      `\t◦  *𝔇𝔢𝔰𝔠*   : ${desc}\n\n` +
      `乂  *𝔖 𝔱 𝔞 𝔱 𝔲 𝔰   𝔅 𝔬 𝔱*\n\n` +
      `\t◦  *𝔅𝔬𝔱 𝔄𝔡𝔪𝔦𝔫*  : *${yn(isAdmin)}*\n` +
      `\t◦  *𝔖𝔢𝔩𝔣 𝔐𝔬𝔡𝔢*  : *${onoff(selfMode)}*\n\n` +
      `乂  *𝔉 𝔦 𝔱 𝔲 𝔯*\n\n` +
      `\t◦  *𝔚𝔢𝔩𝔠𝔬𝔪𝔢*    : *${onoff(welcome)}*\n` +
      `\t◦  *𝔊𝔬𝔬𝔡𝔟𝔶𝔢*    : *${onoff(goodbye)}*\n` +
      `\t◦  *𝔄𝔫𝔱𝔦𝔩𝔦𝔫𝔨*   : *${onoff(antilink)}*\n` +
      `\t◦  *𝔄𝔫𝔱𝔦𝔤𝔯𝔲𝔭*   : *${onoff(antigrup)}*\n` +
      `\t◦  *𝔒𝔭𝔢𝔫/𝔠𝔩𝔬𝔰𝔢* : *${onoff(openclose)}*`
    const ppThumb = await getGroupPP(Morela, targetJid)
    try {
      const btn = new ButtonV2(Morela)
        .setTitle(name)
        .setSubtitle(`𝔐𝔢𝔪𝔟𝔢𝔯 : ${members}`)
        .setBody(bodyText)
        .setFooter(`© ${botName}`)
      btn.setThumbnail(ppThumb)
      btn.addButton('𝔒𝔲𝔱 𝔊𝔯𝔲𝔭', `.outgc ${targetJid}`)
      const msg = await btn.build(targetJid, { userJid: Morela.user?.id })
      msg.key.remoteJid = m.chat
      await Morela.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    } catch (e: any) {
      console.error('[INFOGC] ButtonV2 error:', e.message)
      await Morela.sendMessage(m.chat, {
        text: bodyText,
        footer: `© ${botName}`
      }, { quoted: fkontak || m })
    }
    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
    return
  }
  if (command === 'infogc') {
    await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
    let groupList: { jid: string; name: string; memberCount: number }[] = []
    try {
      const dbGroups = getAllGroups()
      // Cross-check dengan WA langsung — hapus grup yang bot sudah tidak ikut
      try {
        const activeJids = new Set(Object.keys(await Morela.groupFetchAllParticipating()))
        for (const jid of Object.keys(dbGroups)) {
          if (!activeJids.has(jid)) {
            deleteGroup(jid)
            delete dbGroups[jid]
            console.log(`[INFOGC] Grup stale dihapus: ${jid}`)
          }
        }
      } catch { /* non-fatal, lanjut pakai DB */ }
      const jids = Object.keys(dbGroups)
      if (!jids.length) {
        await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        return reply(`乂  *𝔦𝔫𝔣𝔬 𝔤𝔠*\n\n\t◦  Bot tidak berada di grup manapun.`)
      }
      const results = await Promise.allSettled(
        jids.slice(0, 50).map(async (jid) => {
          try {
            const meta = await Morela.groupMetadata(jid)
            return {
              jid,
              name:        meta?.subject             || dbGroups[jid]?.subject || jid,
              memberCount: meta?.participants?.length ?? dbGroups[jid]?.participants?.length ?? 0
            }
          } catch {
            return {
              jid,
              name:        dbGroups[jid]?.subject || jid,
              memberCount: dbGroups[jid]?.participants?.length ?? 0
            }
          }
        })
      )
      groupList = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<{ jid: string; name: string; memberCount: number }>).value)
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch (e: any) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`乂  *𝔈𝔯𝔯𝔬𝔯*\n\n\t◦  Gagal mengambil daftar grup : ${e?.message}`)
    }
    if (!groupList.length) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`乂  *𝔦𝔫𝔣𝔬 𝔤𝔠*\n\n\t◦  Bot tidak berada di grup manapun.`)
    }
    const MAX_PER_SECTION = 10
    const sections: { title: string; rows: ReturnType<typeof buildRows> }[] = []
    for (let i = 0; i < groupList.length; i += MAX_PER_SECTION) {
      const slice = groupList.slice(i, i + MAX_PER_SECTION)
      sections.push({
        title: `𝔊𝔯𝔲𝔭 ${i + 1}–${Math.min(i + MAX_PER_SECTION, groupList.length)} 𝔡𝔞𝔯𝔦 ${groupList.length}`,
        rows:  buildRows(slice)
      })
    }
    const caption =
      `乂  *𝔦 𝔫 𝔣 𝔬   𝔤 𝔠*\n\n` +
      `\t◦  *𝔗𝔬𝔱𝔞𝔩 𝔊𝔯𝔲𝔭* : ${groupList.length}\n\n` +
      `_𝔎𝔢𝔱𝔲𝔨 𝔫𝔞𝔪𝔞 𝔤𝔯𝔲𝔭 𝔲𝔫𝔱𝔲𝔨 𝔩𝔦𝔥𝔞𝔱 𝔦𝔫𝔣𝔬 𝔩𝔢𝔫𝔤𝔨𝔞𝔭._`
    const thumb = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : undefined

    // Upload gambar dulu ke bot jika ada
    let imgMsg: any = null
    if (thumb) {
      try {
        const uploaded = await Morela.sendMessage('867051314767696@bot', { image: thumb, caption: '' }) as any
        imgMsg = uploaded?.message?.imageMessage
      } catch {}
    }

    const fk = fkontak || m
    await Morela.relayMessage(
      m.chat,
      {
        interactiveMessage: {
          ...(imgMsg
            ? { header: { hasMediaAttachment: true, imageMessage: imgMsg } }
            : { header: { hasMediaAttachment: false } }
          ),
          body:   { text: caption },
          footer: { text: `© ${botName}` },
          contextInfo: {
            forwardingScore: 1, isForwarded: true,
            quotedMessage: fk?.message
          },
          nativeFlowMessage: {
            buttons: [{
              name: 'single_select',
              buttonParamsJson: JSON.stringify({
                title:    '𝔓𝔦𝔩𝔦𝔥 𝔊𝔯𝔲𝔭',
                sections
              })
            }]
          }
        }
      },
      { messageId: Morela.generateMessageTag() }
    )
    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
  }
}
handler.command  = ['infogc', 'outgc', 'masukgc', 'joingc']
handler.owner    = true
handler.tags     = ['owner']
handler.help     = ['infogc', 'infogc <jid@g.us>', 'outgc <jid@g.us>', 'masukgc <link>']
handler.noLimit  = true
export default handler