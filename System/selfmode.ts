import { getGroup, updateGroup, getAllGroups } from '../Database/db.js'
import { kvGet, kvSet } from '../Database/kvstore.js'

const STORE = 'selfmode_global'
const KEY   = 'active'

function readGlobal(): { active: boolean } {
  return { active: kvGet<boolean>(STORE, KEY, false) }
}

function writeGlobal(active: boolean): void {
  try { kvSet(STORE, KEY, active) } catch {}
}

/**
 * Cek apakah grup ini dalam self mode.
 * Logic:
 *  - Jika global OFF → cek flag selfmode per-grup
 *  - Jika global ON  → self mode aktif KECUALI grup yang eksplisit di-set selfmode=false
 *    (dikecualikan via .selfstatus toggle)
 */
export function isSelfMode(groupJid: string): boolean {
  if (!groupJid) return false
  const groupData = getGroup(groupJid)
  if (isSelfModeGlobal()) {
    // Jika global aktif, cek apakah grup ini dikecualikan (selfmode === false secara eksplisit)
    if (groupData && groupData.selfmode === false) return false
    return true
  }
  return groupData?.selfmode ?? false
}

export function setSelfMode(groupJid: string, value: boolean): boolean {
  if (!groupJid) return false
  updateGroup(groupJid, { selfmode: Boolean(value) })
  return Boolean(value)
}

export function isSelfModeGlobal(): boolean {
  return readGlobal().active
}

/**
 * Set global self mode ON/OFF.
 * Jika applyToAll = true → update flag selfmode semua grup sesuai value.
 * Jika value = false dan applyToAll = true → reset semua grup ke public (hapus pengecualian).
 */
export function setSelfModeGlobal(value: boolean, applyToAll = true): number {
  writeGlobal(value)
  if (!applyToAll) return 0
  const groups = getAllGroups()
  let count = 0
  for (const jid of Object.keys(groups)) {
    // Saat aktifkan global: set semua true (clear pengecualian)
    // Saat matikan global:  set semua false (public)
    updateGroup(jid, { selfmode: value })
    count++
  }
  return count
}

export const isAllowedWhenSelf = (): true => true
