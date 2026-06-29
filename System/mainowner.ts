import { kvGet, kvSet } from '../Database/kvstore.js'
import { getPhoneByLid } from '../Database/db.js'

const STORE = 'mainowner'
const KEY   = 'number'

let _cache:     string | null = null
let _cacheTime: number        = 0
const TTL = 60 * 1000 

function _load(): string {
  const now = Date.now()
  if (_cache !== null && (now - _cacheTime) < TTL) return _cache
  try {
    // Prioritas utama: selalu baca dari config.ts (global.mainOwner)
    const fromConfig = (global.mainOwner ?? '').replace(/[^0-9]/g, '')
    if (fromConfig) {
      _cache = fromConfig
      _save(fromConfig) // sinkron ke DB agar konsisten
    } else {
      // Fallback ke DB kalau config.ts kosong (misal pas jadibot / sub-instance)
      const saved = kvGet<string>(STORE, KEY, '')
      _cache = saved ? saved.replace(/[^0-9]/g, '') : ''
    }
  } catch {
    _cache = (global.mainOwner ?? '').replace(/[^0-9]/g, '')
  }
  _cacheTime = now
  return _cache
}

function _save(nomor: string): void {
  try {
    kvSet(STORE, KEY, nomor)
  } catch (e) {
    const err = e as Error
    console.error('[MAINOWNER] Gagal simpan:', err.message)
  }
}

export function getMainOwner(): string {
  return _load()
}

export function isMainOwner(nomor: string): boolean {
  if (!nomor) return false
  const mo = _load()
  return !!mo && nomor.replace(/[^0-9]/g, '') === mo
}

export function setMainOwner(nomor: string): void {
  const clean = nomor.replace(/[^0-9]/g, '')
  if (!clean) return
  _cache     = clean
  _cacheTime = Date.now()
  global.mainOwner = clean
  _save(clean)
}

export function reloadMainOwnerCache(): void {
  _cache     = null
  _cacheTime = 0
  _load()
}

_load()

export function isMainOwnerFromMsg(m: any): boolean {
  const raw = m.sender || m.key?.participant || m.key?.remoteJid || ''
  let num   = raw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
  if (raw.endsWith('@lid')) {
    const resolved = getPhoneByLid(num)
    if (resolved) num = resolved.replace(/[^0-9]/g, '')
  }
  return isMainOwner(num)
}
