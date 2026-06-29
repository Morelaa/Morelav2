import { kvGet, kvSet } from '../Database/kvstore.js'

const STORE = 'privatemode'
const KEY   = 'enabled'

type PrivateModeData = { enabled: boolean }

function loadData(): PrivateModeData {
  try {
    const enabled = kvGet<boolean | null>(STORE, KEY, null)
    if (enabled === null) {
      kvSet(STORE, KEY, true)
      return { enabled: true }
    }
    return { enabled }
  } catch {
    return { enabled: true }
  }
}

function saveData(data: PrivateModeData): void {
  try {
    kvSet(STORE, KEY, data.enabled)
  } catch (e) {
    const err = e as Error
    console.error('[PrivateMode] Gagal simpan data:', err.message)
  }
}

export function isPrivateMode(): boolean {
  const data = loadData()
  return data.enabled === true
}

export function setPrivateMode(value: boolean): boolean {
  const data = loadData()
  data.enabled = Boolean(value)
  saveData(data)

  globalThis.__privateModeOn__ = data.enabled
  return data.enabled
}

const _initData = loadData()
globalThis.__privateModeOn__ = _initData.enabled
