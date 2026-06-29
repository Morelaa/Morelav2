import type { MsgObj, ExtSocket } from './types/global.js'
import { isSelfMode, isSelfModeGlobal, isAllowedWhenSelf } from './System/selfmode.js'
import { isPrivateMode } from './System/privatemode.js'
import { kvGet, kvSet } from './Database/kvstore.js'
import './config.js';
import util from 'util';
import chalk from 'chalk';
import path from 'path';
import { logMessage, getDeviceHint } from './System/logger.js'
import { fileURLToPath } from 'url';
import fs from 'fs';
import { DateTime } from 'luxon';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as baileys from '@itsliaaa/baileys';
const {
    downloadContentFromMessage,
    proto,
    generateWAMessage,
    getContentType,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    areJidsSameUser
} = baileys;
const __filename   = fileURLToPath(import.meta.url as string);
const __dirname    = path.dirname(__filename);
const execPromise  = promisify(exec);
import { smsg, tanggal, getTime, isUrl, sleep, clockString, runtime, fetchJson, getBuffer, jsonformat, format, parseMention, getRandom, getGroupAdm, generateProfilePicture } from './System/message.js';
import Case from './Library/system.js';
import { getGreeting } from './Library/utils.js';
import { runPassiveHandlers } from './Plugins-ESM/_pluginmanager.js';
import handleMessage from './Library/handle.js';
import { isJadibot, hasAnyJadibot, listJadibot } from './Library/jadibotdb.js';
import { getMainOwner, isMainOwner } from './System/mainowner.js';
import { initGcScheduler } from './Plugins-ESM/admin/openclose-schedule.js';
import { getOwnerList, getPremiumList, getFkontak, invalidateFkontakCache, invalidateOwnerCache, invalidatePremiumCache, invalidateGroupCache as _invalidateGroupCache } from './Core/cache.js';
import { resolvePermissions } from './Core/permissions.js';
export { invalidateFkontakCache, invalidateOwnerCache, invalidatePremiumCache };
export { getPhoneByLid } from './Database/db.js';
export function invalidateGroupCache(groupJid: string): void {
    _invalidateGroupCache(groupJid);
}
const Morela = async (Morela: ExtSocket, m: MsgObj, chatUpdate: Record<string, unknown>, store: Record<string, unknown> | null): Promise<void> => {
    initGcScheduler(Morela);
    if (store) (globalThis as Record<string, unknown>).__botStore__ = store;
    try {
        let body = '';
        if (m.message?.interactiveResponseMessage) {
            const interactiveResponse = m.message.interactiveResponseMessage;
            const nativeFlowResponse  = interactiveResponse.nativeFlowResponseMessage;
            if (nativeFlowResponse) {
                try {
                    const paramsJson = JSON.parse(nativeFlowResponse.paramsJson);
                    body = paramsJson.id || paramsJson.display_text || interactiveResponse.body?.text || '';
                } catch (e) {
                    body = interactiveResponse.body?.text || '';
                    console.error('[InteractiveResponse] paramsJson parse error:', (e as Error).message);
                }
            } else {
                body = interactiveResponse.body?.text || '';
            }
        } else if (m.message?.listResponseMessage) {
            body = m.message.listResponseMessage.singleSelectReply?.selectedRowId || '';
        } else if (m.message?.templateButtonReplyMessage) {
            body = m.message.templateButtonReplyMessage.selectedId || "";
        } else if (m.message?.buttonsResponseMessage) {
            body = m.message.buttonsResponseMessage.selectedButtonId || '';
        } else {
            const messageTypes = {
                conversation:        m.message?.conversation || '',
                imageMessage:        m.message?.imageMessage?.caption || '',
                videoMessage:        m.message?.videoMessage?.caption || '',
                audioMessage:        m.message?.audioMessage?.caption || '',
                stickerMessage:      m.message?.stickerMessage?.caption || '',
                documentMessage:     m.message?.documentMessage?.fileName || '',
                extendedTextMessage: m.message?.extendedTextMessage?.text || '',
            };
            if (m.mtype && (messageTypes as Record<string, string>)[m.mtype]) {
                body = (messageTypes as Record<string, string>)[m.mtype];
            } else if (m.text) {
                body = m.text;
            } else {
                body = '';
            }
        }
        const budy          = (typeof m.text === 'string' ? m.text : '');
        const prefixPattern = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi;
        const prefixMatch   = body.match(prefixPattern);
        const prefix        = global.prefa ? (prefixMatch ? prefixMatch[0] : "") : (global.prefa ?? global.prefix);
        const _hasAnyJadibotActive = (global.jadibotSessions?.size ?? 0) > 0;
        if (!m._isJadibot && _hasAnyJadibotActive) {
            const _isGroup    = (m.key?.remoteJid as string || '').endsWith('@g.us');
            const _rawSender  = _isGroup
                ? (m.key?.participant || m.key?.remoteJid || '')
                : m.fromMe ? '' : (m.key?.remoteJid || m.sender || '');
            const _rawStr     = (_rawSender as string) || '';
            let _quickNum     = _rawStr.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            if (_rawStr.endsWith('@lid')) {
                const { getPhoneByLid } = await import('./Database/db.js');
                const _lidNum   = _rawStr.split('@')[0];
                const _resolved = getPhoneByLid(_lidNum);
                if (_resolved) _quickNum = _resolved.replace(/[^0-9]/g, '');
            }
            if (_quickNum && !isMainOwner(_quickNum)) return;
        }
        const Owner   = await getOwnerList();
        const Premium = await getPremiumList();
        const CMD     = body.startsWith(prefix);
        const command = CMD ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args    = CMD ? body.slice(prefix.length).trim().split(' ').slice(1) : [];
        const text    = args.join(' ');
        const BotNum  = await Morela.decodeJid(Morela.user?.id ?? '');
        const botJid  = BotNum.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        const from    = m.key.remoteJid;
        const sender  = m.isGroup ? (m.key.participant || m.participant) : m.key.remoteJid;
        const pushname = m.pushName || "No Name";
        const perm = await resolvePermissions(Morela, m, store, Owner, Premium, botJid);
        const {
            senderNumber, groupMetadata, groupName,
            participants, groupAdmin, botAdmin, isAdmin,
            isOwn, isPrem, isSuperOwn
        } = perm;
        if (command) {
            const _cleanMainOwner = getMainOwner()?.replace(/[^0-9]/g, '') ?? '';
            const _cleanBotNum    = botJid.split('@')[0].split(':')[0];
            const _cleanSender    = senderNumber ? String(senderNumber).replace(/[^0-9]/g, '') : '';
            console.log(chalk.gray(`[OWNER DEBUG] sender=${_cleanSender} mainOwner=${_cleanMainOwner} bot=${_cleanBotNum} isGroup=${m.isGroup}`));
        }
        const fatkuns = m.quoted || m;
        let quoted    = m.quoted || null;
        if (fatkuns.mtype === 'buttonsMessage') {
            quoted = fatkuns[Object.keys(fatkuns)[1]];
        } else if (fatkuns.mtype === 'templateMessage') {
            quoted = fatkuns.hydratedTemplate?.[Object.keys(fatkuns.hydratedTemplate)[1]];
        } else if (fatkuns.mtype === 'product') {
            quoted = fatkuns[Object.keys(fatkuns)[0]];
        }
        const reply = async (teks: string): Promise<unknown> => {
            const fk = await getFkontak(Morela, m);
            return Morela.sendMessage(m.chat, { text: teks }, { quoted: fk });
        };
        const time = DateTime.now().setZone("Asia/Jakarta").toFormat("HH:mm:ss");
        const ucapanWaktu = getGreeting();
        const todayDateWIB = new Date().toLocaleDateString('id-ID', {
            timeZone: 'Asia/Jakarta', year: 'numeric', month: 'long', day: 'numeric'
        });
        const RunTime   = `_${runtime(process.uptime())}_`;
        const pickRandom = (arr: unknown[]): unknown => arr[Math.floor(Math.random() * arr.length)];
        if (!m.message?.reactionMessage) {
            const _logGroupName = groupName || (from as string) || 'Unknown Group';
            const _logMsgId     = (m.key?.id as string) ?? '';
            const _logDevice    = getDeviceHint(_logMsgId);
            const _logBody      = ((m.body || m.text || '') as string);
            const _logSender    = senderNumber
                ? (senderNumber + '@s.whatsapp.net')
                : (m.sender || m.key?.remoteJid || '');
            logMessage({
                chatType:    m.isGroup ? 'group' : 'private',
                groupName:   _logGroupName,
                pushName:    pushname,
                sender:      _logSender,
                message:     _logBody,
                messageType: m.mtype as string,
                isOwner:     isOwn,
                isPremium:   isPrem,
                isPartner:   false,
                isAdmin:     isAdmin,
                device:      _logDevice,
            });
        }        
        const handleDataesm = {
            Morela,
            text, args, isOwn, isPrem, CMD, command, reply, m,
            botAdmin, isAdmin, groupAdmin, participants, store,
            downloadContentFromMessage,
            senderJid:  senderNumber ? (senderNumber + '@s.whatsapp.net') : (m.sender || m.key.remoteJid),
            usedPrefix: prefix,
            conn:       Morela
        };
        if (!isOwn && isSelfMode(from)) return;
        try {
            await runPassiveHandlers(m, {
                Morela, isOwn, isPrem, isAdmin, botAdmin, downloadContentFromMessage
            });
        } catch (error) {
            console.error('[Passive Handlers Error]:', (error as Error).message);
        }
        if (m._stikerHandled) return;
        if (m.isGroup) {
            if (isSelfMode(from) && !isOwn) return;
        } else {
            if (!isOwn && isPrivateMode()) return;
        }
        if (isOwn) { try { kvSet('lastchat_owner', 'jid', from); } catch {} }
        let pluginHandled: boolean = false;
        if (CMD) {
            try {
                pluginHandled = await handleMessage(m, command, handleDataesm);
            } catch (error) {
                console.error('Plugin handler error:', error);
                if (isOwn) {
                    await reply(`⚠️ Plugin error: ${(error as Error).message}\n\nGunakan .restart jika masalah berlanjut.`);
                }
            }
        }        
        if (!pluginHandled) {
            switch (command) {
                default:
                    if (budy.startsWith('=>') && isSuperOwn) {
                        try {
                            const code = budy.slice(2).replace(/[\u200e\u200f\u200b\u200d\u2028\u2029\ufeff\u00a0]/g, ' ').trim();
                            const conn = Morela; void conn;
                            const sock = Morela; void sock;
                            const result = await eval(`(async () => { return ${code} })()`);
                            let out = result === undefined ? '✅ Done (no return value)' : util.format(result);
                            if (out.length > 3500) out = out.slice(0, 3500) + '\n\n…(terpotong)';
                            await m.reply(out);
                        } catch (error) {
                            await m.reply(`❌ Error:\n${(error as Error).message}`);
                        }
                    } else if (budy.startsWith('>') && isSuperOwn) {
                        try {
                            const code = budy.slice(1).replace(/[\u200e\u200f\u200b\u200d\u2028\u2029\ufeff\u00a0]/g, ' ').trim();
                            const conn = Morela; void conn;
                            const sock = Morela; void sock;
                            let evaled: unknown;
                            let isExprErr = false;
                            try {
                                evaled = await eval(`(async () => { return ${code} })()`);
                            } catch (e1) {
                                const msg1 = (e1 as Error).message ?? '';
                                if (/SyntaxError|Unexpected token|Cannot use import|Identifier/.test(msg1)) {
                                    isExprErr = true;
                                } else {
                                    throw e1;
                                }
                            }
                            if (isExprErr) {
                                evaled = await eval(`(async () => { ${code} })()`);
                            }
                            let out: string;
                            if (evaled === undefined) {
                                out = '✅ Done (no return value)';
                            } else if (typeof evaled === 'string') {
                                out = evaled;
                            } else {
                                out = util.inspect(evaled, { depth: 4, colors: false });
                            }
                            if (out.length > 3500) out = out.slice(0, 3500) + '\n\n…(terpotong)';
                            await m.reply(out);
                        } catch (error) {
                            await m.reply(`❌ Error:\n${(error as Error).message}`);
                        }
                    } else if (budy.startsWith('$') && isSuperOwn) {
                        const shellCmd = budy.slice(1).trim();
                        try { kvSet('lastchat_owner', 'jid', from); } catch {}
                        const isRestartCmd = /\b(pm2\s+(restart|stop|reload|kill)|systemctl\s+restart|kill\s+-9\s+\$\$|reboot)\b/i.test(shellCmd);
                        if (isRestartCmd) {
                            try { await m.reply(`⏳ Menjalankan: \`${shellCmd}\`\n\n_Bot akan restart dalam beberapa detik..._`); } catch {}
                            await new Promise(r => setTimeout(r, 2500));
                            console.log(`[SHELL] $ ${shellCmd}`);
                            execPromise(shellCmd).catch(() => {});
                            return;
                        }
                        console.log(`[SHELL] $ ${shellCmd}`);
                        execPromise(shellCmd)
                            .then(({ stdout, stderr }) => {
                                const out = stdout?.trim();
                                const err = stderr?.trim();
                                if (err) {
                                    console.error(`[SHELL] stderr: ${err}`);
                                    return m.reply(`⚠️ *stderr:*\n\`\`\`\n${err}\n\`\`\``);
                                }
                                if (out) {
                                    console.log(`[SHELL] stdout: ${out}`);
                                    return m.reply(`📤 *stdout:*\n\`\`\`\n${out}\n\`\`\``);
                                }
                                return m.reply('✅ Command executed (no output)');
                            })
                            .catch(error => {
                                console.error(`[SHELL] error: ${(error as Error).message}`);
                                return m.reply(`❌ *Error:*\n\`\`\`\n${(error as Error).message}\n\`\`\``);
                            });
                    }
                    break;
            }
        }
    } catch (error) {
        console.error(chalk.red.bold('Error in message handler:'), error);
        const selfModeActive = m?.key?.remoteJid ? isSelfMode(m.key.remoteJid) : false;
        if (m && m.chat) {
            try {
                const senderRawCheck = m.key?.participant || m.key?.remoteJid || '';
                let senderNumCheck   = senderRawCheck.split('@')[0].split(':')[0];
                if (senderRawCheck.endsWith('@lid')) {
                    const { getPhoneByLid } = await import('./Database/db.js');
                    const mappedPhone = getPhoneByLid(senderNumCheck);
                    if (mappedPhone) senderNumCheck = mappedPhone;
                }
                let ownerCheck: string[] = [];
                try { ownerCheck = kvGet<string[]>('own', 'list', []); } catch {}
                if (!ownerCheck.length && global.owner) {
                    ownerCheck = Array.isArray(global.owner) ? global.owner : [global.owner];
                }
                const isOwnerForError = ownerCheck.some(o => o.replace(/[^0-9]/g, '') === senderNumCheck);
                if (isOwnerForError) {
                    try {
                        const _ownerJid = ownerCheck[0].replace(/[^0-9]/g,'') + '@s.whatsapp.net';
                        const _outerErr = error as Error;
                        await Morela.sendMessage(_ownerJid, {
                            text: '❌ *Error di Bot*\n\n' + (_outerErr.stack || _outerErr.message).slice(0, 1500)
                        });
                    } catch {}
                }
            } catch (sendError) {
                console.error('Failed to send error message:', sendError);
            }
        }
    }
};
const currentFile = __filename;
fs.watchFile(currentFile, () => {
    fs.unwatchFile(currentFile);
    console.log(chalk.green(`✔ ${path.basename(currentFile)} updated! Reloading...`));
});
export default Morela;
