import fs   from 'fs'
import { getAllGroups }     from '../../Database/db.js'
import { botName, ownerName, imagePath } from '../../Library/utils.js'
import {
  isSelfMode,
  setSelfMode,
  isSelfModeGlobal,
  setSelfModeGlobal,
} from '../../System/selfmode.js'

/* ────────────────────────────────────────────────────────────────
   Helper: bubble interaktif (tombol "main owner") dipakai di semua reply
   ──────────────────────────────────────────────────────────────── */
async function sendInteractive(
  Morela: any,
  chatJid: string,
  headerTitle: string,
  bodyText: string,
  fkontak: any
) {
  const { generateWAMessageFromContent } = await import('@itsliaaa/baileys')
  const { getMainOwner }                 = await import('../../System/mainowner.js')
  const mainOwnerNum                     = getMainOwner()
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
    chatJid,
    {
      interactiveMessage: {
        header: { title: headerTitle, hasMediaAttachment: false },
        body:   { text: bodyText },
        footer: { text: `© ${botName}` },
        nativeFlowMessage: { messageParamsJson: '{}', buttons }
      }
    },
    {
      userJid: mainOwnerNum ? `${mainOwnerNum}@s.whatsapp.net` : Morela.user.id,
      quoted:  fkontak
    }
  )
  await Morela.relayMessage(chatJid, msg.message, { messageId: msg.key.id })
}

/* ────────────────────────────────────────────────────────────────
   Helper: bangun rows untuk list "pilih grup" — klik = toggle langsung
   ──────────────────────────────────────────────────────────────── */
function buildSelfmodeRows(
  groups: { jid: string; name: string; memberCount: number; selfOn: boolean }[],
  cmdPrefix: string = '.selfmode'
) {
  return groups.map((g, i) => {
    const emoji  = g.selfOn ? '🟢' : '🔴'
    const status = g.selfOn ? 'Self Mode ON' : 'Public Mode'
    return {
      header:      `𝔊𝔯𝔲𝔭 ${i + 1}`,
      title:       g.name.length > 40 ? g.name.slice(0, 37) + '...' : g.name,
      description: `${emoji} ${status}  ◦  Member: ${g.memberCount}  ◦  Klik untuk toggle`,
      id:          `${cmdPrefix} ${g.jid}`
    }
  })
}

/* ────────────────────────────────────────────────────────────────
   Helper: fetch list grup dari DB + groupMetadata
   ──────────────────────────────────────────────────────────────── */
async function fetchGroupList(Morela: any) {
  const dbGroups = getAllGroups()
  const jids     = Object.keys(dbGroups)
  if (!jids.length) return []

  const results = await Promise.allSettled(
    jids.slice(0, 50).map(async (jid) => {
      try {
        const meta = await Morela.groupMetadata(jid)
        return {
          jid,
          name:        meta?.subject             || (dbGroups[jid] as any)?.subject || jid,
          memberCount: meta?.participants?.length ?? (dbGroups[jid] as any)?.participants?.length ?? 0,
          selfOn:      isSelfMode(jid)
        }
      } catch {
        return {
          jid,
          name:        (dbGroups[jid] as any)?.subject || jid,
          memberCount: (dbGroups[jid] as any)?.participants?.length ?? 0,
          selfOn:      isSelfMode(jid)
        }
      }
    })
  )

  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<any>).value)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/* ────────────────────────────────────────────────────────────────
   Helper: kirim list grup sebagai interactive list message
   ──────────────────────────────────────────────────────────────── */
