import { getGroup, updateGroup, getPushName } from '../../Database/db.js'
import {
    isLidJid,
    resolveLidToPhone,
    normNum,
    findParticipant,
    isParticipantAdmin,
    safeKickJid,
    safeDeleteParticipant,
    resolveBotAdmin,
} from '../../Library/resolve.js'

const SW_MTYPES = new Set([
    'groupStatusMessage',          
    'groupStatusMentionMessage',   
    'groupMentionedMessage',       
    'statusMentionMessage',        
    'statusJidMentionMessage',     
])

async function deleteMsg(sock: any, m: any) {
    try {

        const rawParticipant = m.key?.participant || m.sender || m.key?.remoteJid
        const participant = safeDeleteParticipant(rawParticipant)

        await sock.sendMessage(m.chat, {
            delete: {
                remoteJid:   m.chat,
                fromMe:      false,
                id:          m.key.id,
                participant
            }
        })
    } catch (e) {
        console.error('[ANTISWGC] Delete gagal:', (e as Error).message)
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
            return null
        }

        const found = findParticipant(participants, senderJid)
        return safeKickJid(found)
    } catch {
        return null
    }
}

async function addWarnAndAct(sock: any, m: any, senderJid: string, fkontak: any) {
    try {
        const groupData = getGroup(m.chat) || {}
        const warns     = groupData.warns || {}

        if (!warns[senderJid]) warns[senderJid] = { count: 0 }
        warns[senderJid].count++
        warns[senderJid].updatedAt = Date.now()

        updateGroup(m.chat, { warns })

        const count = warns[senderJid].count

        const isLid       = isLidJid(senderJid)
        const rawLidNum   = senderJid.split('@')[0]

        const resolvedPhone = isLid ? resolveLidToPhone(senderJid) : null
        const phoneNum      = resolvedPhone || normNum(senderJid)

        const mentionJid = resolvedPhone
            ? `${phoneNum}@s.whatsapp.net`
            : senderJid  

        const displayName =
            getPushName(senderJid)                                     ||  
            getPushName(rawLidNum)                                     ||  
            (resolvedPhone ? getPushName(`${phoneNum}@s.whatsapp.net`) : null) ||  
            (resolvedPhone ? getPushName(phoneNum) : null)             ||  
            m.pushName                                                 ||  
            (resolvedPhone ? `+${phoneNum}` : rawLidNum)                   

        try {
            await sock.sendMessage(m.chat, {
                text:
                    `*Peringatan ${count}/5*\n\n` +
                    `@${phoneNum} melanggar aturan:\n` +
                    `*Anti SW GC (Group Story Mention)*\n\n` +
                    `Nama: *${displayName}*\n` +
                    (count >= 5
                        ? 'Peringatan penuh! Akan segera dikeluarkan.'
                        : 'Jika mencapai 5 peringatan, akan dikeluarkan.'),
                mentions: [mentionJid]
            }, { quoted: fkontak || m })
        } catch {}

        if (count >= 5) {
            warns[senderJid].count = 0
            updateGroup(m.chat, { warns })

            const kickJid = await findKickableJid(sock, m.chat, senderJid)
            if (kickJid) {
                try {
                    await sock.groupParticipantsUpdate(m.chat, [kickJid], 'remove')
                    console.log(`[ANTISWGC] ✅ Kicked ${displayName} (${phoneNum})`)
                } catch (e) {
                    console.error('[ANTISWGC] Kick gagal:', (e as Error).message)
                }
            }
        }
    } catch (e) {
        console.error('[ANTISWGC] addWarn error:', (e as Error).message)
    }
}

function hasGroupMentions(m: any): boolean {

    const msg = m.message || {}
    const keys = Object.keys(msg)

    for (const key of keys) {
        const inner = msg[key]
        if (!inner || typeof inner !== 'object') continue
        const ctx = inner.contextInfo || {}
        if (Array.isArray(ctx.groupMentions) && ctx.groupMentions.length > 0) return true
    }

    const mCtx = (m.msg as any)?.contextInfo || {}
    if (Array.isArray(mCtx.groupMentions) && mCtx.groupMentions.length > 0) return true

    return false
}

function isGroupStoryMsg(m: any): boolean {

    if (m.message?.groupStatusMessage != null) return true

    const mtype = (m.mtype as string) || ''
    if (SW_MTYPES.has(mtype)) return true

    if (hasGroupMentions(m)) return true

    const rawMsg = m.message || {}
    for (const key of Object.keys(rawMsg)) {
        const val = (rawMsg as any)[key]
        if (!val || typeof val !== 'object') continue

        if (val?.message?.groupStatusMessage != null) return true

        if (val?.contextInfo?.groupMentions?.length > 0) return true
    }

    return false
}

export default {
    tags: ['group', 'anti', 'passive'],

    handler: async (m: any, { Morela, isOwn, isAdmin, botAdmin, fkontak }: any) => {

        if (!m.isGroup)  return
        if (!m.message)  return
        if (isOwn)       return

        const from = m.chat
        const grp  = getGroup(from)

        const _mkeys   = Object.keys(m.message || {}).join(',')
        const _mtype   = (m.mtype as string) || '(none)'
        const _isSwGcRaw = !!(m.message?.groupStatusMessage != null
            || _mkeys.includes('groupStatus')
            || _mkeys.includes('StatusMention'))
        const _grpSwgc = !!grp?.antiswgc
        if (_isSwGcRaw || _mtype.toLowerCase().includes('status') || _mtype.toLowerCase().includes('group')) {
            console.log(`[ANTISWGC DEBUG] mtype=${_mtype} | keys=${_mkeys} | antiswgc=${_grpSwgc} | isAdmin=${isAdmin} | botAdmin=${botAdmin} | chat=${String(from).split('@')[0]}`)
        }

        if (!grp?.antiswgc) return   

        const senderJid: string = (
            (m.sender as string)              ||
            (m.key?.participant as string)    ||
            (m.key?.remoteJid  as string)     ||
            ''
        )
        if (!senderJid) return

        const isRealGroupStatus = !!(m.message?.groupStatusMessage != null) || hasGroupMentions(m)
        if (isAdmin && !isRealGroupStatus) return

        const mtype = (m.mtype as string) || ''

        if (!isGroupStoryMsg(m)) return

        console.log(
            `[ANTISWGC] Detected SW GC | mtype=${mtype} | keys=${Object.keys(m.message||{}).join(',')} | from=${senderJid.split('@')[0]}`
        )

        if (!botAdmin) {
            const recheckAdmin = await resolveBotAdmin(Morela, from)
            if (!recheckAdmin) {
                console.warn('[ANTISWGC] Bot bukan admin (setelah re-check live), skip delete')
                return
            }
            console.log('[ANTISWGC] botAdmin false tapi re-check live: bot ADALAH admin, lanjut')
        }

        await deleteMsg(Morela, m)
        await addWarnAndAct(Morela, m, senderJid, fkontak)
    }
}
