import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import type { ExtSocket } from '../types/global.js';
import { kvGet } from '../Database/kvstore.js';
import { logger } from '../System/logger.js';
const _logDir  = './logs';
const _logFile = _logDir + '/error.log';
const _LOG_MAX = 2 * 1024 * 1024;
if (!fs.existsSync(_logDir)) fs.mkdirSync(_logDir, { recursive: true });
export function rotateLog(): void {
    try {
        if (fs.statSync(_logFile).size >= _LOG_MAX) {
            fs.renameSync(_logFile, _logFile.replace('.log', `_${Date.now()}.log`));
            const old = fs.readdirSync(_logDir)
                .filter((f: string) => f.startsWith('error_') && f.endsWith('.log'))
                .sort();
            while (old.length > 5) {
                const f = old.shift();
                if (f) try { fs.unlinkSync(path.join(_logDir, f)); } catch {}
            }
        }
    } catch {}
}
export function writeLog(msg: string): void {
    try {
        rotateLog();
        fs.appendFileSync(_logFile, `[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] ${msg}\n`);
    } catch {}
}
export function safeOwnerJid(): string | null {
    try {
        const own = kvGet<string[]>('own', 'list', []);
        return Array.isArray(own) && own[0] ? own[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
    } catch { return null; }
}
const _throttle = new Map<string, number>();
const _origErr  = console.error.bind(console);
export function patchConsoleError(): void {
    console.error = (...args: unknown[]) => {
        _origErr(...args);
        try {
            const msg = args.map(a => typeof a === 'object'
                ? ((a as Record<string,unknown>)?.stack ?? (a as Record<string,unknown>)?.message ?? JSON.stringify(a))
                : String(a)).join(' ');
            if (!['failed','Error','error','timeout','status code'].some(k => msg.includes(k))) return;
            writeLog(msg);
            const k = msg.slice(0, 50), last = _throttle.get(k) ?? 0;
            if (Date.now() - last < 30_000) return;
            _throttle.set(k, Date.now());
            if (_throttle.size > 100) {
                const now = Date.now();
                for (const [k2,t] of _throttle) if (now - t > 5*60_000) _throttle.delete(k2);
            }
            const jid = safeOwnerJid();
            if (jid) (globalThis.__sock__ as ExtSocket | undefined)?.sendMessage(jid, { text: '🔴 *Console Error*\n\n' + msg.slice(0, 1500) });
        } catch {}
    };
}
export function registerProcessHandlers(writeLogFn: (msg: string) => void): void {
    process.on('uncaughtException', (err: unknown) => {
        const _e = err as Error;
        console.error(chalk.red.bold('🔴 [uncaughtException]'), _e.message, _e.stack);
        writeLogFn('[uncaughtException] ' + (_e.stack ?? _e.message));
        const jid = safeOwnerJid();
        if (jid) try { (globalThis.__sock__ as ExtSocket | undefined)?.sendMessage(jid, { text: '🔴 *uncaughtException*\n\n' + (_e.stack ?? _e.message).slice(0, 1500) }); } catch {}
    });
    process.on('unhandledRejection', (reason: unknown) => {
        const r   = reason as Error;
        const msg = r?.message ?? String(r);
        if (['Timed Out','Connection Closed','Connection Terminated','Socket connection timeout'].some(e => msg.includes(e))) return;
        console.error(chalk.red.bold('🔴 [unhandledRejection]'), msg);
        writeLogFn('[unhandledRejection] ' + String(r?.stack ?? r?.message ?? r));
        const jid = safeOwnerJid();
        if (jid) try { (globalThis.__sock__ as ExtSocket | undefined)?.sendMessage(jid, { text: '🔴 *unhandledRejection*\n\n' + String(r?.stack ?? r?.message ?? r).slice(0, 1500) }); } catch {}
    });
}
export async function gracefulShutdown(signal: string, writeLogFn: (msg: string) => void, isShuttingDownRef: { value: boolean }): Promise<void> {
    if (isShuttingDownRef.value) return;
    isShuttingDownRef.value = true;
    logger.warn('shutdown', `[${signal}] Graceful shutdown...`);
    writeLogFn(`[SHUTDOWN] ${signal}`);
    try {
        const sock = globalThis.__sock__ as (ExtSocket & { end: (e: Error) => Promise<void> }) | undefined;
        if (sock) {
            try { (sock as any).ws?.close?.(); } catch {}
        }
    } catch (e) { console.log(chalk.gray('[SHUTDOWN] Socket close:', (e as Error).message)); }
    logger.success('shutdown', 'Selesai.');
    setTimeout(() => process.exit(0), 500);
}
