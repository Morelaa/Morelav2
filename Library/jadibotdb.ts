import { kvGet, kvSet } from '../Database/kvstore.js'

declare global {

    var __jadibotCache__: Set<string> | null
}

const STORE = 'jadibot'
const KEY   = 'list'

if (!globalThis.__jadibotCache__) globalThis.__jadibotCache__ = null

function loadCache(): Set<string> {
    if (globalThis.__jadibotCache__) return globalThis.__jadibotCache__
    try {
        const list = kvGet<unknown[]>(STORE, KEY, [])
        globalThis.__jadibotCache__ = new Set(Array.isArray(list) ? list.map(String) : [])
    } catch {
        globalThis.__jadibotCache__ = new Set()
    }
    return globalThis.__jadibotCache__ as Set<string>
}

function _writeFile(cache: Set<string>): void {
    try {
        kvSet(STORE, KEY, [...cache])
    } catch (e) {
        const err = e as Error
        console.error('[JADIBOTDB] Gagal simpan ke DB:', err.message)
    }
}

export function isJadibot(nomor: unknown): boolean {
    if (!nomor) return false
    return loadCache().has(String(nomor).replace(/[^0-9]/g, ''))
}

export function hasAnyJadibot(): boolean {
    return loadCache().size > 0
}

export function listJadibot(): string[] {
    return [...loadCache()]
}

export function addJadibot(nomor: unknown): void {
    if (!nomor) return
    const clean = String(nomor).replace(/[^0-9]/g, '')
    if (!clean) return
    const cache = loadCache()
    cache.add(clean)
    _writeFile(cache)
}

export function removeJadibot(nomor: unknown): void {
    if (!nomor) return
    const clean = String(nomor).replace(/[^0-9]/g, '')
    const cache = loadCache()
    cache.delete(clean)
    _writeFile(cache)
    globalThis.__jadibotCache__ = null
    loadCache()
}

export function clearAllJadibot(): void {
    globalThis.__jadibotCache__ = new Set()
    _writeFile(globalThis.__jadibotCache__)
}

export function reloadJadibotCache(): void {
    globalThis.__jadibotCache__ = null
    loadCache()
}

export function syncWithSessions(sessions: unknown): void {
    if (!(sessions instanceof Map)) return
    const cache = loadCache()
    let changed = false
    for (const nomor of [...cache]) {
        if (!(sessions as Map<string, unknown>).has(nomor)) {
            cache.delete(nomor)
            changed = true
            console.log(`[JADIBOTDB] Hapus stale entry: ${nomor}`)
        }
    }
    if (changed) {
        _writeFile(cache)
        globalThis.__jadibotCache__ = cache
    }
}

loadCache()
