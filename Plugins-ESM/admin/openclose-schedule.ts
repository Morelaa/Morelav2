import { bi, botName, imagePath } from '../../Library/utils.js'
import { isLidJid, resolveLidToPhone, normNum } from '../../Library/resolve.js'
import { kvGetAll, kvSetAll, kvClearStore } from '../../Database/kvstore.js'

const STORE = 'gc_schedule'
const TZ    = 'Asia/Jakarta'

interface GcSchedule {
  groupId:   string
  action:    'open' | 'close'
  hour:      number
  minute:    number
  timeStr:   string
  targetTs:  number
  dateLabel: string
  setBy:     string
}

interface GroupSchedule {
  open?:  GcSchedule
  close?: GcSchedule
}

type ScheduleStore = Record<string, GroupSchedule>

let _store:       ScheduleStore                              = {}
let _timers:      Map<string, ReturnType<typeof setTimeout>> = new Map()
let _sock:        any                                        = null
let _initialized: boolean                                    = false

function timerKey(groupId: string, action: 'open' | 'close'): string {
  return `${groupId}:${action}`
}

function loadStore(): void {
  try {
    _store = kvGetAll<GroupSchedule>(STORE)
  } catch {
    _store = {}
  }
}

function saveStore(): void {
  try {
    kvClearStore(STORE)
    kvSetAll(STORE, _store)
  } catch (e) {
    console.error('[GC SCHEDULE] ❌ Gagal simpan jadwal ke DB:', (e as Error).message)
  }
}

function parseTime(str: string): { hour: number; minute: number } | null {
  const m = str.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hour   = parseInt(m[1])
  const minute = parseInt(m[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

function nextTargetTs(hour: number, minute: number): number {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000  
  const nowUtc        = Date.now()
  const nowWib        = nowUtc + WIB_OFFSET_MS

  const todayMidnightWib = nowWib - (nowWib % 86_400_000)
  let   targetWib        = todayMidnightWib + (hour * 3600 + minute * 60) * 1000

  if (targetWib <= nowWib) targetWib += 86_400_000

  return targetWib - WIB_OFFSET_MS
}

function dateLabel(ts: number): string {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ
  })
}

function timeUntil(ts: number): string {
  const diff  = ts - Date.now()
  if (diff <= 0) return 'sekarang'
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const remM  = mins % 60
  if (hours > 0) return `${hours} jam ${remM} menit`
  return `${mins} menit`
}

function cancelSingleTimer(groupId: string, action: 'open' | 'close'): void {
  const key = timerKey(groupId, action)
  const t   = _timers.get(key)
  if (t) { clearTimeout(t); _timers.delete(key) }
}

function cancelAllTimers(groupId: string): void {
  cancelSingleTimer(groupId, 'open')
  cancelSingleTimer(groupId, 'close')
}

async function executeSchedule(sched: GcSchedule): Promise<void> {
  const { groupId, action, hour, minute } = sched

  const MAX_RETRY    = 3
  const RETRY_GAP_MS = 30_000   
  const RETRY_DELAY  = 30 * 60_000  

  let success = false

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const setting = action === 'open' ? 'not_announcement' : 'announcement'
      await _sock.groupSettingUpdate(groupId, setting)

      const label = action === 'open' ? '🔓 *Grup Dibuka!*' : '🔒 *Grup Ditutup!*'
      await _sock.sendMessage(groupId, {
        text: `${label}\n\nSesuai jadwal otomatis harian.`
      })

      success = true
      console.log(`[GC SCHEDULE] ${action.toUpperCase()} ${groupId} berhasil (attempt ${attempt}/${MAX_RETRY})`)
      break

    } catch (e) {
      const errMsg = (e as Error).message || 'unknown error'
      console.error(`[GC SCHEDULE] Gagal execute ${groupId} attempt ${attempt}/${MAX_RETRY}:`, errMsg)

      if (attempt < MAX_RETRY) {
        console.log(`[GC SCHEDULE] Retry dalam ${RETRY_GAP_MS / 1000}s...`)
        await new Promise(res => setTimeout(res, RETRY_GAP_MS))
      }
    }
  }

  let newTargetTs: number
  let newDateLabel: string

  if (success) {
    newTargetTs  = nextTargetTs(hour, minute)
    newDateLabel = dateLabel(newTargetTs)
    console.log(`[GC SCHEDULE] ${action.toUpperCase()} ${groupId} → jadwal ulang: ${newDateLabel} ${sched.timeStr}`)
  } else {
    // Cek dulu apakah bot masih ada di grup — kalau tidak, hapus jadwal
    // dari DB daripada reschedule terus selamanya jadi jadwal hantu.
    let botStillInGroup = true
    try {
      const joined = await _sock.groupFetchAllParticipating()
      botStillInGroup = groupId in joined
    } catch { /* gagal cek, asumsikan masih ada */ }

    if (!botStillInGroup) {
      console.warn(`[GC SCHEDULE] ${action.toUpperCase()} ${groupId} — bot tidak ada di grup, jadwal dihapus permanen`)
      cancelAllTimers(groupId)
      delete _store[groupId]
      saveStore()
      return
    }

    newTargetTs  = Date.now() + RETRY_DELAY
    newDateLabel = dateLabel(newTargetTs)
    console.warn(`[GC SCHEDULE] ${action.toUpperCase()} ${groupId} GAGAL semua retry → coba ulang ${newDateLabel} (30 menit lagi)`)

    try {
      await _sock.sendMessage(groupId, {
        text: `⚠️ *Jadwal ${action === 'open' ? 'Buka' : 'Tutup'} GC Gagal!*\n\nGagal setelah ${MAX_RETRY}x percobaan.\nBot akan coba lagi dalam 30 menit.\n\nPastikan bot masih jadi admin grup.`
      })
    } catch {}
  }

  const updatedSched: GcSchedule = {
    ...sched,
    targetTs:  newTargetTs,
    dateLabel: newDateLabel,
  }

  if (!_store[groupId]) _store[groupId] = {}
  _store[groupId][action] = updatedSched
  saveStore()

  armTimer(updatedSched)
}