async function sendGroupList(
  Morela: any,
  from: string,
  m: any,
  fkontak: any,
  groupList: any[],
  cmdPrefix: string,
  extraCaption: string = ''
) {
  const selfOnCount = groupList.filter(g => g.selfOn).length
  const globalOn    = isSelfModeGlobal()
  const MAX_PER     = 10
  const sections: { title: string; rows: any[] }[] = []

  for (let i = 0; i < groupList.length; i += MAX_PER) {
    const slice = groupList.slice(i, i + MAX_PER)
    sections.push({
      title: `𝔊𝔯𝔲𝔭 ${i + 1}–${Math.min(i + MAX_PER, groupList.length)} ᴅᴀʀɪ ${groupList.length}`,
      rows:  buildSelfmodeRows(slice, cmdPrefix)
    })
  }

  const caption =
    `乂  *ꜱ ᴇ ʟ ꜰ   ᴍ ᴏ ᴅ ᴇ   ◦   ᴅ ᴀ ꜰ ᴛ ᴀ ʀ   ɢ ʀ ᴜ ᴘ*\n\n` +
    `\t◦  *ᴛᴏᴛᴀʟ ɢʀᴜᴘ*  : ${groupList.length}\n` +
    `\t◦  *ꜱᴇʟꜰ ᴍᴏᴅᴇ*  : 🟢 ${selfOnCount} ɢʀᴜᴘ  ◦  🔴 ${groupList.length - selfOnCount} ɢʀᴜᴘ\n` +
    (globalOn ? `\t◦  *ɢʟᴏʙᴀʟ*      : ⚡ _ᴀᴋᴛɪꜰ — ꜱᴇᴍᴜᴀ ɢʀᴜᴘ ᴏᴛᴏᴍᴀᴛɪꜱ ꜱᴇʟꜰ ᴍᴏᴅᴇ_\n` : '') +
    extraCaption +
    `\n_𝔎𝔩𝔦𝔨 𝔫𝔞𝔪𝔞 𝔤𝔯𝔲𝔭 𝔲𝔫𝔱𝔲𝔨 𝔩𝔞𝔫𝔤𝔰𝔲𝔫𝔤 𝔱𝔬𝔤𝔤𝔩𝔢 𝔰𝔢𝔩𝔣 𝔪𝔬𝔡𝔢_`

  const thumb = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : undefined

  // Upload gambar dulu ke bot jika ada, supaya bisa dipakai di interactiveMessage header
  let imgMsg: any = null
  if (thumb) {
    try {
      const uploaded = await Morela.sendMessage('867051314767696@bot', { image: thumb, caption: '' }) as any
      imgMsg = uploaded?.message?.imageMessage
    } catch {}
  }

  const fk = fkontak || m
  await Morela.relayMessage(from, {
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
  }, { messageId: Morela.generateMessageTag() })
}

