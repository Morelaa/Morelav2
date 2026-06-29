import fs from 'fs'
import { CHANNEL_URL, imagePath, botName, ownerName } from '../../Library/utils.js'
import { isJadibot, removeJadibot } from '../../Library/jadibotdb.js'
import { invalidateOwnerCache } from '../../Morela.js'
import { getOwnerType } from './setownertype.js'
import { isMainOwner, normNum, resolveLidToPhone } from '../../Library/resolve.js'
import { kvGet, kvSet } from '../../Database/kvstore.js'

const DEFAULT_RULES: string[] = []

function readRules(): string[] {
  try {
    return kvGet<string[]>('ownerrules', 'list', [])
  } catch {
    return []
  }
}

async function saveRules(rules: string[]): Promise<void> {
  kvSet('ownerrules', 'list', rules)
}

async function readOwners() {
  return kvGet<unknown[]>('own', 'list', [])
}

async function saveOwners(owners: unknown) {
  kvSet('own', 'list', owners)
  global.owner = [...(owners as unknown[])]
}

function getCountryInfo(num: string): { flag: string; name: string; flagPair: string } {
  if (num.startsWith('62'))  return { flag: '🇮🇩', name: 'Indonesia',      flagPair: '🇮🇩Indonesia🇮🇩' }
  if (num.startsWith('1') && num.length >= 11)
                             return { flag: '🇨🇦', name: 'Canada',         flagPair: '🇨🇦Canada🇨🇦' }
  if (num.startsWith('44'))  return { flag: '🇬🇧', name: 'United Kingdom', flagPair: '🇬🇧United Kingdom🇬🇧' }
  if (num.startsWith('60'))  return { flag: '🇲🇾', name: 'Malaysia',       flagPair: '🇲🇾Malaysia🇲🇾' }
  if (num.startsWith('65'))  return { flag: '🇸🇬', name: 'Singapore',      flagPair: '🇸🇬Singapore🇸🇬' }
  if (num.startsWith('63'))  return { flag: '🇵🇭', name: 'Philippines',    flagPair: '🇵🇭Philippines🇵🇭' }
  if (num.startsWith('84'))  return { flag: '🇻🇳', name: 'Vietnam',        flagPair: '🇻🇳Vietnam🇻🇳' }
  if (num.startsWith('66'))  return { flag: '🇹🇭', name: 'Thailand',       flagPair: '🇹🇭Thailand🇹🇭' }
  return { flag: '🌐', name: 'International', flagPair: '🌐International🌐' }
}

function formatPhone(num: string): string {
  if (num.startsWith('62')) {
    const r = num.slice(2)
    return `+62 ${r.slice(0,3)}-${r.slice(3,7)}-${r.slice(7)}`
  }
  if (num.startsWith('1') && num.length === 11) {
    return `+1 ${num.slice(1,4)}-${num.slice(4,7)}-${num.slice(7)}`
  }
  return `+${num}`
}

