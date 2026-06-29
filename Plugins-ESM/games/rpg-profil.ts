import {
    getUser,
    getUsers,
    updateUser,
    isRegistered
} from '../../Database/db.js'

import { botName }          from '../../Library/utils.js'
import { canvasRpgProfile } from '../../Library/canvas-rpg.js'

const ROLES = [
    { name: 'Coal',     minLevel: 0   },
    { name: 'Iron',     minLevel: 10  },
    { name: 'Gold',     minLevel: 25  },
    { name: 'Diamond',  minLevel: 50  },
    { name: 'Emerald',  minLevel: 75  },
    { name: 'Obsidian', minLevel: 100 },
]
const EXP_PER_LEVEL = 20000

function getDefaultRpg() {
    return {
        level:          1,
        exp:            0,
        max_health:     100,
        health:         100,
        balance:        1000,
        bank:           0,
        diamond:        0,
        gold:           0,
        limit_item:     0,
        armor:          'Leather Armor',
        sword:          'Wooden Sword',
        pickaxe:        'Wooden Pickaxe',
        apel:           20,
        potion:         10,
        dungeon_active: true,
        mining_active:  true,
    }
}

function getRole(level: unknown): string {
    let role = ROLES[0].name
    for (const r of ROLES) {
        if ((level as number) >= r.minLevel) role = r.name
    }
    return role
}

function getMaxExp(level: unknown): number {
    return (Number(level) + 1) * EXP_PER_LEVEL
}

function getRankings(userJid: string, field: string) {
    const all    = Object.values(getUsers()) as any[]
    const sorted = [...all].sort((a, b) => (b[field] || 0) - (a[field] || 0))

    const rank   = sorted.findIndex(u => (u.id === userJid) || (u.jid === userJid)) + 1
    return { rank: rank > 0 ? rank : all.length, total: all.length }
}

async function fetchProfilePicture(Morela: any, jid: string): Promise<Buffer | null> {
    try {
        const url = await Morela.profilePictureUrl(jid, 'image')
        const res = await fetch(url)
        if (!res.ok) return null
        return Buffer.from(await res.arrayBuffer())
    } catch {
        return null
    }
}

const handler = async (m: any, { Morela, reply, isOwn, senderJid, fkontak }: any) => {
    const from    = m.chat
    const userJid = senderJid || m.sender || m.key?.remoteJid

    if (!isOwn && !isRegistered(userJid)) {
        return reply(
            `╭╌╌⬡「 ❌ *ʙᴇʟᴜᴍ ᴛᴇʀᴅᴀꜰᴛᴀʀ* 」\n` +
            `┃\n` +
            `┃ ◦ Daftar dulu: *.daftar nama.umur*\n` +
            `┃\n` +
            `╰╌╌⬡\n\n꒰ © ${botName} ꒱`
        )
    }

    await Morela.sendMessage(from, { react: { text: '⚔️', key: m.key } })

    const data = isOwn
        ? {
            name:       m.pushName || 'Owner',
            number:     userJid.split('@')[0],
            id:         userJid,
            jid:        userJid,
            is_premium: 1,
            premium:    true,
            registered: true,
          }
        : getUser(userJid)

    if (!data) return reply(`❌ Data tidak ditemukan.`)

    if (!isOwn && data.level === undefined) {
        const defaults = getDefaultRpg()
        updateUser(userJid, defaults)
        Object.assign(data, defaults)
    }

    const rpg = isOwn
        ? {
            level:          999,
            exp:            999999,
            max_health:     999,
            health:         999,
            balance:        999999999,
            bank:           999999999,
            diamond:        999999,
            gold:           999999,
            limit_item:     999,
            armor:          '⚡ God Armor',
            sword:          '⚡ God Sword',
            pickaxe:        '⚡ God Pickaxe',
            apel:           999,
            potion:         999,
            dungeon_active: true,
            mining_active:  true,
          }
        : {
            level:          data.level          ?? 0,
            exp:            data.exp            ?? 0,
            max_health:     data.max_health     ?? 100,
            health:         data.health         ?? 100,
            balance:        data.balance        ?? 1000,
            bank:           data.bank           ?? 0,
            diamond:        data.diamond        ?? 0,
            gold:           data.gold           ?? 0,
            limit_item:     data.limit_item     ?? 0,
            armor:          data.armor          ?? 'Leather Armor',
            sword:          data.sword          ?? 'Wooden Sword',
            pickaxe:        data.pickaxe        ?? 'Wooden Pickaxe',
            apel:           data.apel           ?? 20,
            potion:         data.potion         ?? 10,
            dungeon_active: data.dungeon_active ?? true,
            mining_active:  data.mining_active  ?? true,
          }

    const role    = isOwn ? '⚡ OP' : getRole(rpg.level)
    const maxExp  = getMaxExp(rpg.level)
    const name    = data.name || m.pushName || 'User'
    const tag     = `@${data.number || userJid.split('@')[0]}`
    const isPrem  = !isOwn && (data.is_premium === 1 || data.premium === true)

    let rankChip: number, rankMoney: number, rankBank: number
    let rankLevel: number, rankDiamond: number, rankGold: number, totalUser: number

    if (isOwn) {
        totalUser                                       = Object.keys(getUsers()).length
        rankChip = rankMoney = rankBank                 = 1
        rankLevel = rankDiamond = rankGold              = 1
    } else {
        totalUser   = Object.keys(getUsers()).length
        rankChip    = getRankings(userJid, 'gold').rank
        rankMoney   = getRankings(userJid, 'balance').rank
        rankBank    = getRankings(userJid, 'bank').rank
        rankLevel   = getRankings(userJid, 'level').rank
        rankDiamond = getRankings(userJid, 'diamond').rank
        rankGold    = getRankings(userJid, 'gold').rank
    }

    const ppBuf = await fetchProfilePicture(Morela, userJid)

    try {
        const imgBuf = await canvasRpgProfile({
            name,
            tag,
            isOwn,
            isPremium:  isPrem,
            registered: !!(data.registered),
            rpg,
            role,
            maxExp,
            ranks: {
                chip:    rankChip,
                money:   rankMoney,
                bank:    rankBank,
                level:   rankLevel,
                diamond: rankDiamond,
                gold:    rankGold,
                total:   totalUser,
            },
            ppBuf,
            botName,
        })

        await Morela.sendMessage(from, {
            image:    imgBuf,
            caption:  `꒰ ⚔️ *RPG Profile* — ${name} ꒱\n© ${botName}`,
            mimetype: 'image/png',
        }, { quoted: fkontak || m })

        await Morela.sendMessage(from, { react: { text: '', key: m.key } })

    } catch (err) {
        console.error('[RPG-PROFIL CANVAS]', (err as Error).message)
        await Morela.sendMessage(from, { react: { text: '❌', key: m.key } })
        return reply(`❌ Gagal render canvas:\n${(err as Error).message}`)
    }
}

handler.command  = ['profil', 'profile', 'me']
handler.tags     = ['games', 'rpg']
handler.help     = ['profil', 'me']
handler.noLimit  = true
handler.owner    = false
handler.premium  = false
handler.group    = false
handler.private  = false
handler.admin    = false
handler.botAdmin = false

export default handler