function armTimer(sched: GcSchedule): void {
  cancelSingleTimer(sched.groupId, sched.action)

  const delay = Math.max(0, sched.targetTs - Date.now())
  const key   = timerKey(sched.groupId, sched.action)
  const t     = setTimeout(() => executeSchedule(sched), delay)
  _timers.set(key, t)
}

export function initGcScheduler(sock: any): void {
  _sock = sock
  _doInit()
}

async function _doInit(): Promise<void> {
  if (_initialized) return
  _initialized = true

  loadStore()

  // Fetch daftar grup yang bot masih aktif di dalamnya.
  // Kalau ada groupId di DB tapi bot sudah tidak ada di sana
  // (keluar, dikick, ganti nomor, grup bubar) → hapus dari DB supaya
  // tidak ada jadwal hantu yang terus di-reschedule selamanya.
  let activeGroups: Set<string> = new Set()
  try {
    const joined = await _sock.groupFetchAllParticipating()
    activeGroups = new Set(Object.keys(joined))
  } catch (e) {
    // Kalau gagal fetch (koneksi belum stabil saat init), lanjut tanpa
    // validasi — lebih baik biarkan jadwal jalan daripada hapus semua.
    console.warn('[GC SCHEDULE] Gagal fetch grup aktif saat init, skip validasi:', (e as Error).message)
  }

  const now     = Date.now()
  const WAIT_MS = 15_000
  let armed = 0, expired = 0, cleaned = 0

  for (const [gid, groupSched] of Object.entries(_store)) {
    // Bot sudah tidak ada di grup ini → buang dari DB
    if (activeGroups.size > 0 && !activeGroups.has(gid)) {
      cancelAllTimers(gid)
      delete _store[gid]
      cleaned++
      console.log(`[GC SCHEDULE] Hapus jadwal grup ${gid} — bot tidak ada di grup ini`)
      continue
    }

    for (const action of ['open', 'close'] as const) {
      const sched = groupSched[action]
      if (!sched) continue

      if (sched.targetTs > now) {
        armTimer(sched)
        armed++
      } else {
        expired++;
        ((s: GcSchedule) => {
          console.log(`[GC SCHEDULE] ${s.action.toUpperCase()} ${s.groupId} terlewat → eksekusi dalam ${WAIT_MS / 1000}s`)
          setTimeout(() => executeSchedule(s), WAIT_MS)
        })(sched)
      }
    }
  }

  if (cleaned > 0) saveStore()

  console.log(`[GC SCHEDULE] Init: ${armed} jadwal aktif, ${expired} terlewat, ${cleaned} grup dibersihkan (eksekusi dalam ${WAIT_MS/1000}s)`)
}

