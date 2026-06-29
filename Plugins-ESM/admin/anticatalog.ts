import { getGroup, getPushName } from '../../Database/db.js'
import { getMainOwner } from '../../System/mainowner.js'
import {
    normNum,
    isLidJid,
    resolveLidToPhone,
    findParticipant,
    isParticipantAdmin,
    safeKickJid,
    safeDeleteParticipant,
} from '../../Library/resolve.js'
const CFG = {
    CATALOG_BTN_NAME:   'catalog_message',
    AIRICH_SUBMSG_MAX:  15,
    AIRICH_SECTION_MAX: 20,
    AIRICH_PRIM_MAX:    30,
}
function getMsgType(msg: Record<string, unknown> = {}): string | undefined {
    return Object.keys(msg).find(
        k => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(k)
    )
}
function containsCatalogStr(obj: unknown, seen = new WeakSet()): boolean {
    if (!obj) return false
    if (typeof obj === 'string') return obj.includes('catalog_message')
    if (typeof obj !== 'object') return false
    if (seen.has(obj as object)) return false
    seen.add(obj as object)
    if (Array.isArray(obj)) return obj.some(v => containsCatalogStr(v, seen))
    return Object.values(obj as Record<string, unknown>).some(v => containsCatalogStr(v, seen))
}
function isCatalogBug(rawMsg: Record<string, unknown>): boolean {
    let msg = rawMsg
    while (true) {
        const type = getMsgType(msg)
        if (
            type === 'viewOnceMessage' ||
            type === 'viewOnceMessageV2' ||
            type === 'viewOnceMessageV2Extension'
        ) {
            const inner = (msg[type] as any)?.message
            if (!inner) return false
            msg = inner
            continue
        }
        break
    }
    const type = getMsgType(msg)
    if (type !== 'interactiveMessage') return false
    const interactive = (msg as any).interactiveMessage
    if (!interactive) return false
    const buttons: any[] = interactive?.nativeFlowMessage?.buttons ?? []
    if (buttons.some((btn: any) => btn?.name === CFG.CATALOG_BTN_NAME)) return true
    return containsCatalogStr(interactive)
}
function countSectionPrimitives(sections: any[]): number {
    let total = 0
    for (const sec of sections) {
        const vm = sec?.view_model
        if (!vm) continue
        if (Array.isArray(vm.primitives)) total += vm.primitives.length
        else if (vm.primitive) total += 1
    }
    return total
}
const DANGEROUS_TYPENAMES = new Set([
    'GenAIProductItemCardPrimitive',
    'GenAIImaginePrimitive',
    'GenAIReelPrimitive',
    'GenAIPostPrimitive',
])
function countDangerousPrimitives(sections: any[]): number {
    let count = 0
    for (const sec of sections) {
        const vm = sec?.view_model
        if (!vm) continue
        const items: any[] = Array.isArray(vm.primitives)
            ? vm.primitives
            : vm.primitive ? [vm.primitive] : []
        for (const item of items) {
            if (DANGEROUS_TYPENAMES.has(item?.__typename)) count++
        }
    }
    return count
}
interface AIRichBugResult {
    detected: boolean
    reason?: string
    submsgCount?: number
    sectionCount?: number
    primCount?: number
    dangerCount?: number
}
function isAIRichBug(rawMsg: Record<string, unknown>): AIRichBugResult {
    const botFwd = (rawMsg as any)?.botForwardedMessage
    if (!botFwd) return { detected: false }
    const richResp = botFwd?.message?.richResponseMessage
    if (!richResp) return { detected: false }
    const submessages: any[] = richResp?.submessages ?? []
    const submsgCount = submessages.length
    let sections: any[] = []
    try {
        const raw = richResp?.unifiedResponse?.data
        if (raw) {
            const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
            sections = decoded?.sections ?? []
        }
    } catch {}
    const sectionCount = sections.length
    const primCount    = countSectionPrimitives(sections)
    const dangerCount  = countDangerousPrimitives(sections)
    if (submsgCount > CFG.AIRICH_SUBMSG_MAX)
        return { detected: true, reason: `submessages flood (${submsgCount})`, submsgCount, sectionCount, primCount, dangerCount }
    if (sectionCount > CFG.AIRICH_SECTION_MAX)
        return { detected: true, reason: `sections flood (${sectionCount})`, submsgCount, sectionCount, primCount, dangerCount }
    if (primCount > CFG.AIRICH_PRIM_MAX)
        return { detected: true, reason: `primitives flood (${primCount})`, submsgCount, sectionCount, primCount, dangerCount }
    if (dangerCount > CFG.AIRICH_PRIM_MAX)
        return { detected: true, reason: `dangerous primitives flood (${dangerCount})`, submsgCount, sectionCount, primCount, dangerCount }
    return { detected: false, submsgCount, sectionCount, primCount, dangerCount }
}
function resolveSenderInfo(senderJid: string, pushName?: string): {
    phoneNum: string
    mentionJid: string
    displayName: string
} {
    const isLid          = isLidJid(senderJid)
    const rawLidNum       = senderJid.split('@')[0]
    const resolvedPhone   = isLid ? resolveLidToPhone(senderJid) : null
    const phoneNum        = resolvedPhone || normNum(senderJid)
    const mentionJid = resolvedPhone
        ? `${phoneNum}@s.whatsapp.net`
        : senderJid
    const displayName =
        getPushName(senderJid)                                              ||
        getPushName(rawLidNum)                                              ||
        (resolvedPhone ? getPushName(`${phoneNum}@s.whatsapp.net`) : null) ||
        (resolvedPhone ? getPushName(phoneNum) : null)                     ||
        pushName                                                           ||
        `+${phoneNum}`
    return { phoneNum, mentionJid, displayName }
}
async function deleteMsgGroup(sock: any, m: any, tag: string): Promise<void> {
    try {
        const rawPart: string =
            m.key?.participant || m.sender || m.key?.remoteJid || ''

        const participant = safeDeleteParticipant(rawPart)
        await sock.sendMessage(m.chat, {
            delete: {
                remoteJid:   m.chat,
                fromMe:      false,
                id:          m.key.id,
                participant
            }
        })
        console.log(`[${tag}] ✅ Pesan grup dihapus`)
    } catch (e) {
        console.error(`[${tag}] Delete grup gagal:`, (e as Error).message)
    }
}
async function deleteMsgDM(sock: any, m: any, tag: string): Promise<void> {
    try {
        await sock.sendMessage(m.chat, {
            delete: {
                remoteJid: m.chat,
                fromMe:    false,
                id:        m.key.id,
            }
        })
        console.log(`[${tag}] ✅ Pesan DM dihapus`)
    } catch (e) {
        console.error(`[${tag}] Delete DM gagal:`, (e as Error).message)
    }
}
async function notifyOwnerDM(
    sock: any,
    senderJid: string,
    bugLabel: string,
    pushName?: string
): Promise<void> {
    try {
        const ownerNum = getMainOwner()
        if (!ownerNum) return
        const ownerJid = `${ownerNum}@s.whatsapp.net`
        const { phoneNum, displayName } = resolveSenderInfo(senderJid, pushName)
        const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
        await sock.sendMessage(ownerJid, {
            text:
                `╭╌╌⬡「 🚨 *ʟᴀᴘᴏʀᴀɴ ʙᴜɢ ᴅᴍ* 」\n` +
                `┃\n` +
                `┃ Ada yang nyoba kirim bug ke bot!\n` +
                `┃\n` +
                `┃ 👤 Nama   : *${displayName}*\n` +
                `┃ 📱 Nomor  : *+${phoneNum}*\n` +
                `┃ 📋 Jenis  : *${bugLabel}*\n` +
                `┃ 🕐 Waktu  : *${waktu}*\n` +
                `┃\n` +
                `┃ _Pesan sudah dihapus otomatis._\n` +
                `╰╌╌⬡`
        })
    } catch (e) {
        console.error('[ANTIBUG] Notif owner DM gagal:', (e as Error).message)
    }
}
async function findKickableJid(
    sock: any,
    groupJid: string,
    senderJid: string
): Promise<string | null> {
    try {
        const cache = (globalThis as any).__groupMetadataCache__ as Map<string, unknown> | undefined
        if (cache) cache.delete(groupJid)
        const meta = await sock.groupMetadata(groupJid)
        if (!meta?.participants?.length) return null
        const participants = meta.participants
        const botEntry = findParticipant(participants, String(sock.user?.id ?? ''))
        if (!isParticipantAdmin(botEntry)) {
            console.warn('[ANTIBUG] Bot bukan admin, tidak bisa kick')
            return null
        }
        const target = findParticipant(participants, senderJid)
        return safeKickJid(target)
    } catch (e) {
        console.error('[ANTIBUG] findKickableJid error:', (e as Error).message)
        return null
    }
}
async function kickImmediately(
    sock: any,
    m: any,
    senderJid: string,
    fkontak: any,
    bugLabel: string,
): Promise<void> {
    try {
        const { phoneNum, mentionJid, displayName } = resolveSenderInfo(senderJid, m.pushName)
        const kickJid = await findKickableJid(sock, m.chat, senderJid)
        const kickText =
            `╭╌╌⬡「 🚨 *ᴀɴᴛɪʙᴜɢ* 」\n` +
            `┃\n` +
            `┃ ❌ *Bug terdeteksi & dikick!*\n` +
            `┃\n` +
            `┃ 👤 Nama  : *${displayName}*\n` +
            `┃ 📋 Kasus : *${bugLabel}*\n` +
            `┃\n` +
            `┃ _Pesan telah dihapus otomatis._\n` +
            `╰╌╌⬡`
        try {
            await sock.sendMessage(
                m.chat,
                { text: kickText, mentions: [mentionJid] },
                { quoted: fkontak || m }
            )
        } catch {}
        if (kickJid) {
            try {
                await sock.groupParticipantsUpdate(m.chat, [kickJid], 'remove')
                console.log(`[ANTIBUG] ✅ Kicked ${displayName} (${phoneNum})`)
            } catch (e) {
                console.error('[ANTIBUG] Kick gagal:', (e as Error).message)
            }
        }
    } catch (e) {
        console.error('[ANTIBUG] kickImmediately error:', (e as Error).message)
    }
}
async function notifyNoBotAdmin(
    sock: any,
    m: any,
    senderJid: string,
    fkontak: any,
    bugLabel: string
): Promise<void> {
    // Bot belum admin → tidak bisa kick, jadi jangan nyalahin/tag pengirim
    // di grup (bisa keliru/terkesan menuduh kalau ternyata false detect).
    // Cukup log di console buat owner cek manual.
    console.warn(
        `[ANTIBUG] Bot bukan admin — ${bugLabel} dari ${senderJid.split('@')[0]} ` +
        `terdeteksi tapi tidak bisa ditindak (pesan tetap dihapus jika izin cukup).`
    )
}
async function handleGroupBug(
    sock: any,
    m: any,
    senderJid: string,
    fkontak: any,
    botAdmin: boolean,
    bugLabel: string,
    tag: string
): Promise<void> {
    console.log(`[${tag}] 🚨 Grup — terdeteksi dari ${senderJid.split('@')[0]}`)
    if (!botAdmin) {
        await notifyNoBotAdmin(sock, m, senderJid, fkontak, bugLabel)
        return
    }
    await deleteMsgGroup(sock, m, tag)
    await kickImmediately(sock, m, senderJid, fkontak, bugLabel)
}
async function handleDMBug(
    sock: any,
    m: any,
    senderJid: string,
    bugLabel: string,
    tag: string
): Promise<void> {
    console.log(`[${tag}] 🚨 DM — terdeteksi dari ${senderJid.split('@')[0]}`)
    await deleteMsgDM(sock, m, tag)
    await notifyOwnerDM(sock, senderJid, bugLabel, m.pushName)
}
export default {
    tags: ['anti', 'passive'],
    handler: async (m: any, { Morela, isOwn, isAdmin, botAdmin, fkontak }: any) => {
        if (!m.message) return
        if (isOwn)      return   
        const rawMsg    = m.message as Record<string, unknown>
        const isGroup   = !!m.isGroup
        const senderJid: string =
            (m.sender as string)           ||
            (m.key?.participant as string) ||
            (m.key?.remoteJid  as string)  || ''
        if (!senderJid) return
        if (isGroup && isAdmin) return
        if (isGroup) {
            const grp = getGroup(m.chat)
            if (grp?.anticatalog && isCatalogBug(rawMsg)) {
                await handleGroupBug(
                    Morela, m, senderJid, fkontak, botAdmin,
                    'Bug Catalog', 'ANTICATALOG'
                )
                return
            }
        } else {
            if (isCatalogBug(rawMsg)) {
                await handleDMBug(Morela, m, senderJid, 'Bug Catalog', 'ANTICATALOG-DM')
                return
            }
        }
        if (isGroup) {
            const grp = getGroup(m.chat)
            if (grp?.antiairich) {
                const result = isAIRichBug(rawMsg)
                if (result.detected) {
                    console.log(
                        `[ANTIAIRICH] reason=${result.reason} | ` +
                        `submsg=${result.submsgCount} | sections=${result.sectionCount} | ` +
                        `prim=${result.primCount}`
                    )
                    await handleGroupBug(
                        Morela, m, senderJid, fkontak, botAdmin,
                        'Bug AIRich Flood', 'ANTIAIRICH'
                    )
                    return
                }
            }
        } else {
            const result = isAIRichBug(rawMsg)
            if (result.detected) {
                console.log(
                    `[ANTIAIRICH-DM] reason=${result.reason} | ` +
                    `submsg=${result.submsgCount} | sections=${result.sectionCount}`
                )
                await handleDMBug(Morela, m, senderJid, 'Bug AIRich Flood', 'ANTIAIRICH-DM')
                return
            }
        }
    }
}