import { getGroup, updateGroup } from '../../Database/db.js'
import { botName } from '../../Library/utils.js'

const handler = async (m: any, { args, reply, Morela, fkontak }: any) => {
    const from   = m.chat
    const sub    = (args[0] || '').toLowerCase()   // catalog | airich | (kosong = show all)
    const action = (args[1] || '').toLowerCase()   // on | off
    const grp    = getGroup(from) || {}

    if (!sub) {
        let groupName = 'Grup'
        try {
            const meta = await Morela.groupMetadata(from)
            groupName  = meta.subject || 'Grup'
        } catch {}
        const catStatus    = grp.anticatalog ? '✅ Aktif' : '❌ Nonaktif'
        const airichStatus = grp.antiairich  ? '✅ Aktif' : '❌ Nonaktif'
        const teks =
            `╭╌╌⬡「 🛡️ *ᴀɴᴛɪʙᴜɢ ᴄᴇɴᴛᴇʀ* 」\n` +
            `┃ 📍 *${groupName}*\n` +
            `┃\n` +
            `┃ ━━━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 🔴 *Anti Catalog Bug*\n` +
            `┃ Status  : ${catStatus}\n` +
            `┃\n` +
            `┃ 🟣 *Anti AIRich Bug*\n` +
            `┃ Status  : ${airichStatus}\n` +
            `┃\n` +
            `┃ ━━━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 📋 *Tentang Bug Ini:*\n` +
            `┃\n` +
            `┃ *Catalog Bug*\n` +
            `┃ Exploit via pesan interaktif\n` +
            `┃ catalog_message yang bisa crash\n` +
            `┃ atau glitch WA penerima.\n` +
            `┃\n` +
            `┃ *AIRich Bug*\n` +
            `┃ Exploit via pesan AIRich WA\n` +
            `┃ (botForwardedMessage) dengan\n` +
            `┃ ribuan sections/primitives\n` +
            `┃ agar HP penerima OOM/crash.\n` +
            `┃ Termasuk flood produk, gambar,\n` +
            `┃ video, reel, & post carousel.\n` +
            `┃\n` +
            `┃ ━━━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 🔧 *Cara Pakai:*\n` +
            `┃ ▸ \`.antibug catalog on/off\`\n` +
            `┃ ▸ \`.antibug airich on/off\`\n` +
            `┃ ▸ \`.on anticatalog\` / \`.off anticatalog\`\n` +
            `┃ ▸ \`.on antiairich\` / \`.off antiairich\`\n` +
            `┃\n` +
            `┃ ❗ Pelaku bug langsung *dikick*\n` +
            `┃    di percobaan pertama, tanpa warn.\n` +
            `┃ ❗ Bot wajib jadi *admin* grup\n` +
            `┃    agar bisa hapus pesan & kick.\n` +
            `╰╌╌⬡\n\n© ${botName}`

        return await Morela.sendMessage(from, { text: teks }, { quoted: fkontak || m })
    }

    const validSubs: Record<string, { flagKey: string; label: string }> = {
        catalog: { flagKey: 'anticatalog', label: 'Anti Catalog Bug' },
        airich:  { flagKey: 'antiairich',  label: 'Anti AIRich Bug'  },
    }
    const target = validSubs[sub]
    if (!target) {
        return reply(
            `╭╌╌⬡「 ❌ *ᴇʀʀᴏʀ* 」\n` +
            `┃ Sub-command tidak dikenal.\n` +
            `┃ Gunakan: *catalog* atau *airich*\n` +
            `┃ Contoh: \`.antibug catalog on\`\n` +
            `╰╌╌⬡\n\n© ${botName}`
        )
    }

    if (action === 'on') {
        if (grp[target.flagKey]) {
            return reply(
                `╭╌╌⬡「 ⚠️ *ɪɴꜰᴏ* 」\n` +
                `┃ *${target.label}* sudah aktif!\n` +
                `╰╌╌⬡\n\n© ${botName}`
            )
        }
        updateGroup(from, { [target.flagKey]: true })
        const adminNote = sub === 'airich'
            ? `┃ ❗ Bot harus jadi *admin dulu*\n` +
              `┃    sebelum fitur ini bisa kick\n` +
              `┃    pelaku bug AIRich.\n`
            : `┃ ❗ Bot harus jadi *admin.*\n`
        return reply(
            `╭╌╌⬡「 ✅ *ʙᴇʀʜᴀsɪʟ* 」\n` +
            `┃ *${target.label}* berhasil\n` +
            `┃ *diaktifkan!*\n` +
            `┃\n` +
            `┃ ⚡ Sistem akan otomatis:\n` +
            `┃   • Hapus pesan bug\n` +
            `┃   • Langsung *kick* pelaku\n` +
            `┃     (tanpa warn)\n` +
            `┃\n` +
            adminNote +
            `╰╌╌⬡\n\n© ${botName}`
        )
    }

    if (action === 'off') {
        if (!grp[target.flagKey]) {
            return reply(
                `╭╌╌⬡「 ⚠️ *ɪɴꜰᴏ* 」\n` +
                `┃ *${target.label}* memang sudah\n` +
                `┃ nonaktif!\n` +
                `╰╌╌⬡\n\n© ${botName}`
            )
        }
        updateGroup(from, { [target.flagKey]: false })
        return reply(
            `╭╌╌⬡「 ✅ *ʙᴇʀʜᴀsɪʟ* 」\n` +
            `┃ *${target.label}* berhasil\n` +
            `┃ *dinonaktifkan!*\n` +
            `╰╌╌⬡\n\n© ${botName}`
        )
    }

    return reply(
        `╭╌╌⬡「 ❌ *ᴇʀʀᴏʀ* 」\n` +
        `┃ Argumen tidak dikenal.\n` +
        `┃ Gunakan: *on* atau *off*\n` +
        `┃ Contoh: \`.antibug ${sub} on\`\n` +
        `╰╌╌⬡\n\n© ${botName}`
    )
}
handler.command = ['antibug', 'anticatalog', 'antiairich', 'antibugcatalog', 'antibugairich']
handler.admin   = true
handler.group   = true
handler.noLimit = true
handler.tags    = ['group', 'anti']
handler.help    = [
    'antibug',
    'antibug catalog on/off',
    'antibug airich on/off',
]
export default handler