const handler = async (m: any, { Morela, command, text, reply, isAdmin, isOwn, botAdmin, fkontak, senderJid }: any) => {
  if (!m.isGroup) return reply('❌ Command ini hanya bisa dipakai di dalam grup!')

  if (!isAdmin && !isOwn) return reply('❌ Kamu harus jadi admin untuk menggunakan command ini!')

  if (!_sock) {
    _sock = Morela
    _doInit()
  }

  const groupId   = m.chat

  const _rawJid   = senderJid || m.sender || ''
  const senderNum = isLidJid(_rawJid) ? (resolveLidToPhone(_rawJid) || normNum(_rawJid)) : normNum(_rawJid)

  const send = (txt: string) =>
    Morela.sendMessage(groupId, { text: txt }, { quoted: fkontak || m })

  if (!_store[groupId]) _store[groupId] = {}
  const groupSched = _store[groupId]

  if (command === 'listgc' || command === 'jadwalgc') {
    const hasOpen  = !!groupSched.open
    const hasClose = !!groupSched.close

    if (!hasOpen && !hasClose) {
      return send(
        `📋 *Jadwal GC*\n\n` +
        `📭 Tidak ada jadwal aktif di grup ini.\n\n` +
        `Set jadwal:\n` +
        `.opengc 06:00\n` +
        `.closegc 22:00`
      )
    }

    let msg = `📋 *Jadwal Otomatis Harian*\n\n`

    if (hasClose) {
      const s = groupSched.close!
      msg += `🔒 *TUTUP GC*\n`
      msg += `   🕐 Waktu      : ${s.timeStr} WIB\n`
      msg += `   📅 Berikutnya : ${s.dateLabel}\n`
      msg += `   ⏳ Dalam      : ${timeUntil(s.targetTs)}\n`
      msg += `   👤 Diset oleh : +${s.setBy}\n\n`
    }

    if (hasOpen) {
      const s = groupSched.open!
      msg += `🔓 *BUKA GC*\n`
      msg += `   🕐 Waktu      : ${s.timeStr} WIB\n`
      msg += `   📅 Berikutnya : ${s.dateLabel}\n`
      msg += `   ⏳ Dalam      : ${timeUntil(s.targetTs)}\n`
      msg += `   👤 Diset oleh : +${s.setBy}\n\n`
    }

    msg += `_♻️ Jadwal diulang otomatis setiap hari._`
    return send(msg)
  }

  if (command === 'cancelgc' || command === 'canceljadwal') {
    const hasOpen  = !!groupSched.open
    const hasClose = !!groupSched.close

    if (!hasOpen && !hasClose) {
      return send(`⚠️ Tidak ada jadwal aktif di grup ini.`)
    }

    const arg = (text ?? '').trim().toLowerCase()

    if (arg === 'open') {
      if (!hasOpen) return send(`⚠️ Tidak ada jadwal BUKA aktif di grup ini.`)
      cancelSingleTimer(groupId, 'open')
      delete groupSched.open
      saveStore()
      return send(`🗑️ *Jadwal BUKA GC Dibatalkan!*\n\nJadwal buka otomatis telah dihapus.\n${hasClose ? `Jadwal tutup ${groupSched.close?.timeStr} WIB tetap berjalan.` : ''}`)
    }

    if (arg === 'close') {
      if (!hasClose) return send(`⚠️ Tidak ada jadwal TUTUP aktif di grup ini.`)
      cancelSingleTimer(groupId, 'close')
      delete groupSched.close
      saveStore()
      return send(`🗑️ *Jadwal TUTUP GC Dibatalkan!*\n\nJadwal tutup otomatis telah dihapus.\n${hasOpen ? `Jadwal buka ${groupSched.open?.timeStr} WIB tetap berjalan.` : ''}`)
    }

    const closeTime = groupSched.close?.timeStr ?? ''
    const openTime  = groupSched.open?.timeStr  ?? ''
    cancelAllTimers(groupId)
    delete _store[groupId]
    saveStore()

    return send(
      `🗑️ *Semua Jadwal Dibatalkan!*\n\n` +
      (hasClose ? `❌ Jadwal tutup ${closeTime} WIB dihapus\n` : '') +
      (hasOpen  ? `❌ Jadwal buka ${openTime} WIB dihapus\n`  : '') +
      `\nGrup tidak lagi buka/tutup otomatis.`
    )
  }

  if (!['opengc', 'closegc'].includes(command)) return

  if (!text) {
    const hasOpen  = !!groupSched.open
    const hasClose = !!groupSched.close
    let aktif = ''
    if (hasClose) aktif += `\n   🔒 Tutup : ${groupSched.close!.timeStr} WIB`
    if (hasOpen)  aktif += `\n   🔓 Buka  : ${groupSched.open!.timeStr} WIB`

    return send(
      `⏰ *Jadwal Otomatis Buka/Tutup GC*\n\n` +
      `📌 Format:\n` +
      `┌──────────────────────────────\n` +
      `│ .opengc  06:00\n` +
      `│ .closegc 22:00\n` +
      `└──────────────────────────────\n` +
      `Kedua command bisa diset sekaligus!\n\n` +
      `📋 Cek jadwal       : .listgc\n` +
      `🗑️ Batalkan semua   : .cancelgc\n` +
      `🗑️ Batalkan buka    : .cancelgc open\n` +
      `🗑️ Batalkan tutup   : .cancelgc close` +
      (aktif ? `\n\n📌 *Jadwal Aktif:*${aktif}` : '')
    )
  }

  const parsed = parseTime(text)
  if (!parsed) {
    return send(`❌ *Format waktu salah!*\n\nGunakan format HH:MM\nContoh: .${command} *22:00*`)
  }

  const action: 'open' | 'close' = command === 'opengc' ? 'open' : 'close'
  const { hour, minute } = parsed
  const targetTs  = nextTargetTs(hour, minute)
  const timeStr   = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const dLabel    = dateLabel(targetTs)
  const icon      = action === 'open' ? '🔓' : '🔒'
  const label     = action === 'open' ? 'BUKA GC' : 'TUTUP GC'

  const sched: GcSchedule = {
    groupId,
    action,
    hour,
    minute,
    timeStr,
    targetTs,
    dateLabel: dLabel,
    setBy:     senderNum,
  }

  _store[groupId][action] = sched
  saveStore()
  armTimer(sched)

  const pairAction = action === 'open' ? 'close' : 'open'
  const pairSched  = _store[groupId][pairAction]
  const pairIcon   = pairAction === 'open' ? '🔓' : '🔒'
  const pairLabel  = pairAction === 'open' ? 'buka' : 'tutup'

  let msg =
    `\n⏰ *Jadwal ${label} (Harian)*\n\n` +
    `${icon} Aksi   : ${action.toUpperCase()}\n` +
    `🕐 Waktu  : ${timeStr} WIB\n` +
    `📅 Mulai  : ${dLabel}\n` +
    `⏳ Dalam  : ${timeUntil(targetTs)}\n\n` +
    `♻️ Bot akan otomatis ${action === 'open' ? 'buka' : 'tutup'} grup *setiap hari* pukul *${timeStr} WIB.*`

  if (pairSched) {
    msg += `\n\n${pairIcon} Jadwal ${pairLabel}: *${pairSched.timeStr} WIB* juga aktif\n`
    msg += `_Kedua jadwal berjalan bersamaan setiap hari_ ✅`
  } else {
    msg += `\n\n💡 Belum ada jadwal ${pairLabel}, set juga:\n_.${pairAction === 'open' ? 'opengc' : 'closegc'} HH:MM_`
  }

  return send(msg)
}

handler.command  = ['opengc', 'closegc', 'listgc', 'jadwalgc', 'cancelgc', 'canceljadwal']
handler.group    = true
handler.admin    = true
handler.tags     = ['group']
handler.help     = ['opengc HH:MM', 'closegc HH:MM', 'listgc', 'cancelgc', 'cancelgc open', 'cancelgc close']
handler.noLimit  = true

export default handler

/**
 * Batalkan semua timer in-memory untuk satu grup.
 * Dipanggil dari utama.ts saat bot keluar/dikick dari grup,
 * setelah purgeGroupData sudah hapus data dari DB.
 */
export function cancelGroupSchedule(groupId: string): void {
  cancelAllTimers(groupId)
  delete _store[groupId]
  console.log(`[GC SCHEDULE] Timer in-memory grup ${groupId} dibatalkan (bot keluar)`)
}
