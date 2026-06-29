import { getGroup, updateGroup, getPushName } from '../../Database/db.js'
import { ButtonV2 } from '../../Library/MessageBuilder.js'
import { toPhoneJid, isLidJid, resolveLidToPhone, normNum, findParticipant } from '../../Library/resolve.js'

const botName = global.botname || 'Morela'

const DEFAULT_INTRO_RAW =
  `ֹ  ⑅᜔  ׄ ᥒᥲmᥲ  ᮫  ::\n` +
  `ֹ  ⑅᜔  ׄ ᥙmᥙr  ᮫   ::\n` +
  `ֹ  ⑅᜔  ׄ ᥲsk᥆𝗍  ᮫  ::\n` +
  `ֹ  ⑅᜔  ׄ ᥣᥱ᥎ᥱᥣ ᥲkᥙᥒ ᮫  ::\n` +
  `ֹ  ⑅᜔  ׄ іძ & ᥒіᥴkᥒᥲmᥱ ᮫  ::\n` +
  `ֹ  ⑅᜔  ׄ ᥲᥣᥲsᥲᥒ mᥲsᥙk sіᥒі ᮫  ::\n` +
  `ֹ  ⑅᜔  ׄ sіᥲ⍴ gᥙіᥣძ ᥕᥲrs & ⍴ᥙsһ gᥣ᥆rᥡ ? ᮫  ::\n` +
  `ֹ  ⑅᜔  ׄ sіᥲ⍴ mᥱᥒᥲᥲ𝗍і sᥱmᥙᥲ ⍴ᥱrᥲ𝗍ᥙrᥲᥒ ? ᮫  ::`

const DEFAULT_INTRO_COPY =
  `nama ::\numur ::\naskot ::\nlevel akun ::\nid & nickname ::\nalasan masuk sini ::\nsiap guild wars & push glory ? ::\nsiap menaati semua peraturan ? ::`

const DEFAULT_INTRO_BLOCK =
  `\n\nִ ࣪ ˖ ᨰꫀᥣᥴ᥆ꩇꫀ tׁׅᨵׁׅׅ ᰔ ִ *SWEETY LDS²* ᰔ\n` +
  `         . ݁₊ ⊹ . ⟡ . ⊹ ₊ ݁.\n` +
  `ᥫ᭡ *before joining, yuk kenalin diri kamu dulu-!! ⋆*\n\n` +
  DEFAULT_INTRO_RAW +
  `\n\n꒰ © ${botName} ꒱`

function getIntroBlock(groupData) {
  return groupData?.intro_text || DEFAULT_INTRO_BLOCK
}

function getIntroCopy(groupData) {
  return groupData?.intro_copy || DEFAULT_INTRO_COPY
}

function extractCopyText(fullText) {
  const lines    = fullText.split('\n')
  const copyLines = lines.filter(l => l.trimEnd().endsWith('::'))
  return copyLines.length ? copyLines.join('\n') : fullText
}

// Wrapper tipis di atas toPhoneJid: tetap tolak JID grup (@g.us), karena
// welcome.ts dipakai untuk JID member yang masuk, bukan JID grup.
function sanitizeJid(jid: string | null | undefined): string | null {
  if (!jid || typeof jid !== 'string') return null
  const t = jid.trim()
  if (!t || t.endsWith('@g.us')) return null
  return toPhoneJid(t)
}

