import { getGroup, updateGroup, getPushName } from '../../Database/db.js'
import { ButtonV2 } from '../../Library/MessageBuilder.js'
import {
    isLidJid,
    resolveLidToPhone,
    normNum,
    findParticipant,
    isParticipantAdmin,
    safeKickJid,
    safeDeleteParticipant,
} from '../../Library/resolve.js'

const botName = (globalThis as any).botname || 'Morela'

const FEATURE_NAMES = {
    antibot:     'Anti Bot',
    antivideo:   'Anti Video',
    antifoto:    'Anti Foto',
    antiaudio:   'Anti Audio',
    antidokumen: 'Anti Dokumen',
    antisticker: 'Anti Sticker',
    antimention: 'Anti Tag Status',
}

function getText(m: Record<string, unknown>) {
    return (
        m.text ||
        m.msg?.caption ||
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        m.message?.imageMessage?.caption ||
        m.message?.videoMessage?.caption ||
        m.message?.documentMessage?.caption ||
        ''
    )
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function deleteMsg(sock: Record<string, unknown>, m: Record<string, unknown>) {
    const senderRaw = (m.key as any)?.participant || (m.key as any)?.remoteJid || ''
    const deleteParticipant = safeDeleteParticipant(senderRaw)
    const payload = {
        delete: {
            remoteJid:   m.chat,
            fromMe:      false,
            id:          (m.key as any)?.id,
            participant: deleteParticipant
        }
    }
    // Retry sekali kalau kena rate-overlimit
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            await (sock as any).sendMessage(m.chat, payload)
            return
        } catch (e: any) {
            if (e?.message?.includes('rate-overlimit') && attempt === 1) {
                await sleep(3000) // tunggu 3 detik lalu coba lagi
                continue
            }
            throw e
        }
    }
}

async function findKickableJid(
    sock: Record<string, unknown>,
    groupJid: string,
    senderJid: string
): Promise<string | null> {
    try {

        const cache = (globalThis as any).__groupMetadataCache__ as Map<string, unknown> | undefined
        if (cache) cache.delete(groupJid)

        const meta = await (sock as any).groupMetadata(groupJid)
        if (!meta?.participants?.length) return null

        const participants = meta.participants

        const botEntry = findParticipant(participants, String((sock as any).user?.id ?? ''))
        if (!isParticipantAdmin(botEntry)) {
            console.warn('[ANTI-KICK] Bot bukan admin di grup ini (live check) — skip kick')
            return null
        }

        const found = findParticipant(participants, senderJid)
        if (found) {
            console.log(`[ANTI-KICK] Found: ${found.id}`)
            return safeKickJid(found)
        }

        console.warn(`[ANTI-KICK] Participant tidak ditemukan di grup: ${senderJid}`)
        return null
    } catch (e) {
        console.error('[ANTI-KICK] findKickableJid error:', (e as Error).message)
        return null
    }
}