const handler = async (m: any, { Morela, command, args, reply, fkontak }: any) => {
  const from = m.chat

  /* ══════════════════════════════════════════════════════════════
     COMMAND: .selfstatus
     Tampilkan status global + per-grup.
     - Jika global ON  → tampilkan list grup, klik untuk jadikan public (nonaktifkan satu grup)
     - Jika global OFF → tampilkan info ringkas, arahkan ke .selfmode
     ══════════════════════════════════════════════════════════════ */
  if (command === 'selfstatus') {
    const globalOn = isSelfModeGlobal()

    if (globalOn) {
      // Global aktif — tampilkan list grup, klik untuk set public satu per satu
      await Morela.sendMessage(from, { react: { text: '⏳', key: m.key } })
      const groupList = await fetchGroupList(Morela)

      if (!groupList.length) {
        await Morela.sendMessage(from, { react: { text: '❌', key: m.key } })
        return reply(`乂  *ꜱᴇʟꜰ ꜱᴛᴀᴛᴜꜱ*\n\n\t◦  Bot tidak berada di grup manapun.`)
      }

      await sendGroupList(
        Morela, from, m, fkontak,
        groupList,
        '.selfstatus_toggle',
        `\t◦  *ᴋʟɪᴋ ɢʀᴜᴘ ᴅɪ ʙᴀᴡᴀʜ* ᴜɴᴛᴜᴋ ᴊᴀᴅɪᴋᴀɴ ᴘᴜʙʟɪᴄ\n`
      )
      await Morela.sendMessage(from, { react: { text: '✅', key: m.key } })
      return
    }

    // Global OFF — tampilkan status ringkas per-grup
    const dbGroups = getAllGroups()
    const jids     = Object.keys(dbGroups)
    const onGroups = jids
      .filter(jid => isSelfMode(jid))
      .map(jid => ({
        jid,
        name: (dbGroups[jid] as any)?.subject || jid
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (!onGroups.length) {
      return sendInteractive(
        Morela, from,
        '𝗣 𝗨 𝗕 𝗟 𝗜 𝗖   ◦   𝗦 𝗧 𝗔 𝗧 𝗨 𝗦',
        `*乂  ꜱᴇʟꜰ ᴍᴏᴅᴇ   ◦   ꜱᴛᴀᴛᴜꜱ*\n\n` +
        `✧ ᴍᴏᴅᴇ   : 🔴 *PUBLIC — ᴛɪᴅᴀᴋ ᴀᴅᴀ ɢʀᴜᴘ ʏᴀɴɢ ꜱᴇʟꜰ ᴍᴏᴅᴇ*\n` +
        `✧ ɪɴꜰᴏ   : _Bot ʀᴇꜱᴘᴏɴ ꜱᴇᴍᴜᴀ ᴜꜱᴇʀ ᴅɪ ꜱᴇᴍᴜᴀ ɢʀᴜᴘ_\n` +
        `✧ ᴋᴇᴛɪᴋ : *.selfmode* _ᴜɴᴛᴜᴋ ᴀᴋᴛɪꜰᴋᴀɴ ᴅɪ ɢʀᴜᴘ ᴛᴇʀᴛᴇɴᴛᴜ_`,
        fkontak || m
      )
    }

    const listText = onGroups
      .map((g, i) => `   ${i + 1}. ${g.name}`)
      .join('\n')

    return sendInteractive(
      Morela, from,
      '𝗦 𝗘 𝗟 𝗙   ◦   𝗦 𝗧 𝗔 𝗧 𝗨 𝗦',
      `*乂  ꜱᴇʟꜰ ᴍᴏᴅᴇ   ◦   ꜱᴛᴀᴛᴜꜱ*\n\n` +
      `✧ ᴍᴏᴅᴇ   : 🟡 *PER-GRUP — ɢʟᴏʙᴀʟ ᴛɪᴅᴀᴋ ᴀᴋᴛɪꜰ*\n` +
      `✧ ᴛᴏᴛᴀʟ   : *${onGroups.length} ɢʀᴜᴘ* ꜱᴇᴅᴀɴɢ ꜱᴇʟꜰ ᴍᴏᴅᴇ\n\n` +
      `*乂 Daftar grup:*\n${listText}\n\n` +
      `✧ ᴋᴇᴛɪᴋ : *.selfmode* _ᴜɴᴛᴜᴋ ᴋᴇʟᴏʟᴀ ᴘᴇʀ ɢʀᴜᴘ_`,
      fkontak || m
    )
  }

  /* ══════════════════════════════════════════════════════════════
     COMMAND: .selfstatus_toggle <jid@g.us>
     Diklik dari list selfstatus (saat global ON) → set grup itu ke public
     ══════════════════════════════════════════════════════════════ */
  if (command === 'selfstatus_toggle' && args[0] && args[0].endsWith('@g.us')) {
    const grpJid = args[0]

    // Paksa set public (off) untuk grup ini — override global
    setSelfMode(grpJid, false)

    let grpName = grpJid
    try {
      const meta = await Morela.groupMetadata(grpJid)
      grpName    = meta?.subject || grpJid
    } catch {}

    return sendInteractive(
      Morela, from,
      '𝗣 𝗨 𝗕 𝗟 𝗜 𝗖   ◦   𝗠 𝗢 𝗗 𝗘',
      `*乂  ꜱᴇʟꜰ ꜱᴛᴀᴛᴜꜱ   ◦   ᴅɪᴜᴘᴅᴀᴛᴇ*\n\n` +
      `✧ ɢʀᴜᴘ    : _${grpName}_\n` +
      `✧ ꜱᴛᴀᴛᴜꜱ : 🔴 *ᴘᴜʙʟɪᴄ ᴍᴏᴅᴇ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ*\n` +
      `✧ ɴᴏᴛᴇ    : _⚡ ɢʟᴏʙᴀʟ ꜱᴇʟꜰ ᴍᴀꜱɪʜ ᴀᴋᴛɪꜰ, ɴᴀᴍᴜɴ ɢʀᴜᴘ ɪɴɪ ᴅɪᴋᴇᴄᴜᴀʟɪᴋᴀɴ_\n` +
      `✧ ɪɴꜰᴏ    : _Bot ʀᴇꜱᴘᴏɴ ꜱᴇᴍᴜᴀ ᴜꜱᴇʀ ᴅɪ ɢʀᴜᴘ ɪɴɪ_\n` +
      `✧ ᴋᴇᴛɪᴋ  : *.selfstatus* _ᴜɴᴛᴜᴋ ʟɪʜᴀᴛ ꜱᴛᴀᴛᴜꜱ ʟᴇɴɢᴋᴀᴘ_`,
      fkontak || m
    )
  }

  /* ══════════════════════════════════════════════════════════════
     COMMAND: .selfglobal
     Toggle GLOBAL self mode ON/OFF sekaligus semua grup
     Jika global ON → matikan global (semua grup jadi public)
     Jika global OFF → aktifkan global (semua grup jadi self mode)
     ══════════════════════════════════════════════════════════════ */
  if (command === 'selfglobal') {
    const wantOn = !isSelfModeGlobal()
    const total  = setSelfModeGlobal(wantOn)
    return sendInteractive(
      Morela, from,
      wantOn ? '𝗦 𝗘 𝗟 𝗙   ◦   𝗚 𝗟 𝗢 𝗕 𝗔 𝗟' : '𝗣 𝗨 𝗕 𝗟 𝗜 𝗖   ◦   𝗚 𝗟 𝗢 𝗕 𝗔 𝗟',
      `*乂  ꜱᴇʟꜰ ɢʟᴏʙᴀʟ   ◦   ${wantOn ? 'ᴅɪᴀᴋᴛɪꜰᴋᴀɴ' : 'ᴅɪɴᴏɴᴀᴋᴛɪꜰᴋᴀɴ'}*\n\n` +
      `✧ ꜱᴛᴀᴛᴜꜱ : ${wantOn ? '🟢 *ɢʟᴏʙᴀʟ ꜱᴇʟꜰ ᴍᴏᴅᴇ ᴀᴋᴛɪꜰ*' : '🔴 *ɢʟᴏʙᴀʟ ᴍᴏᴅᴇ ᴘᴜʙʟɪᴄ*'}\n` +
      `✧ ᴛᴏᴛᴀʟ   : _${total} ɢʀᴜᴘ ᴅɪᴜᴘᴅᴀᴛᴇ ꜱᴇᴋᴀʟɪɢᴜꜱ_\n` +
      `✧ ɪɴꜰᴏ   : ${wantOn
        ? '_Bot ʜᴀɴʏᴀ ʀᴇꜱᴘᴏɴ ᴏᴡɴᴇʀ ᴅɪ ꜱᴇᴍᴜᴀ ɢʀᴜᴘ ᴅᴀɴ ᴄʜᴀᴛ ᴘʀɪʙᴀᴅɪ_'
        : '_Bot ʀᴇꜱᴘᴏɴ ꜱᴇᴍᴜᴀ ᴜꜱᴇʀ ꜱᴇᴘᴇʀᴛɪ ʙɪᴀꜱᴀ_'}\n` +
      (wantOn ? `✧ ᴛɪᴘ     : _ᴋᴇᴛɪᴋ *.selfstatus* ᴜɴᴛᴜᴋ ᴋᴇᴄᴜᴀʟɪᴋᴀɴ ɢʀᴜᴘ ᴛᴇʀᴛᴇɴᴛᴜ_` : ''),
      fkontak || m
    )
  }

  /* ══════════════════════════════════════════════════════════════
     COMMAND: .selfmode <jid@g.us>
     Diklik dari list → toggle per-grup
     ══════════════════════════════════════════════════════════════ */
  if (command === 'selfmode' && args[0] && args[0].endsWith('@g.us')) {
    const grpJid = args[0]
    const wantOn = !isSelfMode(grpJid)
    setSelfMode(grpJid, wantOn)

    let grpName = grpJid
    try {
      const meta = await Morela.groupMetadata(grpJid)
      grpName    = meta?.subject || grpJid
    } catch {}

    return sendInteractive(
      Morela, from,
      wantOn ? '𝗦 𝗘 𝗟 𝗙   ◦   𝗠 𝗢 𝗗 𝗘' : '𝗣 𝗨 𝗕 𝗟 𝗜 𝗖   ◦   𝗠 𝗢 𝗗 𝗘',
      `*乂  ꜱᴇʟꜰ ᴍᴏᴅᴇ   ◦   ${wantOn ? 'ᴅɪᴀᴋᴛɪꜰᴋᴀɴ' : 'ᴅɪɴᴏɴᴀᴋᴛɪꜰᴋᴀɴ'}*\n\n` +
      `✧ ꜱᴛᴀᴛᴜꜱ : ${wantOn ? '🟢 *ꜱᴇʟꜰ ᴍᴏᴅᴇ ᴀᴋᴛɪꜰ*' : '🔴 *ᴍᴏᴅᴇ ᴘᴜʙʟɪᴄ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ*'}\n` +
      `✧ ɢʀᴜᴘ   : _${grpName}_\n` +
      (isSelfModeGlobal()
        ? `✧ ɴᴏᴛᴇ    : _⚡ ɢʟᴏʙᴀʟ ꜱᴇʟꜰ ᴍᴀꜱɪʜ ᴀᴋᴛɪꜰ, ɢᴜɴᴀᴋᴀɴ *.selfstatus* ᴜɴᴛᴜᴋ ᴋᴇʟᴏʟᴀ ᴘᴇʀ-ɢʀᴜᴘ_\n`
        : `✧ ɪɴꜰᴏ   : ${wantOn
            ? '_Bot ʜᴀɴʏᴀ ʀᴇꜱᴘᴏɴ ᴏᴡɴᴇʀ ᴅɪ ɢʀᴜᴘ ɪɴɪ_'
            : '_Bot ʀᴇꜱᴘᴏɴ ꜱᴇᴍᴜᴀ ᴜꜱᴇʀ ᴅɪ ɢʀᴜᴘ ɪɴɪ_'}\n`),
      fkontak || m
    )
  }

  /* ══════════════════════════════════════════════════════════════
     COMMAND: .selfmode (tanpa argumen) — tampilkan list semua grup
     Klik nama grup → toggle langsung
     ══════════════════════════════════════════════════════════════ */
  if (command === 'selfmode') {
    await Morela.sendMessage(from, { react: { text: '⏳', key: m.key } })

    const groupList = await fetchGroupList(Morela)

    if (!groupList.length) {
      await Morela.sendMessage(from, { react: { text: '❌', key: m.key } })
      return reply(`乂  *ꜱᴇʟꜰ ᴍᴏᴅᴇ*\n\n\t◦  Bot tidak berada di grup manapun.`)
    }

    await sendGroupList(Morela, from, m, fkontak, groupList, '.selfmode')
    await Morela.sendMessage(from, { react: { text: '✅', key: m.key } })
  }
}

handler.command  = ['selfmode', 'selfglobal', 'selfstatus', 'selfstatus_toggle']
handler.owner    = true
handler.noLimit  = true
handler.tags     = ['owner']
handler.help     = [
  'selfmode                 — daftar semua grup, klik nama grup untuk toggle self mode per-grup',
  'selfglobal               — toggle SELF MODE GLOBAL, aktifkan/matikan di semua grup sekaligus',
  'selfstatus               — cek status global & per-grup; jika global ON, klik grup untuk jadikan public',
]

export default handler
