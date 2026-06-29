import type { ExtSocket } from '../types/global.js';
import { kvGet, kvSet, kvDelete } from '../Database/kvstore.js';
import { saveGroup as dbSaveGroup, getGroup as dbGetGroup } from '../Database/db.js';
const FKONTAK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let   _fkontakMemCache: import('@itsliaaa/baileys').WAMessage | null = null;
function _loadFkontakFromFile(): unknown | null {
    try {
        const data = kvGet<{ _savedAt?: number; fkontak?: unknown } | null>('fkontak_cache', 'cache', null);
        if (data && data._savedAt && (Date.now() - data._savedAt) < FKONTAK_TTL_MS) {
            return data.fkontak;
        }
        return null;
    } catch { return null; }
}

function _saveFkontakToFile(fkontak: unknown): void {
    try {
        kvSet('fkontak_cache', 'cache', { _savedAt: Date.now(), fkontak });
    } catch (e) {
        console.error('[FKONTAK] Gagal simpan cache:', (e as Error).message);
    }
}
export function invalidateFkontakCache(): void {
    _fkontakMemCache = null;
    try { kvDelete('fkontak_cache', 'cache'); } catch {}
    console.log('[FKONTAK] Cache direset — akan fetch ulang ke WA saat dibutuhkan');
}
export async function getFkontak(Morela: ExtSocket, m: unknown): Promise<unknown> {
    if (_fkontakMemCache) return _fkontakMemCache;
    const fromFile = _loadFkontakFromFile();
    if (fromFile) {
        _fkontakMemCache = fromFile as any;
        return _fkontakMemCache;
    }
    try {
        const { buildFkontak: _bfk } = await import('../Library/utils.js');
        const fresh = await _bfk(Morela);
        _fkontakMemCache = fresh as any;
        _saveFkontakToFile(fresh);
        return _fkontakMemCache;
    } catch {
        return m;
    }
}
let _ownerCache: string[] | null = null;
let _ownerCacheTime = 0;
const OWNER_CACHE_TTL = 5 * 60 * 1000;
export async function getOwnerList(): Promise<string[]> {
    const now = Date.now();
    if (_ownerCache && (now - _ownerCacheTime) < OWNER_CACHE_TTL) {
        return _ownerCache;
    }
    try {
        const fromDb = kvGet<string[]>('own', 'list', []);
        if (fromDb && fromDb.length) {
            _ownerCache = fromDb;
            _ownerCacheTime = now;
        }
        if (!_ownerCache?.length && global.owner) {
            _ownerCache = Array.isArray(global.owner) ? global.owner : [global.owner];
        }
    } catch (e) {
        console.error('Error loading owner data:', e);
        if (global.owner) {
            _ownerCache = Array.isArray(global.owner) ? global.owner : [global.owner];
        }
    }
    return _ownerCache || [];
}
export function invalidateOwnerCache(): void {
    _ownerCache = null;
    _ownerCacheTime = 0;
}
let _premiumCache: string[] | null = null;
let _premiumCacheTime = 0;
const PREMIUM_CACHE_TTL = 5 * 60 * 1000;
export async function getPremiumList(): Promise<string[]> {
    const now = Date.now();
    if (_premiumCache && (now - _premiumCacheTime) < PREMIUM_CACHE_TTL) {
        return _premiumCache;
    }
    try {
        const fromDb = kvGet<string[]>('prem', 'list', []);
        if (fromDb) {
            _premiumCache = fromDb;
            _premiumCacheTime = now;
        }
    } catch (e) {
        console.error('Error loading premium data:', e);
    }
    return _premiumCache || [];
}
export function invalidatePremiumCache(): void {
    _premiumCache = null;
    _premiumCacheTime = 0;
}
type _GroupCacheEntry = { data: Record<string, unknown>; timestamp: number };
export const groupMetadataCache = new Map<string, _GroupCacheEntry>();
export const GROUP_CACHE_TTL    = 24 * 60 * 60 * 1000;
export const GROUP_FETCH_TIMEOUT = 5000;
export const pendingGroupFetch  = new Map<string, Promise<Record<string, unknown>>>();
export const _msgHandlerLiveFetchTs  = new Map<string, number>();
export const _MSG_LIVE_FETCH_COOLDOWN = 30 * 1000;

(globalThis as Record<string, unknown>).__groupMetadataCache__ = groupMetadataCache;
export async function getGroupMetadataCached(
    sock: Record<string, unknown>,
    groupJid: string,
    store: Record<string, unknown> | null
): Promise<Record<string, unknown>> {
    const now = Date.now();
    const cached = groupMetadataCache.get(groupJid);
    if (cached && (now - cached.timestamp) < GROUP_CACHE_TTL) {
        return cached.data;
    }
    const _storeGM = store?.groupMetadata as Record<string, Record<string, unknown>> | undefined;
    if (_storeGM && _storeGM[groupJid]) {
        const storeData = _storeGM[groupJid];
        if (storeData && (storeData.participants as unknown[])?.length > 0) {
            groupMetadataCache.set(groupJid, { data: storeData, timestamp: now });
            return storeData;
        }
    }
    const dbData = dbGetGroup(groupJid);
    if (dbData && (dbData.participants as unknown[])?.length > 0) {
        groupMetadataCache.set(groupJid, { data: dbData, timestamp: now });
        return dbData;
    }
    if (pendingGroupFetch.has(groupJid)) {
        return (pendingGroupFetch.get(groupJid) as Promise<Record<string, unknown>>);
    }
    const fetchPromise = Promise.race([
        (sock.groupMetadata as (jid: string) => Promise<Record<string, unknown>>)(groupJid),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`groupMetadata timeout: ${groupJid}`)), GROUP_FETCH_TIMEOUT)
        )
    ]).then((data: unknown) => {
        const dataObj = data as Record<string, unknown>;
        groupMetadataCache.set(groupJid, { data: dataObj, timestamp: Date.now() });
        dbSaveGroup(groupJid, dataObj as import('../types/global.js').GroupData);
        pendingGroupFetch.delete(groupJid);
        return dataObj;
    }).catch(err => {
        pendingGroupFetch.delete(groupJid);
        throw err;
    });
    pendingGroupFetch.set(groupJid, fetchPromise as Promise<Record<string, unknown>>);
    return fetchPromise;
}
export function invalidateGroupCache(groupJid: string): void {
    groupMetadataCache.delete(groupJid);
}
