import type { ExtSocket, GetFileResult, GroupData, MsgObj } from './types/global.js';
import type { AnyMessageContent } from '@itsliaaa/baileys';
import type { Logger } from 'pino';
import './config.js';
import NodeCache from 'node-cache';
import * as baileys from "@itsliaaa/baileys";
const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidDecode,
} = baileys;
import chalk from 'chalk';
import { playBootSequence, logger, printStartup } from './System/logger.js';
import pino from 'pino';
import readline from 'readline';
import { initDB, saveGroup, getGroup, getAllGroups, getPhoneByLid, saveGroupParticipants, deleteGroup } from './Database/db.js';
import { initLimitDB } from './Database/usagelimit.js';
import { startTgBot } from './tgbot.js';
import { initTgGlobal } from './Library/tg_global.js';
import { initStats } from "./Database/stats.js";
import { initGcScheduler } from './Plugins-ESM/admin/openclose-schedule.js';
import { makeCustomStore, type BaileysStore } from './Core/store.js';
import { writeLog, patchConsoleError } from './Core/logutil.js';
import { attachSocketExtensions } from './Core/sockext.js';
import { initSewaScheduler } from './Core/sewa.js';
import { registerEvents } from './Core/events.js';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import { tgNotifyLogout } from './tgbot.js';
initDB();
initLimitDB();
initStats();
patchConsoleError();
const usePairingCode  = true;
const silentLogger: Logger = pino({ level: 'silent' }) as unknown as Logger;
function question(query: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(query, (answer: string) => { rl.close(); resolve(answer); });
    });
}
let _isShuttingDown = false;
let _currentSock: any = null;
const stateRef = {
    get isReady()                  { return _stateInner.isReady; },
    set isReady(v: boolean)        { _stateInner.isReady = v; },
    get isShuttingDown()           { return _isShuttingDown; },
    set isShuttingDown(v: boolean) { _isShuttingDown = v; },
};
const _stateInner = { isReady: false };
const RECONNECT_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}
async function connectToWhatsApp(): Promise<void> {
    if (_currentSock) {
        try { _currentSock.ev.removeAllListeners(); } catch {}
        try { _currentSock.ws.close(); } catch {}
        _currentSock = null;
        await sleep(RECONNECT_DELAY_MS);
    }
    await playBootSequence({ name: 'MORELA', version: '2.0.0', mode: 'public' });
    logger.system('node',    `v${process.version} | PID: ${process.pid}`);
    logger.system('started', new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
    console.log('');
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const store: BaileysStore  = makeCustomStore();
    let version: number[];
    try {
        const _fv = await fetchLatestBaileysVersion();
        version = _fv.version;
    } catch {
        version = [2, 3000, 1018827609];
        console.warn('[WA] fetchLatestBaileysVersion gagal, pakai fallback version');
    }
    const msgRetryCounterCache = new NodeCache({ stdTTL: 60, useClones: false });
    const _rawSocket = makeWASocket({
        printQRInTerminal:              !usePairingCode,
        version,
        browser:                        ["Ubuntu", "Chrome", "114.0.5735.198"],
        syncFullHistory:                false,
        markOnlineOnConnect:            true,
        connectTimeoutMs:               60000,
        defaultQueryTimeoutMs:          60000,
        keepAliveIntervalMs:            25000,
        generateHighQualityLinkPreview: true,
        cachedGroupMetadata: async (jid: string) => store.groupMetadata?.[jid] ?? undefined,
        getMessage: async (key: { remoteJid?: string; id?: string }) => {
            const jid = key.remoteJid;
            if (!jid) return undefined;
            const arr = store.messages?.[jid]?.array as Array<{ key?: { id?: string }; message?: unknown }> | undefined;
            const found = arr?.find((m) => m?.key?.id === key.id);
            return found?.message as AnyMessageContent | undefined;
        },
        msgRetryCounterCache,
        logger: silentLogger,
        auth: {
            creds: state.creds,
            keys:  makeCacheableSignalKeyStore(state.keys, silentLogger),
        }
    });
    const Morela = _rawSocket as unknown as ExtSocket;
    _currentSock  = _rawSocket;
    Morela.ev.on('connection.update', async (update: Record<string, unknown>) => {
        const { connection, lastDisconnect } = update as {
            connection?: string;
            lastDisconnect?: { error?: unknown };
        };
        if (connection !== 'close') return;
        stateRef.isReady = false;
        if (stateRef.isShuttingDown) {
            console.log(chalk.gray('[CONNECTION] Ditutup saat shutdown — skip reconnect.'));
            return;
        }
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        writeLog(`[DISCONNECT] code=${statusCode}`);
        console.log(chalk.yellow(`❌ Koneksi tertutup (code=${statusCode})`));
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        if (isLoggedOut) {
            console.log(chalk.red('❌ Logged out! Sesi lama dihapus, bot restart buat pairing baru.'));
            writeLog('[DISCONNECT] Logged out — hapus sesi & restart');
            try { await tgNotifyLogout(); } catch {}
            try {
                if (fs.existsSync('./session')) fs.rmSync('./session', { recursive: true, force: true });
            } catch (e) { console.error('[SESSION] Gagal hapus folder session:', (e as Error).message); }
            process.exitCode = 69;
            process.exit();
        }
        try { Morela.ev.removeAllListeners(); } catch {}
        try { (Morela as any).ws?.close?.(); } catch {}
        _currentSock = null;
        await sleep(RECONNECT_DELAY_MS);
        connectToWhatsApp();
    });
    if (!Morela.authState.creds.registered) {
        await new Promise<void>(r => setTimeout(() => r(), 3000));
        const phoneNumber = await question(chalk.blue(`Enter Your Number\nYour Number: `));
        const code = await Morela.requestPairingCode(phoneNumber.trim(), "MORELAXZ");
        logger.success('pairing', `Kode: ${code}`);
    }
    Morela.decodeJid = (jid: string): string => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const d = jidDecode(jid) ?? {};
            return d.user && d.server ? `${d.user}@${d.server}` : jid;
        }
        return jid;
    };
    store.bind(Morela.ev);
    globalThis.__messageStore__ = store;
    globalThis.__sock__         = Morela as unknown as typeof globalThis.__sock__;
    attachSocketExtensions(Morela);
    setTimeout(() => initGcScheduler(Morela), 10_000);
    setInterval(() => {
        try {
            if (!store?.messages) return;
            let total = 0;
            for (const jid of Object.keys(store.messages)) {
                const arr = (store.messages[jid] as { array?: unknown[] })?.array;
                if (arr && arr.length > 50) {
                    total += arr.length - 50;
                    (store.messages[jid] as { array: unknown[] }).array = arr.slice(-50);
                }
            }
            if (total > 0) logger.system('store', `Cleared ${total} old messages`);
        } catch {}
    }, 12 * 60 * 60 * 1000);
    initSewaScheduler(Morela);
    registerEvents(Morela, store, stateRef, saveCreds);
}
function shutdown(signal: string): void {
    if (stateRef.isShuttingDown) return;
    stateRef.isShuttingDown = true;
    writeLog(`[SHUTDOWN] ${signal}`);
    console.log(chalk.gray(`[SHUTDOWN] ${signal} diterima, nutup koneksi...`));
    try { (_currentSock as any)?.ws?.close?.(); } catch {}
    setTimeout(() => process.exit(0), 1500);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
initTgGlobal();
startTgBot();
const STARTUP_GRACE_MS = 5000;
logger.system('connect', `Startup, tunggu ${STARTUP_GRACE_MS / 1000}s sebelum connect ke WhatsApp...`);
setTimeout(() => { connectToWhatsApp(); }, STARTUP_GRACE_MS);
