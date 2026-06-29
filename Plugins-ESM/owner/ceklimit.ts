import {
  getUsage, resetLimit, getAllUsage, clearAllLimits,
  getDailyLimit, setDailyLimit
} from '../../Database/usagelimit.js'
import { botName } from '../../Library/utils.js'
import { resolveTarget as resolveTargetUser, resolveDisplayName } from '../../Library/resolve.js'

function fmtReset(limitHitAt: number): string {
  const sisa  = (limitHitAt + 86400000) - Date.now()
  const jam   = Math.floor(sisa / 3600000)
  const menit = Math.floor((sisa % 3600000) / 60000)
  return `${jam}j ${menit}m lagi`
}

function progressBar(used: number, max: number, len = 14): string {
  const fill  = Math.round((used / max) * len)
  const empty = len - fill
  return '█'.repeat(Math.max(0, fill)) + '░'.repeat(Math.max(0, empty))
}

const handler = async (m: any, { Morela, args, command, isOwn, isAdmin, senderJid: senderJidParam, fkontak }: any) => {

  const { AIRich } = await import('../../Library/MessageBuilder.js?v=' + Date.now())

  const isPrivileged = isOwn || isAdmin
  const LIMIT        = getDailyLimit()
  const rich         = () => new AIRich(Morela)

  // ── setlimit ──────────────────────────────────────────────────────────────
  if (command === 'setlimit') {
    if (!isOwn) return rich()
      .setTitle('🔒 Akses Ditolak')
      .addText('Perintah ini hanya bisa digunakan oleh *Owner*.')
      .send(m.chat)

    const num = parseInt(args[0])
    if (!args[0] || isNaN(num) || num < 1 || num > 9999) return rich()
      .setTitle('⚙️ Set Limit Harian')
      .addTable([
        ['Penggunaan',    'Contoh'],
        ['.setlimit 20',  'Set 20x / hari'],
        ['.setlimit 50',  'Set 50x / hari'],
        ['.setlimit 999', 'Set 999x / hari'],
      ])
      .addText('⚠️ Range yang valid: *1 – 9999*')
      .send(m.chat)

    const before = getDailyLimit()
    setDailyLimit(num)

    return rich()
      .setTitle('✅ Limit Harian Diperbarui')
      .addTable([
        ['Field',    'Value'],
        ['Sebelum',  `${before}x / hari`],
        ['Sekarang', `${num}x / hari`],
        ['Simpan',   'morela.db ✅'],
      ])
      .addTip('💡 Limit baru berlaku untuk semua user.')
      .send(m.chat)
  }

  // ── resetlimitall ─────────────────────────────────────────────────────────
  if (command === 'resetlimitall') {
    if (!isOwn) return rich()
      .setTitle('🔒 Akses Ditolak')
      .addText('Perintah ini hanya bisa digunakan oleh *Owner*.')
      .send(m.chat)

    const allData = getAllUsage()
    const total   = Object.keys(allData).length

    if (!total) return rich()
      .setTitle('🔄 Reset Semua Limit')
      .addText('📭 Tidak ada data limit untuk direset.')
      .send(m.chat)

    clearAllLimits()

    return rich()
      .setTitle('✅ Reset Semua Limit')
      .addTable([
        ['Field',       'Value'],
        ['Total User',  `${total} user`],
        ['Status',      'Semua limit direset ✅'],
        ['Limit Aktif', `${getDailyLimit()}x / hari`],
      ])
      .addText('Semua limit user telah dikosongkan.')
      .send(m.chat)
  }

  // ── resetlimit ────────────────────────────────────────────────────────────
  if (command === 'resetlimit') {
    if (!isOwn) return rich()
      .setTitle('🔒 Akses Ditolak')
      .addText('Perintah ini hanya bisa digunakan oleh *Owner*.')
      .send(m.chat)

    const targetJid = resolveTargetUser(m, args).jid
    if (!targetJid) return rich()
      .setTitle('🔄 Reset Limit User')
      .addTable([
        ['Cara Pakai',             'Keterangan'],
        ['Reply + .resetlimit',    'Reset limit pengirim'],
        ['.resetlimit @mention',   'Reset via mention'],
        ['.resetlimit 628xxx',     'Reset via nomor'],
      ])
      .addText('Sebutkan target yang ingin direset limitnya.')
      .send(m.chat)

    const nama     = await resolveDisplayName(Morela, m, targetJid)
    const berhasil = resetLimit(targetJid)

    return rich()
      .setTitle(berhasil ? '✅ Limit Direset' : '❌ Gagal Reset')
      .addTable([
        ['Field',  'Value'],
        ['Nama',   nama],
        ['Status', berhasil ? 'Berhasil ✅' : 'User tidak ditemukan ❌'],
        ...(berhasil ? [['Limit Baru', `${getDailyLimit()}x / hari`]] : []),
      ])
      .send(m.chat)
  }

  // ── ceklimit list ─────────────────────────────────────────────────────────
  if (args[0] === 'list' || args[0] === 'listall') {
    if (!isOwn) return rich()
      .setTitle('🔒 Akses Ditolak')
      .addText('Perintah ini hanya bisa digunakan oleh *Owner*.')
      .send(m.chat)

    const allData = getAllUsage()
    const entries = Object.entries(allData)

    if (!entries.length) return rich()
      .setTitle('📋 List Limit User')
      .addText('📭 Belum ada data limit user sama sekali.')
      .send(m.chat)

    const now   = Date.now()
    const habis: any[] = []
    const aktif: any[] = []

    for (const [jid, data] of entries) {
      const count      = (data as any).count || 0
      const limitHitAt = (data as any).limitHitAt || null
      const nama       = await resolveDisplayName(Morela, m, jid)
      const sudahReset = limitHitAt && (now - limitHitAt) >= 86400000

      if (limitHitAt && !sudahReset) {
        habis.push({ nama, count, reset: fmtReset(limitHitAt) })
      } else if (count > 0) {
        aktif.push({ nama, count, sisa: Math.max(0, LIMIT - count) })
      }
    }

    habis.sort((a: any, b: any) => b.count - a.count)
    aktif.sort((a: any, b: any) => b.count - a.count)

    const r = rich().setTitle('📋 List Limit User')

    r.addTable([
      ['Field',       'Value'],
      ['Total Data',  `${entries.length} user`],
      ['Limit Aktif', `${LIMIT}x / hari`],
      ['Habis Limit', `${habis.length} user 🔴`],
      ['Ada Sisa',    `${aktif.length} user 🟡`],
    ])

    if (habis.length) {
      r.addText('🔴 *User Habis Limit*')
      r.addTable([
        ['Nama', 'Pakai', 'Reset'],
        ...habis.slice(0, 15).map((u: any) => [u.nama, `${u.count}/${LIMIT}x`, u.reset]),
        ...(habis.length > 15 ? [[`+${habis.length - 15} lainnya`, '', '']] : []),
      ])
    }

    if (aktif.length) {
      r.addText('🟡 *User Masih Ada Sisa*')
      r.addTable([
        ['Nama', 'Pakai', 'Sisa'],
        ...aktif.slice(0, 15).map((u: any) => [u.nama, `${u.count}/${LIMIT}x`, `${u.sisa}x`]),
        ...(aktif.length > 15 ? [[`+${aktif.length - 15} lainnya`, '', '']] : []),
      ])
    }

    r.addTip('💡 .setlimit <n> ubah limit | .resetlimit reset per user')
    return r.send(m.chat)
  }

  // ── ceklimit (self / target) ───────────────────────────────────────────────
  let resolvedJid = senderJidParam || m.sender || m.key?.participant || m.key?.remoteJid

  if (isPrivileged) {
    const { jid: t } = resolveTargetUser(m, args)
    if (t) resolvedJid = t
  }

  const usage      = getUsage(resolvedJid)
  const nama       = await resolveDisplayName(Morela, m, resolvedJid)
  const sudahHabis = usage.count >= LIMIT && !!usage.limitHitAt
  const isSelf     = resolvedJid === (senderJidParam || m.sender)
  const bar        = progressBar(usage.count, LIMIT)
  const pct        = Math.round((usage.count / LIMIT) * 100)

  const statusEmoji = sudahHabis
    ? '🔴 Habis'
    : usage.count >= LIMIT * 0.8
      ? '🟡 Hampir Habis'
      : '🟢 Masih Ada'

  const tableRows: string[][] = [
    ['Field',    'Value'],
    ['Nama',     nama],
    ...(isPrivileged && !isSelf ? [['Dicek Oleh', isOwn ? '👑 Owner' : '⚙️ Admin']] : []),
    ['Limit',    `${LIMIT}x / hari`],
    ['Terpakai', `${usage.count}x`],
    ['Sisa',     `${usage.sisa}x`],
    ['Persen',   `${pct}%`],
    ['Status',   statusEmoji],
    ...(sudahHabis ? [['Reset', fmtReset(usage.limitHitAt!)]] : []),
  ]

  const r = rich()
    .setTitle('📊 Cek Limit Harian')
    .addTable(tableRows)
    .addCode('text', `Progress: [${bar}] ${pct}%`)

  if (isOwn) {
    r.addText(
      '⚙️ *Owner Commands:*\n' +
      '• *.setlimit <n>* — ubah limit global\n' +
      '• *.resetlimit* — reset limit user\n' +
      '• *.resetlimitall* — reset semua user\n' +
      '• *.ceklimit list* — lihat semua user'
    )
  }

  return r.send(m.chat)
}

handler.command = ['ceklimit', 'limit', 'mylimit', 'setlimit', 'resetlimit', 'resetlimitall']
handler.noLimit = true
handler.tags    = ['info']
handler.help    = [
  'ceklimit',
  'ceklimit list',
  'setlimit <angka>',
  'resetlimit [nomor/reply/mention]',
  'resetlimitall',
]

export default handler