const handler = async (m: any, { Morela, command, args, fkontak, isOwn }: any) => {
  const pushname = m.pushName || 'Kak'

  const send = text =>
    Morela.sendMessage(m.chat, { text }, { quoted: fkontak || m })

  let owners = []
  try {
    owners = await readOwners()
  } catch (e) {
    return send(`❌ Error membaca data owner: ${(e as Error).message}`)
  }

  if (command === 'owner') {
    if (owners.length === 0) return send(
      `╭╌╌⬡「 👑 *ᴏᴡɴᴇʀ* 」\n` +
      `┃ ❌ Belum ada owner terdaftar!\n` +
      `╰╌╌⬡\n\n© ${botName}`
    )

    const { getMainOwner } = await import('../../System/mainowner.js')
    const mainOwnerNum = getMainOwner()

    const seen = new Set<string>()
    const allNums: string[] = []

    if (mainOwnerNum) {
      allNums.push(mainOwnerNum)
      seen.add(mainOwnerNum)
    }
    for (const n of owners) {
      const clean = n.replace(/[^0-9]/g, '')
      if (clean && !seen.has(clean)) {
        allNums.push(clean)
        seen.add(clean)
      }
    }

    const ownerType = getOwnerType()

    if (ownerType !== 2 && ownerType !== 3) {
      const { generateWAMessageFromContent } = await import('@itsliaaa/baileys')

      const now = new Date()
      const end = new Date(now.getTime() + 10 * 60000)

      const tagLines = allNums
        .map(num => `      ◦ @${num}`)
        .join('\n')

      const mentionedJid = allNums.map(num => `${num}@s.whatsapp.net`)

      const buttons = allNums.map((num, i) => {
        const isMain  = num === mainOwnerNum
        const country = getCountryInfo(num)
        const phone   = formatPhone(num)
        const name    = isMain ? ownerName : `Owner ${i + 1}`
        const status  = isMain ? `_Real Owner_` : `_Owner_`

        if (isMain) {

          return {
            name: 'booking_confirmation',
            buttonParamsJson: JSON.stringify({
              start_datetime:        now.toISOString(),
              end_datetime:          end.toISOString(),
              location:              country.flagPair,
              booking_url:           `https://wa.me/${num}`,
              phone_number:          num,
              booking_management_url: `https://wa.me/${num}`,
              description:
                `*◦ 👤 Name  :*  ${name}\n` +
                `*◦ 📞 Number  :*  ${phone}\n` +
                `*◦ 💭 Bio  :*  \n` +
                `*◦ 👑 Status  :*  ${status}\n` +
                `*◦ ${country.flag} Country  :*  ${country.name}\n`,
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
          }
        } else {

          return {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: `🔮 Owner ${i + 1}`,
              url:          `https://wa.me/${num}`,
              merchant_url: `https://wa.me/${num}`
            })
          }
        }
      })

      const msg = generateWAMessageFromContent(
        m.chat,
        {
          interactiveMessage: {
            header: {
              title: '𝗢 𝗪 𝗡 𝗘 𝗥   ◦   𝗜 𝗡 𝗙 𝗢',
              hasMediaAttachment: false
            },
            body: {
              text:
                `*乂  𝗢 𝗪 𝗡 𝗘 𝗥     ◦     𝗜 𝗡 𝗙 𝗢*\n` +
                `✧ Tag : \n` +
                tagLines + `\n` +
                (() => {
                  const r = readRules()
                  return r.length
                    ? `\n✧ Rules : \n` + r.map(x => `      ◦ _${x}_`).join('\n')
                    : ''
                })()
            },
            footer: {
              text: `© ${botName}`
            },
            nativeFlowMessage: {
              messageParamsJson: '{}',
              buttons
            },
            contextInfo: {
              mentionedJid
            }
          }
        },
        { userJid: mainOwnerNum ? `${mainOwnerNum}@s.whatsapp.net` : Morela.user.id, quoted: fkontak || m }
      )

      await Morela.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
      return
    }

    if (ownerType === 2) {
      const imgBuf = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null

      const ownerLines = allNums.map((num, i) => {
        const isMain = num === mainOwnerNum
        return `┃ ◦ ${isMain ? '👑 Main Owner' : `👤 Owner ${i + 1}`} : +${num}`
      }).join('\n')

      const buttons = allNums.map((num, i) => {
        const isMain = num === mainOwnerNum
        const label  = isMain ? `👑 Main Owner` : `👤 Owner ${i + 1}`
        return {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: `💬 Chat ${label}`,
            url: `https://wa.me/${num}`,
            merchant_url: `https://wa.me/${num}`
          })
        }
      })

      const msg: Record<string, unknown> = {
        caption:
          `╭╌╌⬡「 👑 *ᴏᴡɴᴇʀ* 」\n` +
          ownerLines + `\n` +
          `╰╌╌⬡`,
        footer: `© ${botName}`,
        interactiveButtons: buttons,
        hasMediaAttachment: true,
      }

      if (imgBuf) {
        msg.image = imgBuf
      } else {
        msg.image = { url: 'https://files.catbox.moe/928865.jpg' }
      }

      await Morela.sendMessage(m.chat, msg, { quoted: fkontak || m })
      return
    }

    if (ownerType === 3) {
      await Morela.sendMessage(
        m.chat,
        {
          text:
            `╭╌╌⬡「 👑 *ᴏᴡɴᴇʀ* 」\n` +
            `┃ Total: *${allNums.length} owner*\n` +
            `╰╌╌⬡\n\n© ${botName}`
        },
        { quoted: fkontak || m }
      )
      for (let i = 0; i < allNums.length; i++) {
        const num    = allNums[i]
        const isMain = num === mainOwnerNum
        const label  = isMain ? `👑 Main Owner` : `👤 Owner ${i + 1}`
        const vcard  =
          `BEGIN:VCARD\nVERSION:3.0\n` +
          `N:${label}\nFN:${label}\n` +
          `ORG:${botName};\n` +
          `TEL;type=CELL;type=VOICE;waid=${num}:${num}\n` +
          `END:VCARD`
        await Morela.sendMessage(
          m.chat,
          { contacts: { displayName: label, contacts: [{ vcard }] } },
          { quoted: fkontak || m }
        )
      }
      return
    }
  }

  if (command === 'addowner') {
    if (!isMainOwner(m)) return send(`❌ Fitur ini hanya untuk Main Owner!`)
    let number = args[0]

    if (!number) {
      if (m.mentionedJid?.[0]) {
        number = normNum(m.mentionedJid[0])
      } else if (m.quoted) {
        const _rawQuotedA = m.quoted.sender || m.quoted.key?.participant || ""
        number = resolveLidToPhone(_rawQuotedA) || normNum(_rawQuotedA)
      } else {
        return send(
          `╭╌╌⬡「 👑 *ᴀᴅᴅ ᴏᴡɴᴇʀ* 」\n` +
          `┃ ❌ *Format Salah!*\n` +
          `┃\n` +
          `┃ _Cara pakai:_\n` +
          `┃ ◦ \`.addowner 628xxx\`\n` +
          `┃ ◦ \`.addowner @mention\`\n` +
          `┃ ◦ Reply + \`.addowner\`\n` +
          `╰╌╌⬡\n\n© ${botName}`
        )
      }
    }

    number = number.split(':')[0].replace(/[^0-9]/g, '')
    if (number.length < 10) return send(
      `╭╌╌⬡「 👑 *ᴀᴅᴅ ᴏᴡɴᴇʀ* 」\n` +
      `┃ ❌ Nomor tidak valid!\n` +
      `┃ _Contoh: 628999889149_\n` +
      `╰╌╌⬡\n\n© ${botName}`
    )

    if (owners.includes(number)) return send(
      `╭╌╌⬡「 👑 *ᴀᴅᴅ ᴏᴡɴᴇʀ* 】\n` +
      `┃ ⚠️ *Sudah Terdaftar!*\n` +
      `┃ ◦ Nomor *+${number}* sudah owner\n` +
      `╰╌╌⬡\n\n© ${botName}`
    )

    const _isActiveSession = global.jadibotSessions?.has(number)
    if (isJadibot(number) || _isActiveSession) return send(
      `╭╌╌⬡「 👑 *ᴀᴅᴅ ᴏᴡɴᴇʀ* 」\n` +
      `┃ 🚫 *Ditolak! Risiko Keamanan!*\n` +
      `┃\n` +
      `┃ ◦ Nomor *+${number}* sedang aktif\n` +
      `┃   sebagai *jadibot*!\n` +
      `┃\n` +
      `┃ Hentikan dulu dengan:\n` +
      `┃ ◦ *.stopbot ${number}*\n` +
      `┃\n` +
      `┃ _Lalu ulangi .addowner._\n` +
      `╰╌╌⬡\n\n© ${botName}`
    )

    owners.push(number)
    try {
      await saveOwners(owners)
      invalidateOwnerCache()
      return send(
        `╭╌╌⬡「 👑 *ᴀᴅᴅ ᴏᴡɴᴇʀ* 」\n` +
        `┃ ✅ *Owner Ditambahkan!*\n` +
        `┃\n` +
        `┃ ◦ 📱 Nomor  : *+${number}*\n` +
        `┃ ◦ 👑 Status : *Owner Aktif*\n` +
        `┃ ◦ 📊 Total  : *${owners.length} owner*\n` +
        `┃\n` +
        `┃ _Owner baru sudah aktif sekarang!_\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
    } catch (e) {
      return send(
        `╭╌╌⬡「 👑 *ᴀᴅᴅ ᴏᴡɴᴇʀ* 」\n` +
        `┃ ❌ Gagal menyimpan\n` +
        `┃ ${(e as Error).message}\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
    }
  }

  if (command === 'delowner') {
    if (!isMainOwner(m)) return send(`❌ Fitur ini hanya untuk Main Owner!`)
    let number = args[0]

    if (!number) {
      if (m.mentionedJid?.[0]) {
        number = normNum(m.mentionedJid[0])
      } else if (m.quoted) {
        const _rawQuotedD = m.quoted.sender || m.quoted.key?.participant || ""
        number = resolveLidToPhone(_rawQuotedD) || normNum(_rawQuotedD)
      } else {
        return send(
          `╭╌╌⬡「 👑 *ᴅᴇʟ ᴏᴡɴᴇʀ* 」\n` +
          `┃ ❌ *Format Salah!*\n` +
          `┃\n` +
          `┃ _Cara pakai:_\n` +
          `┃ ◦ \`.delowner 628xxx\`\n` +
          `┃ ◦ \`.delowner @mention\`\n` +
          `┃ ◦ Reply + \`.delowner\`\n` +
          `╰╌╌⬡\n\n© ${botName}`
        )
      }
    }

    number = number.split(':')[0].replace(/[^0-9]/g, '')
    const index = owners.indexOf(number)

    if (index === -1) return send(
      `╭╌╌⬡「 👑 *ᴅᴇʟ ᴏᴡɴᴇʀ* 」\n` +
      `┃ ⚠️ *Tidak Ditemukan!*\n` +
      `┃ ◦ Nomor *+${number}* bukan owner\n` +
      `╰╌╌⬡\n\n© ${botName}`
    )

    if (owners.length === 1) return send(
      `╭╌╌⬡「 👑 *ᴅᴇʟ ᴏᴡɴᴇʀ* 」\n` +
      `┃ 🚫 *Tidak Bisa Dihapus!*\n` +
      `┃\n` +
      `┃ _Ini satu-satunya owner!_\n` +
      `┃ _Tambahkan owner lain dulu._\n` +
      `╰╌╌⬡\n\n© ${botName}`
    )

    owners.splice(index, 1)
    try {
      await saveOwners(owners)
      invalidateOwnerCache()

      let jadibotStopNote = ''
      if (global.jadibotSessions?.has(number) || isJadibot(number)) {
        try {
          removeJadibot(number)
          const session = global.jadibotSessions.get(number)
          await session?.stop?.()
          jadibotStopNote =
            `\n┃ ⚠️ Jadibot *+${number}* juga\n` +
            `┃   dihentikan otomatis.\n`
        } catch (_) {
          jadibotStopNote =
            `\n┃ ⚠️ Gagal stop jadibot *+${number}*.\n` +
            `┃   Hentikan manual: *.stopbot ${number}*\n`
        }
      }

      return send(
        `╭╌╌⬡「 👑 *ᴅᴇʟ ᴏᴡɴᴇʀ* 」\n` +
        `┃ 🗑️ *Owner Dihapus!*\n` +
        `┃\n` +
        `┃ ◦ 📱 Nomor  : *+${number}*\n` +
        `┃ ◦ 👑 Status : *Dicabut*\n` +
        `┃ ◦ 📊 Sisa   : *${owners.length} owner*\n` +
        jadibotStopNote +
        `┃\n` +
        `┃ _Akses owner telah dicabut!_\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
    } catch (e) {
      return send(
        `╭╌╌⬡「 👑 *ᴅᴇʟ ᴏᴡɴᴇʀ* 」\n` +
        `┃ ❌ Gagal menyimpan\n` +
        `┃ ${(e as Error).message}\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
    }
  }

  if (command === 'ownerrules') {
    if (!isMainOwner(m)) return send(`❌ Fitur ini hanya untuk Main Owner!`)

    const rules = readRules()
    const sub   = (args[0] || '').toLowerCase()

    if (!sub) {
      const rulesList = rules.length
        ? rules.map((r, i) => `┃ *${i + 1}.* ${r}`).join('\n')
        : `┃ _(kosong — belum ada rules)_`

      return send(
        `╭╌╌⬡「 📋 *ᴏᴡɴᴇʀ ʀᴜʟᴇs* 」\n` +
        `┃\n` +
        rulesList + `\n` +
        `┃\n` +
        `┃ _Cara pakai:_\n` +
        `┃ ◦ \`.ownerrules add <teks>\`\n` +
        `┃ ◦ \`.ownerrules del <nomor>\`\n` +
        `┃ ◦ \`.ownerrules set <nomor> <teks>\`\n` +
        `┃ ◦ \`.ownerrules reset\`\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
    }

    if (sub === 'add') {
      const newRule = args.slice(1).join(' ').trim()
      if (!newRule) return send(
        `╭╌╌⬡「 📋 *ᴀᴅᴅ ʀᴜʟᴇ* 」\n` +
        `┃ ❌ Teks rule tidak boleh kosong!\n` +
        `┃ _Contoh: .ownerrules add Dilarang promosi_\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
      if (rules.length >= 10) return send(
        `╭╌╌⬡「 📋 *ᴀᴅᴅ ʀᴜʟᴇ* 」\n` +
        `┃ ⚠️ Maksimal *10 rules*!\n` +
        `┃ Hapus dulu salah satu dengan *.ownerrules del <n>*\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
      rules.push(newRule)
      await saveRules(rules)
      return send(
        `╭╌╌⬡「 📋 *ᴀᴅᴅ ʀᴜʟᴇ* 」\n` +
        `┃ ✅ *Rule Ditambahkan!*\n` +
        `┃\n` +
        `┃ ◦ 📝 Rule  : _${newRule}_\n` +
        `┃ ◦ 📊 Total : *${rules.length} rules*\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
    }

    if (sub === 'del') {
      const idx = parseInt(args[1]) - 1
      if (isNaN(idx) || idx < 0 || idx >= rules.length) return send(
        `╭╌╌⬡「 📋 *ᴅᴇʟ ʀᴜʟᴇ* 」\n` +
        `┃ ❌ Nomor tidak valid!\n` +
        `┃ Nomor valid: *1 – ${rules.length}*\n` +
        `┃ _Contoh: .ownerrules del 2_\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
      const deleted = rules.splice(idx, 1)[0]
      await saveRules(rules)
      return send(
        `╭╌╌⬡「 📋 *ᴅᴇʟ ʀᴜʟᴇ* 」\n` +
        `┃ 🗑️ *Rule Dihapus!*\n` +
        `┃\n` +
        `┃ ◦ 📝 Dihapus : _${deleted}_\n` +
        `┃ ◦ 📊 Sisa    : *${rules.length} rules*\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
    }

    if (sub === 'set') {
      const idx     = parseInt(args[1]) - 1
      const newText = args.slice(2).join(' ').trim()
      if (isNaN(idx) || idx < 0 || idx >= rules.length) return send(
        `╭╌╌⬡「 📋 *ꜱᴇᴛ ʀᴜʟᴇ* 」\n` +
        `┃ ❌ Nomor tidak valid!\n` +
        `┃ Nomor valid: *1 – ${rules.length}*\n` +
        `┃ _Contoh: .ownerrules set 1 Dilarang promosi_\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
      if (!newText) return send(
        `╭╌╌⬡「 📋 *ꜱᴇᴛ ʀᴜʟᴇ* 」\n` +
        `┃ ❌ Teks baru tidak boleh kosong!\n` +
        `┃ _Contoh: .ownerrules set 1 Dilarang promosi_\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
      const oldText = rules[idx]
      rules[idx] = newText
      await saveRules(rules)
      return send(
        `╭╌╌⬡「 📋 *ꜱᴇᴛ ʀᴜʟᴇ* 」\n` +
        `┃ ✏️ *Rule Diperbarui!*\n` +
        `┃\n` +
        `┃ ◦ *Nomor* : ${idx + 1}\n` +
        `┃ ◦ *Lama*  : _${oldText}_\n` +
        `┃ ◦ *Baru*  : _${newText}_\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
    }

    if (sub === 'reset') {
      await saveRules([])
      return send(
        `╭╌╌⬡「 📋 *ʀᴇꜱᴇᴛ ʀᴜʟᴇꜱ* 」\n` +
        `┃ 🗑️ *Semua Rules Dihapus!*\n` +
        `┃\n` +
        `┃ _Rules sekarang kosong._\n` +
        `┃ _Tambah baru: .ownerrules add <teks>_\n` +
        `╰╌╌⬡\n\n© ${botName}`
      )
    }

    return send(
      `╭╌╌⬡「 📋 *ᴏᴡɴᴇʀ ʀᴜʟᴇs* 」\n` +
      `┃ ❓ Sub-command tidak dikenal: *${sub}*\n` +
      `┃\n` +
      `┃ _Tersedia:_\n` +
      `┃ ◦ \`.ownerrules\`             → lihat semua\n` +
      `┃ ◦ \`.ownerrules add <teks>\`  → tambah\n` +
      `┃ ◦ \`.ownerrules del <nomor>\` → hapus\n` +
      `┃ ◦ \`.ownerrules set <n> <t>\` → ganti\n` +
      `┃ ◦ \`.ownerrules reset\`       → reset default\n` +
      `╰╌╌⬡\n\n© ${botName}`
    )
  }
}

handler.command = ['owner', 'addowner', 'delowner', 'ownerrules']
handler.tags    = ['owner']
handler.help    = ['owner', 'addowner <nomor>', 'delowner <nomor>', 'ownerrules [add|del|set|reset]']
handler.noLimit = true

export default handler