async function addWarn(
    sock: Record<string, unknown>,
    m: Record<string, unknown>,
    reason: string,
    senderJid: string,
    botAdmin: unknown,
    fkontak: unknown
) {
    try {
        const groupData = getGroup(m.chat) || {}
        const warns     = groupData.warns || {}

        if (!warns[senderJid]) warns[senderJid] = { count: 0 }
        warns[senderJid].count++
        warns[senderJid].updatedAt = Date.now()

        updateGroup(m.chat, { warns })

        const count = warns[senderJid].count

        const isLid          = isLidJid(senderJid)
        const rawLidNum       = senderJid.split('@')[0]
        const resolvedPhone   = isLid ? resolveLidToPhone(senderJid) : null
        const phoneNum        = resolvedPhone || normNum(senderJid)
        const mentionJid    = resolvedPhone
            ? `${phoneNum}@s.whatsapp.net`
            : senderJid
        const displayName   =
            getPushName(senderJid)                                         ||
            getPushName(rawLidNum)                                         ||
            (resolvedPhone ? getPushName(`${phoneNum}@s.whatsapp.net`) : null) ||
            (resolvedPhone ? getPushName(phoneNum) : null)                 ||
            (m as any).pushName                                            ||
            (resolvedPhone ? `+${phoneNum}` : rawLidNum)

        try {

            let ppUrl: string | null = null
            try {
                ppUrl = await (sock as any).profilePictureUrl(mentionJid, 'image')
            } catch {}
            const ppThumb: string = ppUrl || 'https://cdn.ornzora.eu.cc/92fb27b5-5ffd-4f5f-905a-9b8d0573a1af-upload-1780208822400.jpg'

            const warningBody =
                `@${phoneNum} melanggar aturan:\n` +
                `*${reason}*\n\n` +
                `Nama: *${displayName}*\n` +
                (count >= 5
                    ? 'Peringatan penuh! Akan segera dikeluarkan.'
                    : `Jika mencapai 5 peringatan, akan dikeluarkan.`)

            const btn = new ButtonV2(sock as any)
                .setTitle(`⚠️ Peringatan ${count}/5`)
                .setSubtitle('')
                .setBody(warningBody)
                .setFooter(`© ${botName}`)
                .setThumbnail(ppThumb)
                .setContextInfo({ mentionedJid: [mentionJid] })

            btn.addButton('📋 Menu', '.menu')

            const msg = await btn.build(m.chat as string, { userJid: (sock as any).user?.id })
            await (sock as any).relayMessage(m.chat, msg.message, { messageId: msg.key.id })
        } catch (sendErr) {
            const _errMsg = (sendErr as Error).message
            console.warn('[ANTI] ButtonV2 gagal, fallback plain text:', _errMsg)

            // Kalau rate-overlimit, tunggu dulu 3 detik sebelum kirim fallback
            if (_errMsg?.includes('rate-overlimit')) await sleep(3000)

            const warnText = `*⚠️ Peringatan ${count}/5*\n\n` +
                `@${phoneNum} melanggar aturan:\n` +
                `*${reason}*\n\n` +
                `Nama: *${displayName}*\n` +
                (count >= 5
                    ? 'Peringatan penuh! Akan segera dikeluarkan.'
                    : `Jika mencapai 5 peringatan, akan dikeluarkan.`)

            // Retry kirim warning sekali kalau masih kena rate-overlimit
            for (let _wAttempt = 1; _wAttempt <= 2; _wAttempt++) {
                try {
                    await (sock as any).sendMessage(m.chat, {
                        text: warnText,
                        mentions: [mentionJid]
                    }, { quoted: fkontak || m })
                    break
                } catch (fallbackErr: any) {
                    if (fallbackErr?.message?.includes('rate-overlimit') && _wAttempt === 1) {
                        await sleep(5000)
                        continue
                    }
                    console.warn('[ANTI] Gagal kirim pesan warning:', fallbackErr?.message)
                    break
                }
            }
        }

        if (count >= 5) {

            warns[senderJid].count = 0
            updateGroup(m.chat, { warns })

            const kickJid = await findKickableJid(sock, m.chat as string, senderJid)
            if (kickJid) {
                try {
                    await (sock as any).groupParticipantsUpdate(m.chat, [kickJid], 'remove')
                    console.log(`[ANTI] ✅ Kicked ${displayName} (${phoneNum}) | kickJid=${kickJid}`)
                } catch (kickErr) {
                    console.error(`[ANTI] ❌ groupParticipantsUpdate gagal (${kickJid}):`, (kickErr as Error).message)
                }
            } else {

                console.warn(`[ANTI] Kick dibatalkan untuk ${displayName} (${phoneNum})`)
            }
        }

    } catch (e) {
        console.error('[ANTI] addWarn error:', (e as Error).message)
    }
}

async function act(
    sock: Record<string, unknown>,
    m: Record<string, unknown>,
    reason: string,
    senderJid: string,
    botAdmin: unknown,
    fkontak: unknown
) {
    try {
        await deleteMsg(sock, m)
        console.log(`[ANTI] Deleted (${reason}) from ${senderJid.split('@')[0]}`)
    } catch (e) {
        console.error('[ANTI] Delete failed:', (e as Error).message)
    }
    await addWarn(sock, m, reason, senderJid, botAdmin, fkontak)
}

