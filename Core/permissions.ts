import type { MsgObj, ExtSocket } from '../types/global.js';
import chalk from 'chalk';
import { getPhoneByLid, saveLidMap, savePushName, getGroupParticipants, findParticipantByLid, findParticipantByPhone } from '../Database/db.js';
import { getMainOwner, isMainOwner } from '../System/mainowner.js';
import { isJadibot } from '../Library/jadibotdb.js';
import {
    groupMetadataCache,
    _msgHandlerLiveFetchTs,
    _MSG_LIVE_FETCH_COOLDOWN,
    getGroupMetadataCached
} from './cache.js';
import { saveGroup as dbSaveGroup } from '../Database/db.js';
(globalThis as Record<string, unknown>).getGroupParticipants   = getGroupParticipants;
(globalThis as Record<string, unknown>).findParticipantByLid   = findParticipantByLid;
(globalThis as Record<string, unknown>).findParticipantByPhone = findParticipantByPhone;
(globalThis as Record<string, unknown>).dbGetGroup             = (await import('../Database/db.js')).getGroup;
export interface PermissionResult {
    senderNumber:  string | null;
    groupMetadata: Record<string, unknown> | null;
    groupName:     string;
    participants:  Array<{ id: string; admin?: string | null; lid?: string }>;
    groupAdmin:    string[];
    botAdmin:      boolean;
    isAdmin:       boolean;
    isOwn:         boolean;
    isPrem:        boolean;
    isSuperOwn:    boolean;
    senderIsLid:   boolean;
}
export async function resolvePermissions(
    Morela: ExtSocket,
    m: MsgObj,
    store: Record<string, unknown> | null,
    Owner: string[],
    Premium: string[],
    botJid: string
): Promise<PermissionResult> {
    const _rawRemoteJid  = (m.key?.remoteJid || '') as string;
    const _isPrivateChat = !_rawRemoteJid.endsWith('@g.us');
    const _mSenderRaw    = (m.sender || m.key.participant || m.key.remoteJid || '') as string;
    const senderRaw      = (_isPrivateChat && _mSenderRaw.endsWith('@lid') && _rawRemoteJid && !_rawRemoteJid.endsWith('@lid'))
        ? _rawRemoteJid
        : _mSenderRaw;
    const senderIsLid = senderRaw.endsWith('@lid');
    const from        = m.key.remoteJid;
    const pushname    = m.pushName || "No Name";
    const botNumber   = botJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    const botJidFull  = botNumber + '@s.whatsapp.net';
   let senderNumber:  string | null = null;
    let groupMetadata: Record<string, unknown> | null = null;
    let groupName     = "";
    let participants:  Array<{ id: string; admin?: string | null; lid?: string }> = [];
    let groupAdmin:    string[]  = [];
    let botAdmin       = false;
    let isAdmin        = false;
    function _findBotInParticipants(pList: Array<{ id: string; admin?: string | null; lid?: string; phoneNumber?: string; jid?: string }>) {
        return pList.find(p => {
            const pNum = p.id.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            if (pNum === botNumber && pNum.length > 4) return true;
            if ((p as any).phoneNumber) {
                const phoneNum = ((p as any).phoneNumber as string).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                if (phoneNum === botNumber && phoneNum.length > 4) return true;
            }
            if ((p as any).jid) {
                const jidNum = ((p as any).jid as string).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                if (jidNum === botNumber && jidNum.length > 4) return true;
            }
            if (p.id.endsWith('@lid')) {
                const _resolved = getPhoneByLid(pNum);
                if (_resolved && _resolved.replace(/[^0-9]/g, '') === botNumber) return true;
            }
            return false;
        });
    }
    const { getGroupAdm } = await import('../System/message.js');
    if (m.isGroup) {
        try {
            groupMetadata = await getGroupMetadataCached(Morela, from, store);
            groupName     = (groupMetadata.subject as string) || "";
            participants  = (groupMetadata.participants as Array<{ id: string; admin?: string | null; lid?: string; phoneNumber?: string }>) || [];            
            let senderParticipant = null;
            if (senderIsLid) {
                const senderLid = senderRaw.split('@')[0];
                senderParticipant = participants.find(p => {
                    if (p.lid && p.lid.split('@')[0] === senderLid) return true;
                    if (p.id && p.id.endsWith('@lid') && p.id.split('@')[0] === senderLid) return true;
                    return false;
                });
            }
            if (!senderParticipant) {
                const senderNum = senderRaw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                senderParticipant = participants.find(p => {
                    const pNum = p.id.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                    return pNum === senderNum && pNum.length > 4;
                });
            }
            if (senderParticipant) {
                const _pId = senderParticipant.id || '';
                if (_pId.endsWith('@lid') && (senderParticipant as any).phoneNumber) {
                    senderNumber = ((senderParticipant as any).phoneNumber as string).split('@')[0].split(':')[0];
                } else {
                    senderNumber = _pId.split('@')[0].split(':')[0];
                }
                isAdmin = senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin';
                if (senderIsLid) {
                    const senderLid = senderRaw.split('@')[0];
                    saveLidMap(senderLid, senderNumber!);
                    if (pushname && pushname !== 'No Name') savePushName(senderLid, pushname);
                } else {
                    if (pushname && pushname !== 'No Name' && senderNumber) {
                        savePushName(senderNumber, pushname);
                    }
                }
            } else {               
                const _nowSender  = Date.now();
                const _lastFetch  = _msgHandlerLiveFetchTs.get(from) ?? 0;
                const _canFetch   = (_nowSender - _lastFetch) > _MSG_LIVE_FETCH_COOLDOWN;
                if (_canFetch) {
                    try {
                        _msgHandlerLiveFetchTs.set(from, _nowSender);
                        const liveMeta = await (Morela.groupMetadata as (jid: string) => Promise<Record<string, unknown>>)(from);
                        if (liveMeta) {
                            groupMetadataCache.set(from, { data: liveMeta, timestamp: Date.now() });
                            dbSaveGroup(from, liveMeta as import('../types/global.js').GroupData);
                            const liveParticipants = (liveMeta.participants as Array<{ id: string; admin?: string | null }>) || [];
                            const senderClean = senderRaw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                            const liveSender = liveParticipants.find(p => {
                                const pNum = p.id.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                                return pNum === senderClean && pNum.length > 4;
                            });
                            if (liveSender) {
                                const _lId = liveSender.id || '';
                                if (_lId.endsWith('@lid') && (liveSender as any).phoneNumber) {
                                    senderNumber = ((liveSender as any).phoneNumber as string).split('@')[0].split(':')[0];
                                } else {
                                    senderNumber = _lId.split('@')[0].split(':')[0];
                                }
                                isAdmin = liveSender.admin === 'admin' || liveSender.admin === 'superadmin';
                                participants = liveParticipants as any;
                            }
                        }
                    } catch (liveErr) {
                        console.warn(`[LIVE FETCH FAILED] ${(liveErr as Error).message}`);
                    }
                } else {
                    console.log(chalk.yellow(`[DB-FIRST] Sender tidak ditemukan tapi cooldown aktif, skip live fetch grup ${from}`));
                }
                if (!senderNumber) {
                    if (senderIsLid) {
                        const senderLid   = senderRaw.split('@')[0];
                        const mappedPhone = getPhoneByLid(senderLid);
                        senderNumber = mappedPhone ?? senderLid;
                    } else {
                        senderNumber = senderRaw.split('@')[0].split(':')[0];
                    }
                }
            }
            groupAdmin = await getGroupAdm(participants); 
            let _botParticipant = _findBotInParticipants(participants);
            if (!_botParticipant) {
                const _nowBot   = Date.now();
                const _lastBot  = _msgHandlerLiveFetchTs.get(from) ?? 0;
                const _canFetch = (_nowBot - _lastBot) > _MSG_LIVE_FETCH_COOLDOWN;
                if (_canFetch) {
                    try {
                        _msgHandlerLiveFetchTs.set(from, _nowBot);
                        const _liveMeta = await (Morela.groupMetadata as (jid: string) => Promise<Record<string, unknown>>)(from);
                        const _liveP    = (_liveMeta.participants as Array<{ id: string; admin?: string | null; phoneNumber?: string; jid?: string }>) || [];
                        _botParticipant = _findBotInParticipants(_liveP as any);
                        if (_botParticipant) {
                            groupMetadataCache.set(from, { data: _liveMeta, timestamp: Date.now() });
                            dbSaveGroup(from, _liveMeta as import('../types/global.js').GroupData);
                            participants = _liveP as any;
                        }
                    } catch (_liveErr) {
                        console.warn(`[BOT-LID] Live fetch gagal: ${(_liveErr as Error).message}`);
                    }
                } else {
                    console.log(chalk.yellow(`[DB-FIRST] Bot tidak ditemukan di cache tapi cooldown aktif`));
                }
            }     
            if (_botParticipant && _botParticipant.id.endsWith('@lid')) {
                const botLid = _botParticipant.id.split('@')[0];
                if (!getPhoneByLid(botLid)) {
                    const botPhone = (_botParticipant as any).phoneNumber
                        ? ((_botParticipant as any).phoneNumber as string).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
                        : (_botParticipant as any).jid
                            ? ((_botParticipant as any).jid as string).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
                            : botNumber;
                    if (botPhone) {
                        saveLidMap(botLid, botPhone);
                        console.log(chalk.green(`[BOT-LID] Bot LID dipetakan: ${botLid} → ${botPhone}`));
                    }
                }
            }
            if (!_botParticipant) {
                let _mappedAny = false;
                for (const _p of participants) {
                    if (!(_p.id as string).endsWith('@lid')) continue;
                    const _pLid = (_p.id as string).split('@')[0];
                    if (getPhoneByLid(_pLid)) continue;
                    const _pPhone: string | null =
                        (_p as any).phoneNumber
                            ? ((_p as any).phoneNumber as string).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
                            : (_p as any).jid
                                ? ((_p as any).jid as string).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
                                : null;
                    if (_pPhone && _pPhone.length > 4) {
                        saveLidMap(_pLid, _pPhone);
                        console.log(chalk.yellow(`[BOT-LID] Pre-map LID ${_pLid} → ${_pPhone}`));
                        _mappedAny = true;
                    }
                }
                if (_mappedAny) _botParticipant = _findBotInParticipants(participants);
            }
            if (!_botParticipant) {
                const _unmappedLids = participants.filter((_p: any) =>
                    (_p.id as string).endsWith('@lid') && !getPhoneByLid((_p.id as string).split('@')[0])
                );
                if (_unmappedLids.length === 1) {
                    const _onlyLid = (_unmappedLids[0].id as string).split('@')[0];
                    saveLidMap(_onlyLid, botNumber);
                    console.log(chalk.yellow(`[BOT-LID] Single-LID heuristic: ${_onlyLid} → ${botNumber}`));
                    _botParticipant = _findBotInParticipants(participants);
                }
            }
            botAdmin = !!(_botParticipant && (_botParticipant.admin === 'admin' || _botParticipant.admin === 'superadmin'));   
            if (!botAdmin && _botParticipant && _botParticipant.admin === undefined) {
                const _nowVerify  = Date.now();
                const _lastVerify = _msgHandlerLiveFetchTs.get(from + '_verify') ?? 0;
                const _canVerify  = (_nowVerify - _lastVerify) > 30 * 60 * 1000;
                if (_canVerify) {
                    try {
                        _msgHandlerLiveFetchTs.set(from + '_verify', _nowVerify);
                        const _verifyMeta = await (Morela.groupMetadata as (jid: string) => Promise<Record<string, unknown>>)(from);
                        const _verifyP    = (_verifyMeta.participants as Array<{ id: string; admin?: string | null }>) || [];
                        groupMetadataCache.set(from, { data: _verifyMeta, timestamp: Date.now() });
                        dbSaveGroup(from, _verifyMeta as import('../types/global.js').GroupData);
                        participants = _verifyP as any;
                        const _verifyBot = _findBotInParticipants(_verifyP as any);
                        if (_verifyBot) {
                            _botParticipant = _verifyBot;
                            botAdmin = !!(_verifyBot.admin === 'admin' || _verifyBot.admin === 'superadmin');
                        }
                    } catch (_verifyErr) {
                        console.warn(`[BOT-ADMIN] Live verify gagal: ${(_verifyErr as Error).message}`);
                    }
                }
            }
        } catch (error) {
            const _gerr      = error as Error;
            const isTimeout  = _gerr.message?.includes('timeout');
            console.error(isTimeout
                ? `[GROUP METADATA TIMEOUT] Grup ${from} - mencoba LID map fallback...`
                : `[GROUP METADATA ERROR]: ${_gerr.message}`
            );
            if (senderIsLid) {
                const senderLid   = senderRaw.split('@')[0];
                const mappedPhone = getPhoneByLid(senderLid);
                senderNumber = mappedPhone ?? senderLid;
            } else {
                senderNumber = senderRaw.split('@')[0].split(':')[0];
            }
        }
    } else { 
        const privateSenderRaw = (senderRaw || m.key?.remoteJid || m.sender || '') as string;
        const privateIsLid     = privateSenderRaw.endsWith('@lid');
        if (privateIsLid) {
            const senderLid   = privateSenderRaw.split('@')[0];
            const mappedPhone = getPhoneByLid(senderLid);
            if (mappedPhone) {
                senderNumber = mappedPhone;
            } else {
                const _keyJid = (m.key?.remoteJid || '') as string;
                if (_keyJid && !_keyJid.endsWith('@lid') && !_keyJid.endsWith('@g.us')) {
                    senderNumber = _keyJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                } else {
                    senderNumber = senderLid;
                }
            }
        } else {
            senderNumber = privateSenderRaw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        }
    }
    if (senderNumber && !/^\d+$/.test(senderNumber)) {
        const _lidClean    = senderNumber.replace(/[^0-9]/g, '');
        const _lidResolved = getPhoneByLid(_lidClean);
        if (_lidResolved) {
            console.log(chalk.green(`[SAFETY NET] senderNumber LID ${senderNumber} → ${_lidResolved}`));
            senderNumber = _lidResolved;
        }
    }
    const MAIN_OWNER_NUM = getMainOwner();
    const _cleanMainOwner = MAIN_OWNER_NUM ? MAIN_OWNER_NUM.replace(/[^0-9]/g, '') : '';
    const _cleanBotNum    = botNumber.replace(/[^0-9]/g, '');
    const _cleanSender    = senderNumber ? String(senderNumber).replace(/[^0-9]/g, '') : '';
    const jadibotNumber         = m._isJadibot ? botNumber : null;
    const _sessionsActive       = (global.jadibotSessions?.size ?? 0) > 0;
    const senderIsJadibotItself = !!(jadibotNumber && senderNumber === jadibotNumber);
    const isActiveJadibotSender = _sessionsActive && !!(
        senderNumber &&
        (MAIN_OWNER_NUM ? senderNumber !== MAIN_OWNER_NUM : true) &&
        (global.jadibotSessions?.has(senderNumber) || isJadibot(senderNumber))
    );
    const _allSenderCandidates: string[] = [
        _cleanSender,
        (senderRaw || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, ''),
        (m.sender   || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, ''),
        (m.key?.participant || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, ''),
        (!(m.key?.remoteJid || '').endsWith('@g.us')
            ? (m.key?.remoteJid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
            : '')
    ].filter((n): n is string => !!(n && /^\d{5,}$/.test(n)));
    const _isMainOwnerAny = !!(_cleanMainOwner && _allSenderCandidates.some(n => n === _cleanMainOwner));
    const _isOwnerAny     = Owner.some(ownerNum => {
        const c = ownerNum.replace(/[^0-9]/g, '');
        return _allSenderCandidates.some(n => n === c);
    });
    const isOwn: boolean = !!(!senderIsJadibotItself && !isActiveJadibotSender &&
        (_allSenderCandidates.length > 0) && (
            m._isJadibot
                ? (_isMainOwnerAny || _isOwnerAny)
                : (_isOwnerAny || _cleanSender === _cleanBotNum || _isMainOwnerAny)
        ));
    const isPrem: boolean = !!(!senderIsJadibotItself && !isActiveJadibotSender && (
        m._isJadibot
            ? (
                _isMainOwnerAny || _isOwnerAny ||
                Premium.some(premNum => {
                    const c = premNum.replace(/[^0-9]/g, '');
                    return _allSenderCandidates.some(n => n === c);
                }) ||
                _cleanSender === _cleanBotNum
            )
            : (
                Premium.some(premNum => {
                    const c = premNum.replace(/[^0-9]/g, '');
                    return _allSenderCandidates.some(n => n === c);
                }) ||
                _cleanSender === _cleanBotNum
            )
    ));
    const isSuperOwn = !!(_isMainOwnerAny && !senderIsJadibotItself);
    return {
        senderNumber,
        groupMetadata,
        groupName,
        participants,
        groupAdmin,
        botAdmin,
        isAdmin,
        isOwn,
        isPrem,
        isSuperOwn,
        senderIsLid,
    };
}