export async function sendWelcome(
  Morela,
  groupJid,
  memberJid,
  groupName,
  memberCount,
  pushname,
  withIntro        = false,
  phoneNumberHint  = null
) {
  const safeJid = sanitizeJid(memberJid)
  if (!safeJid) {
    console.warn('[WELCOME] JID tidak valid, skip:', memberJid)
    return
  }

  const _rawLidNum = memberJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
  const _isLid     = isLidJid(memberJid)

  let _phone = _isLid ? resolveLidToPhone(memberJid) : null

  if (!_phone && phoneNumberHint) {
    _phone = String(phoneNumberHint).replace(/[^0-9]/g, '') || null
  }

  if (!_phone && _isLid) {
    try {
      const _meta = await Morela.groupMetadata(groupJid)
      const _part = findParticipant(_meta?.participants, memberJid)
      if (_part) {
        const _pn = (_part as any).phoneNumber
        if (_pn) _phone = String(_pn).replace(/[^0-9]/g, '') || null
      }
    } catch (e) {
      console.warn('[WELCOME] groupMetadata fallback gagal:', (e as Error).message)
    }
  }

  const userNum  = _phone ? _phone : (_isLid ? _rawLidNum : normNum(safeJid))
  const phoneJid = _phone ? `${_phone}@s.whatsapp.net` : safeJid

  const username =
    (typeof pushname === 'string' && pushname.trim() ? pushname.trim() : null) ||
    getPushName(memberJid)                                                      ||
    getPushName(_rawLidNum)                                                     ||
    (_phone ? getPushName(`${_phone}@s.whatsapp.net`) : null)                  ||
    (_phone ? getPushName(_phone) : null)                                       ||
    userNum

  const groupData = getGroup(groupJid)

  const bodyText =
    `Halo @${userNum} 👋\n\n` +
    `Selamat datang di grup *${groupName}* 🌸` +
    (username && username !== userNum ? `\nNama: *${username}*` : '')

  try {
    let ppUrl: string | null = null
    try {
      ppUrl = await Morela.profilePictureUrl(safeJid, 'image')
    } catch {}

    const ppThumb: string | null = ppUrl || 'https://cdn.ornzora.eu.cc/92fb27b5-5ffd-4f5f-905a-9b8d0573a1af-upload-1780208822400.jpg'

    const btn = new ButtonV2(Morela)
      .setTitle(groupName)
      .setSubtitle(`👥 Member ke-${memberCount}`)
      .setBody(bodyText)
      .setFooter(`© ${botName}`)
      .setContextInfo({ mentionedJid: [phoneJid] })

    if (ppThumb) btn.setThumbnail(ppThumb)

    btn.addButton('Menu', '.menu')
    btn.addButton('Daftar', '.daftar')

    const msg = await btn.build(groupJid, { userJid: Morela.user?.id })
    await Morela.relayMessage(groupJid, msg.message, { messageId: msg.key.id })

    if (withIntro) {
      await Morela.sendMessage(groupJid, {
        text:     `@${userNum}` + getIntroBlock(groupData),
        mentions: [phoneJid]
      })
    }

    console.log(`[WELCOME] ✅ ${username} (@${userNum}) | intro=${withIntro} | pp=${!!ppUrl} | thumb=${!!ppThumb}`)
  } catch (e) {
    console.error('[WELCOME] ButtonV2 error:', (e as Error).message)
    try {
      await Morela.sendMessage(groupJid, { text: bodyText, mentions: [phoneJid] })
    } catch {}
  }
}

export async function sendIntro(_Morela, _groupJid, _memberJid, _groupName, _memberCount) {}