function isBotMessage(m: Record<string, unknown>): boolean {
    const pushName = (m.pushName as string) || ''
    const mtype    = (m.mtype as string) || ''
    const msg      = (m.message as Record<string, unknown>) || {}

    const BOT_MTYPES = [
        'interactiveMessage',      
        'listMessage',             
        'buttonsMessage',          
        'templateMessage',         
        'highlyStructuredMessage', 
    ]
    if (BOT_MTYPES.includes(mtype)) return true

    if (msg.viewOnceMessage) {
        const inner = (msg.viewOnceMessage as any)?.message || {}
        if (inner.interactiveMessage || inner.buttonsMessage) return true
    }

    const ctx: Record<string, unknown> =
        (msg.extendedTextMessage as any)?.contextInfo   ||
        (msg.imageMessage as any)?.contextInfo          ||
        (msg.videoMessage as any)?.contextInfo          ||
        (msg.documentMessage as any)?.contextInfo       ||
        {}
    if (ctx.externalAdReply) return true

    const lowerName = pushName.toLowerCase()
    if (/\bbot\b/.test(lowerName) && !/^~/.test(pushName)) return true

    const ltext = getText(m) as string

    if (/©\s*\S+/.test(ltext)) return true

    if (/[╭╰┃]/.test(ltext) && /[╌─┄]/.test(ltext)) return true

    if (/[「」]/.test(ltext)) return true

    const lines = ltext.split('\n')
    const prefixedLines = lines.filter((l: string) => /^[┃|◉•▸►»]/.test(l.trim()))
    if (prefixedLines.length >= 4) return true

    if (/hallo pengguna|silakan tekan tombol|permintaan anda sedang diproses/i.test(ltext)) return true
    if (/hello user|please wait|click the button|your request is being processed/i.test(ltext)) return true
    if (/level up|breakthrough|you have reached a new (level|stage)|exp gained/i.test(ltext)) return true
    if (/\+\d+[\.,]?\d*\s*(exp|xp|money|coin|gold|gems?)\b/i.test(ltext)) return true

    return false
}

export default {
    tags: ['group', 'anti', 'passive'],

    handler: async (m, { Morela, isOwn, isAdmin, botAdmin, fkontak }) => {

        if (!m.isGroup)  return
        if (!m.message)  return

        if (isOwn) return

        const from = m.chat

        const senderJid: string = (
            (m.sender as string) ||
            (m.key?.participant as string) ||
            (m.key?.remoteJid as string) ||
            ''
        )

        if (!senderJid) return

        const grp = getGroup(from)
        if (!grp) return

        const mtype = (m.mtype as string) || ''

        if (isAdmin) return

        if (grp.antibot && isBotMessage(m)) {
            console.log(`[ANTI-BOT] Bot terdeteksi: ${senderJid} | mtype: ${mtype}`)
            return act(Morela, m, FEATURE_NAMES.antibot, senderJid, botAdmin, fkontak)
        }

        if (grp.antivideo && mtype === 'videoMessage') {
            return act(Morela, m, FEATURE_NAMES.antivideo, senderJid, botAdmin, fkontak)
        }

        if (grp.antifoto && mtype === 'imageMessage') {
            return act(Morela, m, FEATURE_NAMES.antifoto, senderJid, botAdmin, fkontak)
        }

        if (grp.antiaudio && mtype === 'audioMessage') {
            return act(Morela, m, FEATURE_NAMES.antiaudio, senderJid, botAdmin, fkontak)
        }

        if (grp.antidokumen && mtype === 'documentMessage') {
            return act(Morela, m, FEATURE_NAMES.antidokumen, senderJid, botAdmin, fkontak)
        }

        if (grp.antisticker && mtype === 'stickerMessage') {
            return act(Morela, m, FEATURE_NAMES.antisticker, senderJid, botAdmin, fkontak)
        }

        if (grp.antimention && mtype === 'groupStatusMentionMessage') {
            return act(Morela, m, FEATURE_NAMES.antimention, senderJid, botAdmin, fkontak)
        }
    }
}
