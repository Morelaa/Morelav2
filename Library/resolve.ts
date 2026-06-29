import {
    getPhoneByLid,
    getLidByPhone,
    getPushName,
} from '../Database/db.js'
import { isMainOwner as _isMainOwnerNum } from '../System/mainowner.js'
type AnyMsg = Record<string, any>
type AnyParticipant = {
    id: string
    lid?: string
    admin?: string | null
    notify?: string
    name?: string
    verifiedName?: string
    phoneNumber?: string
    jid?: string
    [key: string]: any
}
type AnySock = Record<string, any>
export function normNum(raw: string | null | undefined): string {
    if (!raw) return ''
    return String(raw).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
}
export function isLidJid(raw: string | null | undefined): boolean {
    return !!raw && String(raw).endsWith('@lid')
}
export function resolveLidToPhone(rawLid: string | null | undefined): string | null {
    if (!rawLid) return null
    const lidNum = normNum(rawLid)
    if (!lidNum) return null
    const phone = getPhoneByLid(lidNum)
    return phone ? normNum(phone) : null
}
export function resolvePhoneToLid(phone: string | null | undefined): string | null {
    if (!phone) return null
    return getLidByPhone(normNum(phone))
}
export function toPhoneJid(raw: string | null | undefined): string | null {
    if (!raw) return null
    if (isLidJid(raw)) {
        const phone = resolveLidToPhone(raw)
        return phone ? phone + '@s.whatsapp.net' : raw
    }
    const num = normNum(raw)
    return num && num.length >= 5 ? num + '@s.whatsapp.net' : null
}
export function getMentionJid(raw: string | null | undefined): string {
    if (!raw) return ''
    if (isLidJid(raw)) {
        const phone = resolveLidToPhone(raw)
        if (phone) return phone + '@s.whatsapp.net'
        return raw
    }
    const num = normNum(raw)
    return num ? num + '@s.whatsapp.net' : raw
}
export function findParticipant(
    participants: AnyParticipant[] | null | undefined,
    rawTarget: string | null | undefined
): AnyParticipant | null {
    if (!participants?.length || !rawTarget) return null
    let found = participants.find(p => p.id === rawTarget)
    if (found) return found
    if (isLidJid(rawTarget)) {
        const lidNum = rawTarget.split('@')[0]   
        found = participants.find(p => {
            if (p.lid && normNum(p.lid) === lidNum) return true
            if (p.id?.endsWith('@lid') && normNum(p.id) === lidNum) return true
            return false
        })
        if (found) return found
        const phone = resolveLidToPhone(lidNum)
        if (phone) {
            found = participants.find(p => {
                const pNum = normNum(p.id)
                return pNum === phone && pNum.length > 4
            })
            if (found) return found
        }
    } else {
        const targetNum = normNum(rawTarget)
        found = participants.find(p => {
            const pNum = normNum(p.id)
            if (pNum === targetNum && pNum.length > 4) return true
            if (p.id?.endsWith('@lid')) {
                const resolved = resolveLidToPhone(p.id)
                if (resolved === targetNum) return true
            }
            return false
        })
        if (found) return found
    }
    return null
}
export function findBotParticipant(
    participants: AnyParticipant[] | null | undefined,
    botNumberOrJid: string | null | undefined
): AnyParticipant | null {
    if (!participants?.length || !botNumberOrJid) return null
    const botNumber = normNum(botNumberOrJid)
    if (!botNumber) return null
    return participants.find(p => {
        const pNum = normNum(p.id)
        if (pNum === botNumber && pNum.length > 4) return true
        if (p.phoneNumber) {
            const phoneNum = normNum(p.phoneNumber)
            if (phoneNum === botNumber && phoneNum.length > 4) return true
        }
        if (p.jid) {
            const jidNum = normNum(p.jid)
            if (jidNum === botNumber && jidNum.length > 4) return true
        }
        if (p.id?.endsWith('@lid')) {
            const resolved = resolveLidToPhone(p.id)
            if (resolved === botNumber) return true
        }
        return false
    }) ?? null
}
export function isParticipantAdmin(p: AnyParticipant | null | undefined): boolean {
    return !!p && (p.admin === 'admin' || p.admin === 'superadmin')
}
export async function resolveBotAdmin(
    sock: AnySock,
    groupJid: string,
    participants?: AnyParticipant[] | null
): Promise<boolean> {
    try {
        const botJid = sock?.user?.id ?? ''
        let list = participants ?? []

        let botEntry = findBotParticipant(list, botJid)
        if (!botEntry) {
            try {
                const liveMeta = await sock.groupMetadata(groupJid)
                list = liveMeta?.participants ?? []
                botEntry = findBotParticipant(list, botJid)
            } catch { /* abaikan, biarkan return false di bawah */ }
        }
        return isParticipantAdmin(botEntry)
    } catch {
        return false
    }
}
export async function isSenderAdminInGroup(
    sock: AnySock,
    groupJid: string,
    senderRaw: string,
    participants?: AnyParticipant[] | null
): Promise<boolean> {
    try {
        let list = participants ?? []
        let p = findParticipant(list, senderRaw)
        if (!p) {
            try {
                const meta = await sock.groupMetadata(groupJid)
                list = meta?.participants ?? []
                p = findParticipant(list, senderRaw)
            } catch { /* ignore */ }
        }
        return isParticipantAdmin(p)
    } catch {
        return false
    }
}
export interface ResolveTargetResult {
    jid: string | null
    raw: string | null
    quotedPushName: string | null
    source: 'quoted' | 'mention' | 'args' | 'self' | null
}
export function resolveTarget(
    m: AnyMsg,
    args: string[] = [],
    opts: { senderJid?: string; argIndex?: number; fallbackSelf?: boolean; minDigits?: number } = {}
): ResolveTargetResult {
    const { senderJid, argIndex = 0, fallbackSelf = false, minDigits = 8 } = opts
    if (m?.quoted) {
        const raw: string | undefined =
            m.quoted.sender || m.quoted.key?.participant || m.quoted.key?.remoteJid
        if (raw) {
            const quotedPushName: string | null = m.quoted.pushName || m.quoted.name || null
            const jid = toPhoneJid(raw) || raw
            return { jid, raw, quotedPushName, source: 'quoted' }
        }
    }
    if (m?.mentionedJid?.[0]) {
        const raw: string = m.mentionedJid[0]
        const jid = toPhoneJid(raw) || raw
        return { jid, raw, quotedPushName: null, source: 'mention' }
    }
    if (args[argIndex]) {
        const num = normNum(args[argIndex])
        if (num.length >= minDigits) {
            const jid = num + '@s.whatsapp.net'
            return { jid, raw: jid, quotedPushName: null, source: 'args' }
        }
    }
    if (fallbackSelf) {
        const raw = senderJid || m?.sender || null
        const jid = raw ? (toPhoneJid(raw) || raw) : null
        return { jid, raw, quotedPushName: null, source: jid ? 'self' : null }
    }
    return { jid: null, raw: null, quotedPushName: null, source: null }
}
export async function resolveDisplayName(
    sock: AnySock,
    m: AnyMsg,
    targetJid: string,
    opts: {
        quotedPushName?: string | null
        participants?: AnyParticipant[] | null
        fallback?: string
    } = {}
): Promise<string> {
    const { quotedPushName = null, participants = null, fallback } = opts
    const num = normNum(targetJid)
    const store = (globalThis as any).__botStore__
    if (store?.groupMetadata && m?.isGroup) {
        const gmParticipants = store.groupMetadata[m.chat]?.participants
        const p = findParticipant(gmParticipants, num)
        const n = p?.notify || p?.name || p?.verifiedName
        if (typeof n === 'string' && n.trim()) return n.trim()
    }
    if (store?.contacts) {
        for (const c of [targetJid, num + '@s.whatsapp.net', num + '@c.us']) {
            const n = store.contacts[c]?.notify || store.contacts[c]?.name || store.contacts[c]?.verifiedName
            if (typeof n === 'string' && n.trim()) return n.trim()
        }
    }
    const lidJid = resolvePhoneToLid(num)
    const lidNum = lidJid ? lidJid.split('@')[0] : null
    const dbName =
        (lidNum ? getPushName(lidNum) : null) ||
        getPushName(num) ||
        getPushName(targetJid) ||
        getPushName(num + '@s.whatsapp.net')
    if (typeof dbName === 'string' && dbName.trim()) return dbName.trim()
    if (participants?.length) {
        const p = findParticipant(participants, num)
        const n = p?.notify || p?.name || p?.verifiedName
        if (typeof n === 'string' && n.trim()) return n.trim()
    }
    if (quotedPushName?.trim()) return quotedPushName.trim()
    if (typeof m?.pushName === 'string' && m.pushName.trim()) {
        const senderNum = normNum(m.sender)
        if (senderNum === num) return m.pushName.trim()
    }
    if (m?.isGroup && sock?.groupMetadata) {
        try {
            const meta = await sock.groupMetadata(m.chat)
            const p = findParticipant(meta?.participants, num)
            const n = p?.notify || p?.name || p?.verifiedName
            if (typeof n === 'string' && n.trim()) return n.trim()
        } catch { /* ignore */ }
    }
    return fallback ?? ('+' + num)
}
export function resolveNameFromParticipant(
    p: AnyParticipant,
    fallbackPushName?: string | null
): string {
    const raw = p.id
    const isLid = isLidJid(raw)
    const lidNum = raw.split('@')[0]
    const phone = isLid ? resolveLidToPhone(lidNum) : null
    const phoneNum = phone || normNum(raw)
    return (
        getPushName(raw) ||
        getPushName(lidNum) ||
        (phone ? getPushName(phoneNum + '@s.whatsapp.net') : null) ||
        (phone ? getPushName(phoneNum) : null) ||
        p.notify ||
        p.name ||
        fallbackPushName ||
        ('+' + phoneNum)
    )
}
export function safeDeleteParticipant(senderRaw: string | null | undefined): string {
    if (!senderRaw) return ''
    if (isLidJid(senderRaw)) {
        const phone = resolveLidToPhone(senderRaw)
        if (phone) return phone + '@s.whatsapp.net'
    }
    return senderRaw
}
export function safeKickJid(participant: AnyParticipant | null | undefined): string | null {
    return participant?.id ?? null
}
function senderNumFromMsg(m: AnyMsg): string {
    const raw: string = m?.sender || m?.key?.participant || m?.key?.remoteJid || ''
    let num = normNum(raw)
    if (isLidJid(raw)) {
        const resolved = resolveLidToPhone(raw)
        if (resolved) num = resolved
    }
    return num
}
function looksLikeMsg(input: unknown): input is AnyMsg {
    return !!input && typeof input === 'object' && ('sender' in (input as object) || 'key' in (input as object))
}
export function isMainOwner(input: AnyMsg | string | null | undefined): boolean {
    if (!input) return false
    const num = looksLikeMsg(input) ? senderNumFromMsg(input) : resolveAnyToNum(input as string)
    return _isMainOwnerNum(num)
}
function resolveAnyToNum(raw: string): string {
    let num = normNum(raw)
    if (isLidJid(raw)) {
        const resolved = resolveLidToPhone(raw)
        if (resolved) num = resolved
    }
    return num
}
export function isOwner(
    input: AnyMsg | string | null | undefined,
    ownerList: string[] = []
): boolean {
    if (!input) return false
    const num = looksLikeMsg(input) ? senderNumFromMsg(input) : resolveAnyToNum(input as string)
    if (!num) return false
    if (_isMainOwnerNum(num)) return true
    return ownerList.some(o => normNum(o) === num)
}
export function isGroupAdmin(
    input: AnyMsg | string,
    participants: AnyParticipant[] | null | undefined
): boolean {
    const rawSender = looksLikeMsg(input)
        ? (input.sender || input.key?.participant || input.key?.remoteJid || '')
        : input
    const p = findParticipant(participants, rawSender)
    return isParticipantAdmin(p)
}
export default {
    normNum,
    isLidJid,
    resolveLidToPhone,
    resolvePhoneToLid,
    toPhoneJid,
    getMentionJid,
    findParticipant,
    findBotParticipant,
    isParticipantAdmin,
    resolveBotAdmin,
    isSenderAdminInGroup,
    resolveTarget,
    resolveDisplayName,
    resolveNameFromParticipant,
    safeDeleteParticipant,
    safeKickJid,
    isMainOwner,
    isOwner,
    isGroupAdmin,
}
