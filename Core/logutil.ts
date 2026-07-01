import fs from 'fs';
import path from 'path';
import type { ExtSocket } from '../types/global.js';
import { kvGet } from '../Database/kvstore.js';
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