const handler = async (m, { Morela, args, reply, command }) => {
  const from       = m.chat
  const mode       = (args[0] || '').toLowerCase()
  const hasMention = m.mentionedJid?.length > 0

  if (command === 'intro' || command === 'setintro') {
    const groupData    = getGroup(from) || {}
    const currentIntro = groupData.intro || false

    if (mode === 'save') {
      if (!m.quoted?.text && !m.quoted?.body)
        return reply(
          `❌ *Cara pakai .setintro save:*\n\n` +
          `1. Ketik teks intro sebagai pesan baru\n` +
          `2. Reply pesan itu dengan *.setintro save*`
        )
      const customText = (m.quoted.body || m.quoted.text || '').trim()
      if (!customText) return reply('❌ Teks intro kosong!')
      const customCopy = extractCopyText(customText)
      updateGroup(from, {
        intro_text: `\n\n${customText}\n\n꒰ © ${botName} ꒱`,
        intro_copy: customCopy
      })
      return reply(
        `✅ *Intro Berhasil Diperbarui!*\n\n_Preview:_\n\n${customText}\n\n` +
        `📋 *Copy text:*\n${customCopy}`
      )
    }

    if (mode === 'reset') {
      updateGroup(from, { intro_text: null, intro_copy: null })
      return reply(`✅ *Intro direset ke default!*\n\n_Preview:_\n\n${DEFAULT_INTRO_BLOCK}`)
    }

    if (!mode || mode === 'status' || mode === 'cek') {
      const customSet  = !!groupData.intro_text
      return reply(
        `🎌 *INTRO STATUS*\n\n` +
        `Fitur : ${currentIntro ? '🟢 AKTIF' : '🔴 NONAKTIF'}\n` +
        `Teks  : ${customSet ? '✏️ Custom' : '📄 Default'}\n\n` +
        `*Preview:*\n${getIntroBlock(groupData)}\n\n` +
        `📋 *Copy text:*\n${getIntroCopy(groupData)}\n\n` +
        `• *.intro on/off* — aktifkan/nonaktifkan\n` +
        `• *.setintro save* — simpan teks intro\n` +
        `• *.setintro reset* — reset ke default`
      )
    }

    if (mode === 'on') {
      if (currentIntro) return reply('⚠️ Intro sudah aktif!')
      updateGroup(from, { intro: true })
      return reply('✅ *Intro Diaktifkan!*')
    }
    if (mode === 'off') {
      if (!currentIntro) return reply('⚠️ Intro sudah nonaktif!')
      updateGroup(from, { intro: false })
      return reply('✅ *Intro Dinonaktifkan!*')
    }

    return reply(`❌ Perintah tidak dikenal.\n• .intro on/off\n• .setintro save/reset/cek`)
  }

  if (!hasMention) {
    const groupData = getGroup(from) || {}
    const current   = groupData.welcome || false
    const introOn   = groupData.intro   || false
    const customSet = !!groupData.intro_text

    if (!mode || mode === 'status' || mode === 'cek') {
      return reply(
        `👋 *WELCOME STATUS*\n\n` +
        `Welcome : ${current   ? '🟢 AKTIF' : '🔴 NONAKTIF'}\n` +
        `Intro   : ${introOn   ? '🟢 AKTIF' : '🔴 NONAKTIF'}\n` +
        `Teks    : ${customSet ? '✏️ Custom' : '📄 Default'}\n\n` +
        `• *.welcome on/off* — atur welcome\n` +
        `• *.intro on/off* — atur intro\n` +
        `• *.setintro save* — ganti teks intro\n` +
        `• *.welcome @tag* — test manual`
      )
    }
    if (mode === 'on') {
      if (current) return reply('⚠️ Welcome sudah aktif!')
      updateGroup(from, { welcome: true })
      return reply('✅ *Welcome Diaktifkan!* 🎉')
    }
    if (mode === 'off') {
      if (!current) return reply('⚠️ Welcome sudah nonaktif!')
      updateGroup(from, { welcome: false })
      return reply('✅ *Welcome Dinonaktifkan!*')
    }
    return reply('❌ Gunakan: .welcome on / off / status / @tag')
  }

  try {
    const groupMeta   = await Morela.groupMetadata(from)
    const groupName   = groupMeta.subject || 'Group'
    const memberCount = groupMeta.participants?.length || 0
    const targetJid   = m.mentionedJid[0]
    const safeTarget  = sanitizeJid(targetJid)
    if (!safeTarget) return reply('❌ JID target tidak valid!')

    const participant = findParticipant(groupMeta.participants, safeTarget)
    const pushname    = participant?.notify || participant?.name || null
    const groupData   = getGroup(from) || {}
    const withIntro   = groupData.intro || false

    await sendWelcome(Morela, from, safeTarget, groupName, memberCount, pushname, withIntro)
    reply(`✅ Welcome test terkirim!\nIntro: ${withIntro ? '🟢 aktif + tombol salin' : '🔴 nonaktif'}`)
  } catch (e) {
    console.error('[WELCOME CMD ERROR]', e.message)
    reply(`❌ Error: ${e.message}`)
  }
}

handler.help    = ['welcome on', 'welcome off', 'welcome @tag', 'intro on', 'intro off', 'setintro save', 'setintro reset']
handler.tags    = ['group']
handler.command = ['welcome', 'testwelcome', 'setwelcome', 'intro', 'setintro']
handler.group   = true
handler.admin   = true
handler.noLimit = true

export default handler
