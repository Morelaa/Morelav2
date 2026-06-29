import { getGroup, updateGroup } from '../../Database/db.js'
import { botName } from '../../Library/utils.js'

const ALL_FEATURES: Record<string, string> = {
    antiswgc:    'Anti SW GC / Group Story',
    antilink:    'Anti Link',
    antivirtex:  'Anti Virtex',
    antibot:     'Anti Bot Lain',
    antifoto:    'Anti Foto/Gambar',
    antivideo:   'Anti Video',
    antiaudio:   'Anti Audio/Voice',
    antidokumen: 'Anti Dokumen/File',
    antisticker: 'Anti Sticker',
    antimention: 'Anti Tag Status',
    welcome:     'Welcome Member',
}

const handler = async (m: any, { args, reply, Morela, fkontak }: any) => {
    const from   = m.chat
    const action = (args[0] || '').toLowerCase()
    const grp    = getGroup(from) || {}

    const icon = (v: unknown) => v ? '✅' : '❌'

    if (!action) {
        const aktif  = Object.entries(ALL_FEATURES).filter(([k]) => grp[k])
        const mati   = Object.entries(ALL_FEATURES).filter(([k]) => !grp[k])

        let groupName = 'Grup'
        try {
            const meta = await Morela.groupMetadata(from)
            groupName  = meta.subject || 'Grup'
        } catch {}

        const swStatus = grp.antiswgc ? '✅ Aktif' : '❌ Nonaktif'

        const teks =
            `╭╌╌⬡「 📡 *ᴀɴᴛɪsᴡɢᴄ* 」\n` +
            `┃ 📍 *${groupName}*\n` +
            `┃\n` +
            `┃ Status AntiSWGC: *${swStatus}*\n` +
            `┃\n` +
            `┃ 📋 *Fitur yang mendeteksi SW GC:*\n` +
            `┃   • groupStatusMentionMessage\n` +
            `┃   • groupMentionedMessage\n` +
            `┃   • statusMentionMessage\n` +
            `┃   • contextInfo.groupMentions\n` +
            `┃\n` +
            `┃ ━━━━━━━━━━━━━━━━━\n` +
            `┃ 🟢 *Fitur Aktif di Grup Ini:*\n` +
            (aktif.length
                ? aktif.map(([, label]) => `┃   ✅ ${label}`).join('\n')
                : `┃   _Tidak ada fitur aktif_`) +
            `\n┃\n` +
            `┃ 🔴 *Fitur Nonaktif:*\n` +
            (mati.length
                ? mati.map(([, label]) => `┃   ❌ ${label}`).join('\n')
                : `┃   _Semua fitur aktif_`) +
            `\n┃\n` +
            `┃ _Gunakan:_\n` +
            `┃ \`.antiswgc on\`  — Aktifkan\n` +
            `┃ \`.antiswgc off\` — Nonaktifkan\n` +
            `╰╌╌⬡\n\n© ${botName}`

        return await Morela.sendMessage(from, { text: teks }, { quoted: fkontak || m })
    }

    if (action === 'on') {
        if (grp.antiswgc) {
            return reply(
                `╭╌╌⬡「 ⚠️ *ɪɴꜰᴏ* 」\n` +
                `┃ *Anti SW GC* sudah aktif!\n` +
                `╰╌╌⬡\n\n© ${botName}`
            )
        }
        updateGroup(from, { antiswgc: true })
        return reply(
            `╭╌╌⬡「 ✅ *ʙᴇʀʜᴀsɪʟ* 」\n` +
            `┃ *Anti SW GC* berhasil *diaktifkan!*\n` +
            `┃\n` +
            `┃ Pesan SW Group Story akan otomatis\n` +
            `┃ dihapus dan pengirim mendapat warn.\n` +
            `┃\n` +
            `┃ _Bot harus jadi admin agar bisa_\n` +
            `┃ _menghapus pesan._\n` +
            `╰╌╌⬡\n\n© ${botName}`
        )
    }

    if (action === 'off') {
        if (!grp.antiswgc) {
            return reply(
                `╭╌╌⬡「 ⚠️ *ɪɴꜰᴏ* 」\n` +
                `┃ *Anti SW GC* memang sudah nonaktif!\n` +
                `╰╌╌⬡\n\n© ${botName}`
            )
        }
        updateGroup(from, { antiswgc: false })
        return reply(
            `╭╌╌⬡「 ✅ *ʙᴇʀʜᴀsɪʟ* 」\n` +
            `┃ *Anti SW GC* berhasil *dinonaktifkan!*\n` +
            `╰╌╌⬡\n\n© ${botName}`
        )
    }

    return reply(
        `╭╌╌⬡「 ❌ *ᴇʀʀᴏʀ* 」\n` +
        `┃ Gunakan: \`.antiswgc on\` atau \`.antiswgc off\`\n` +
        `╰╌╌⬡\n\n© ${botName}`
    )
}

handler.command  = ['antiswgc', 'antiswgroup', 'antiswmentiongc', 'antiswtaggc']
handler.admin    = true
handler.group    = true
handler.noLimit  = true
handler.tags     = ['group']
handler.help     = ['antiswgc on/off']

export default handler
