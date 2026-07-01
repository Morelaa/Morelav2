import type { ExtSocket, GroupData, MsgObj } from '../types/global.js';
import type { GroupMetadata } from '@itsliaaa/baileys';
import chalk from 'chalk';
import * as baileys from '@itsliaaa/baileys';
const { jidDecode } = baileys;
import { smsg } from '../System/message.js';
import morelaHandler, { invalidateGroupCache } from '../Morela.js';
import {
    saveGroup, updateGroup, deleteGroup, getGroup, getAllGroups,
    getPhoneByLid, purgeGroupData, saveGroupParticipants,
    upsertParticipant, removeParticipant, setParticipantRole,
    deleteGroupParticipants
} from '../Database/db.js';
import { sendWelcome } from '../Plugins-ESM/admin/welcome.js';
import { sendGoodbye } from '../Plugins-ESM/admin/goodbye.js';
import { logger, logConnection } from '../System/logger.js';
import { kvGet } from '../Database/kvstore.js';
import { getMainOwner } from '../System/mainowner.js';
import type { BaileysStore } from './store.js';
import fs from 'fs';
export function registerEvents(
    Morela: ExtSocket,
    store: BaileysStore,
    stateRef: {
        isReady:        boolean;
        isShuttingDown: boolean;
    },
    saveCreds: () => void
): void {
    const _processedIds = new Set<string>();
    const _DEDUP_TTL = 10_000;
    Morela.ev.on('messages.upsert', async (chatUpdate: Record<string, unknown>) => {
        type _ChatUpd = { type: string; messages: Array<Record<string, unknown>> };
        const _cu = chatUpdate as unknown as _ChatUpd;
        if (!stateRef.isReady) return;
        try {
            if (_cu.type !== 'notify') {
                const _tmp    = _cu.messages?.[0];
                const _key    = _tmp?.key as Record<string,unknown> | undefined;
                const _tmpMsg = _tmp?.message as Record<string,unknown> | undefined;
                const _hasGMentions = (_msg: Record<string,unknown> | undefined): boolean => {
                    if (!_msg) return false;
                    for (const key of Object.keys(_msg)) {
                        const inner = (_msg as any)[key];
                        if (!inner || typeof inner !== 'object') continue;
                        const ctx = (inner as any).contextInfo || {};
                        if (Array.isArray(ctx.groupMentions) && ctx.groupMentions.length > 0) return true;
                    }
                    return false;
                };
                const _isSwGc = !!_tmpMsg?.groupStatusMessage || _hasGMentions(_tmpMsg);
                if (!_isSwGc) {
                    const _remoteJid   = String(_key?.remoteJid ?? '');
                    const _isPrivateJid = !!_remoteJid && !_remoteJid.endsWith('@g.us') && _remoteJid !== 'status@broadcast' && !_remoteJid.includes('@newsletter');
                    if (_cu.type !== 'append') return;
                    if (!_isPrivateJid && !_key?.fromMe) return;
                }
            }
            let mek = _cu.messages[0] as Record<string, unknown>;
            const _mkey   = mek.key as Record<string,unknown> | undefined;
            if (!mek.message) return;
            const _mekMsg = mek.message as Record<string,unknown> | undefined;
            const _isGroupStatus = !!_mekMsg?.groupStatusMessage || (() => {
                if (!_mekMsg) return false;
                for (const key of Object.keys(_mekMsg)) {
                    const inner = (_mekMsg as any)[key];
                    if (!inner || typeof inner !== 'object') continue;
                    const ctx = (inner as any).contextInfo || {}; 
                    if (Array.isArray(ctx.groupMentions) && ctx.groupMentions.length > 0) return true;
                }
                return false;
            })();
            if (!_isGroupStatus && _mkey?.fromMe && String(_mkey?.remoteJid ?? '').endsWith('@g.us')) return;
            const _msgId = String(_mkey?.id ?? '');
            if (_msgId && _processedIds.has(_msgId)) return;
            if (_msgId) {
                _processedIds.add(_msgId);
                setTimeout(() => _processedIds.delete(_msgId), _DEDUP_TTL);
            }
            const _outerKey = Object.keys(mek.message as Record<string,unknown>)[0];
            const _msg = mek.message as Record<string, unknown>;
            if (_outerKey === 'deviceSentMessage')  mek.message = (_msg.deviceSentMessage as Record<string,unknown>)?.message  ?? mek.message;
            if (_outerKey === 'ephemeralMessage')    mek.message = (_msg.ephemeralMessage as Record<string,unknown>)?.message   ?? mek.message;
            if ((mek.key as Record<string,unknown>)?.remoteJid === 'status@broadcast') return;
            if (String((mek.key as Record<string,unknown>)?.remoteJid ?? '').includes('@newsletter')) return;
            const _kid = (mek.key as Record<string,unknown>)?.id as string | undefined;
            if (!_kid || (_kid.startsWith('BAE5') && _kid.length === 16)) return;
            const m = smsg(Morela, mek, store);
            morelaHandler(Morela, m, chatUpdate, store).catch((err: Error) => {
                console.error(chalk.red('❌ morelaHandler error:'), err.message);
            });
        } catch (error) {
            console.error(chalk.red("❌ Error processing message:"), (error as Error).message);
        }
    });
    Morela.ev.on('connection.update', async (update: Record<string, unknown>) => {
        const { connection } = update as { connection?: string };
        if (connection === 'open') {
            stateRef.isReady = true;
            logConnection('connected', `Morela v2.0.0 · Node ${process.version} · PID ${process.pid}`);
            logger.success('whatsapp', 'Morela siap digunakan!');
            setTimeout(async () => {
                try {
                    let ownerJid: string;
                    try {
                        const jid = kvGet<string>('lastchat_owner', 'jid', '');
                        if (!jid) throw new Error('no lastchat_owner');
                        ownerJid = jid;
                    } catch {
                        try {
                            ownerJid = getMainOwner() + '@s.whatsapp.net';
                        } catch { ownerJid = (global.mainOwner ?? '').replace(/[^0-9]/g,'') + '@s.whatsapp.net'; }
                    }
                    const mem = process.memoryUsage();
                    await Morela.sendMessage(ownerJid, {
                        text: `✅ *Morela Online*\n\n` +
                              `Node    : ${process.version}\n` +
                              `PID     : ${process.pid}\n` +
                              `Memory  : ${(mem.rss / 1024 / 1024).toFixed(1)} MiB\n` +
                              `Started : ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
                    });
                } catch (e) { console.error('[NOTIF ONLINE] Gagal kirim:', (e as Error).message); }
            }, 5000);
            try {
                const { clearAllJadibot } = await import('../Library/jadibotdb.js');
                if (!global.jadibotSessions || global.jadibotSessions.size === 0) {
                    clearAllJadibot();
                    logger.system('jadibotdb', 'Data jadibot dibersihkan saat startup');
                }
            } catch (e) { console.error('[JADIBOTDB CLEAN]', (e as Error).message); }
            setTimeout(async () => {
                try {
                    const jadibotDir = './sessions/jadibot';
                    if (fs.existsSync(jadibotDir)) {
                        const { spawnJadibot } = await import('../Plugins-ESM/owner/jadibot.js');
                        const MAX_JADIBOT_AUTORESTORE = 5;
                        const STAGGER_MS = 15000;
                        const pending = fs.readdirSync(jadibotDir)
                            .filter((nomor) => !global.jadibotSessions?.has(nomor))
                            .slice(0, MAX_JADIBOT_AUTORESTORE);
                        if (pending.length > 0) {
                            logger.warn('jadibot', `Auto-restore ${pending.length} sesi, dijeda ${STAGGER_MS / 1000}s per sesi`);
                        }
                        for (let i = 0; i < pending.length; i++) {
                            const nomor = pending[i];
                            setTimeout(() => {
                                logger.system('jadibot', `Auto-restore: ${nomor}`);
                                spawnJadibot(nomor, () => {}, null as never, null as never).catch(() => {});
                            }, i * STAGGER_MS);
                        }
                    }
                    setTimeout(async () => {
                        try {
                            const { syncWithSessions } = await import('../Library/jadibotdb.js');
                            if (global.jadibotSessions) { syncWithSessions(global.jadibotSessions); logger.success('jadibotdb', 'Sync selesai'); }
                        } catch (e) { console.error('[JADIBOTDB SYNC]', (e as Error).message); }
                    }, 8000);
                } catch (e) { console.error('[JADIBOT AUTO-RESTORE]', (e as Error).message); }
            }, 5000);
            setTimeout(async () => {
                try {
                    const activeJids = new Set(Object.keys(await Morela.groupFetchAllParticipating()));
                    let cleaned = 0;
                    for (const jid of Object.keys(getAllGroups())) {
                        if (!activeJids.has(jid)) { deleteGroup(jid); invalidateGroupCache(jid); cleaned++; }
                    }
                    if (cleaned > 0) logger.system('group-db', `${cleaned} grup stale dihapus`);
                } catch (e) { console.error('[GROUP CLEANUP] Error:', (e as Error).message); }
            }, 10000);
        }
    });
    Morela.ev.on('group-participants.update', async (update: unknown) => {
        const { id, participants: rawParticipants, action } = update as {
            id: string;
            participants: Array<string | { id?: string; jid?: string; phoneNumber?: string | number }>;
            action: string;
        };
        if (!id) return;
        invalidateGroupCache(id);
        type _ParticipantFull = { jid: string; phoneNumber: string | null };
        const participantsFull: _ParticipantFull[] = (rawParticipants ?? []).map(p => {
            if (typeof p === 'string') return { jid: p, phoneNumber: null };
            const _jid   = ((p as any).id ?? (p as any).jid ?? '') as string;
            const _phone = (p as any).phoneNumber
                ? String((p as any).phoneNumber).replace(/[^0-9]/g, '') || null
                : null;
            return { jid: _jid, phoneNumber: _phone };
        }).filter((p): p is _ParticipantFull => !!p.jid);
        const participants: string[] = participantsFull.map(p => p.jid);
        const botNum     = Morela.user?.id?.replace(/[^0-9]/g, '') ?? '';
        const botJidFull = (Morela.user?.id?.split(':')[0] ?? '') + '@s.whatsapp.net';
        let botRemoved = false;
        if (action === 'remove' || action === 'leave') {
            for (const p of participants) {
                if (p === botJidFull) { botRemoved = true; break; }
                const pClean = p.replace(/[^0-9]/g, '');
                if (pClean === botNum) { botRemoved = true; break; }
                if (p.endsWith('@lid')) {
                    const resolved = getPhoneByLid(pClean);
                    if (resolved && resolved.replace(/[^0-9]/g, '') === botNum) { botRemoved = true; break; }
                }
            }
        }
        if (botRemoved) {
            logger.warn("group-db", `Bot removed/left from ${id}`);
            const purgeResult = purgeGroupData(id);
            invalidateGroupCache(id);
            try {
                const { cancelGroupSchedule } = await import('../Plugins-ESM/admin/openclose-schedule.js');
                cancelGroupSchedule(id);
            } catch {}
            console.log(`[GROUP-DB] Purge grup ${id} selesai → ${purgeResult.tables.join(', ')}${purgeResult.errors.length ? ' | errors: ' + purgeResult.errors.join(', ') : ''}`);
            return;
        }
        const getMeta = async (): Promise<GroupMetadata | null> => {
            try {
                if (store?.groupMetadata?.[id]) delete store.groupMetadata[id];
                return await Morela.groupMetadata(id);
            } catch { return null; }
        };
        if (action === 'add' || action === 'approve') {
            const botJustJoined = participantsFull.some(p => {
                if (p.jid === botJidFull) return true;
                return p.jid.replace(/[^0-9]/g, '') === botNum;
            });
            if (botJustJoined) {
                logger.system('group-db', `Bot join grup baru: ${id}, fetch metadata dari WA...`);
                try {
                    const meta = await Morela.groupMetadata(id) as GroupMetadata;
                    if (meta) {
                        const _cache = (globalThis as any).__groupMetadataCache__ as Map<string, { data: any; timestamp: number }> | undefined;
                        if (_cache) _cache.set(id, { data: meta, timestamp: Date.now() });
                        saveGroup(id, { id: meta.id, name: meta.subject, ...meta as any });
                        if (Array.isArray((meta as any).participants) && (meta as any).participants.length > 0) {
                            saveGroupParticipants(id, (meta as any).participants);
                        }
                        logger.success('group-db', `Grup baru tersimpan: ${meta.subject} (${id}), ${(meta.participants as any[])?.length ?? 0} member`);
                    }
                } catch (e) {
                    console.error('[GROUP-JOIN] Gagal fetch metadata:', (e as Error).message);
                }
            }
        }
        if ((action === 'add' || action === 'approve') && participantsFull.length > 0) {
            for (const pObj of participantsFull) {
                if (pObj.jid) upsertParticipant(id, { id: pObj.jid, phoneNumber: pObj.phoneNumber ?? undefined });
            }
            try {
                const gd   = getGroup(id);
                const meta = gd?.welcome ? await getMeta() : null;
                if (gd?.welcome && meta) {
                    saveGroup(id, { id: meta.id, name: meta.subject });
                    for (const pObj of participantsFull) {
                        if (!pObj.jid) continue;
                        try {
                            const _p = meta.participants?.find((p: any) => {
                                const _pId = typeof p === 'string' ? p : (p?.id || p?.jid || '');
                                return _pId === pObj.jid || _pId.split('@')[0] === pObj.jid.split('@')[0];
                            }) as any;
                            const _pushname     = _p?.notify || _p?.name || _p?.verifiedName || null;
                            const _phoneNumHint = pObj.phoneNumber || (_p?.phoneNumber ? String(_p.phoneNumber).replace(/[^0-9]/g, '') : null);
                            await sendWelcome(Morela, id, pObj.jid, meta.subject ?? 'Group', meta.participants?.length ?? 0, _pushname, gd.intro ?? false, _phoneNumHint);
                        } catch {}
                    }
                }
            } catch {}
        }

        if ((action === 'remove' || action === 'leave') && participants.length > 0) {
            for (const jidRm of participants) {
                if (jidRm) removeParticipant(id, jidRm);
            }
            try {
                const gd   = getGroup(id);
                const meta = gd?.goodbye ? await getMeta() : null;
                if (gd?.goodbye && meta) {
                    saveGroup(id, { id: meta.id, name: meta.subject });
                    for (const jid3 of participants) {
                        if (!jid3) continue;
                        try {
                            const _pObj  = participantsFull.find(p => p.jid === jid3);
                            const _pMeta = meta.participants?.find((p: any) => {
                                const _pId = typeof p === 'string' ? p : (p?.id || p?.jid || '');
                                return _pId === jid3 || _pId.split('@')[0] === jid3.split('@')[0];
                            }) as any;
                            const _pushname  = _pMeta?.notify || _pMeta?.name || _pMeta?.verifiedName || null;
                            const _phoneHint = _pObj?.phoneNumber || (_pMeta?.phoneNumber ? String(_pMeta.phoneNumber).replace(/[^0-9]/g, '') : null);
                            await sendGoodbye(Morela, id, jid3, meta.subject ?? 'Group', meta.participants?.length ?? 0, _pushname, _phoneHint);
                        } catch {}
                    }
                }
            } catch {}
        }
        if (action === 'promote' || action === 'demote') {
            const newRole = action === 'promote' ? 'admin' : 'member';
            for (const jidP of participants) {
                if (jidP) setParticipantRole(id, jidP, newRole as 'admin' | 'member');
            }
            try { const m = await getMeta(); if (m) saveGroup(id, { id: m.id, name: m.subject }); } catch {}
        }
    });
    Morela.ev.on('groups.update', async (updates: unknown) => {
        const _updates = updates as Partial<GroupMetadata>[];
        for (const update of _updates) {
            if (!update.id) continue;
            invalidateGroupCache(update.id);
            const partial: Partial<GroupData> = {};
            if (update.subject !== undefined)           partial.name = update.subject;
            if (update.desc !== undefined)               partial.desc = update.desc;
            if ((update as any).restrict !== undefined)  (partial as any).restrict = (update as any).restrict ? 1 : 0;
            if ((update as any).announce !== undefined)  (partial as any).announce = (update as any).announce ? 1 : 0;
            if (Object.keys(partial).length > 0) updateGroup(update.id, partial);
        }
    });
    Morela.ev.on('creds.update', saveCreds);
    Morela.ev.on('call', async (_caller: unknown) => { console.log("CALL OUTGOING"); });
    (Morela.ev as unknown as { on(e: string, fn: (err: Error) => void): void }).on('error', (err: Error) => {
        console.error(chalk.red("Error: "), err.message);
    });
}
