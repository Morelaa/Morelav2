import axios   from 'axios'
import { logger } from './System/logger.js'
import { initTgGlobal } from './Library/tg_global.js'
import { tgApi, sendMsg, sendPhoto, answerCallback, getTgCfg } from './Plugins-tgbot/core/api.js'
import { isOwner, setStartTime, tgSetPendingPhoto } from './Plugins-tgbot/core/helpers.js'
import { tgPlugins } from './Plugins-tgbot/_pluginmanager.js'
import { buildMenuText } from './Plugins-tgbot/menu/menu.js'
import type { TgUpdate, TgCallbackQuery, TgContext } from './Plugins-tgbot/core/types.js'

let _offset        = 0
let _polling       = false
let _pollingTimer: ReturnType<typeof setTimeout> | null = null
let _lastNotifTime = 0
const NOTIF_COOLDOWN        = 60000
const AXIOS_POLLING_TIMEOUT = 30000

// ─── Handle callback_query ───────────────────────────────────────────────────
async function handleCallback(cb: TgCallbackQuery): Promise<void> {
  const cbFrom = cb.from?.id
  const cbChat = cb.message?.chat?.id!
  const cbData = cb.data || ''
  const msgId  = cb.message?.message_id
  const ctx: TgContext = { from: cbFrom, isOwner: isOwner(cbFrom), raw: { chat: { id: cbChat } } }

  await answerCallback(cb.id)

  // ── Callback publik (semua orang boleh) ──────────────────────────
  if (cbData === 'cb_menu') {
    await sendMsg(cbChat, buildMenuText(ctx.isOwner))
    return
  }
  if (cbData === 'cb_close') {
    await tgApi('editMessageReplyMarkup', { chat_id: cbChat, message_id: msgId, reply_markup: { inline_keyboard: [] } })
    return
  }

  // ── Callback menu HD (publik, dipicu dari foto polos) ──────────────
  if (cbData === 'cb_hd' || cbData === 'cb_hdv1') {
    await tgApi('editMessageReplyMarkup', { chat_id: cbChat, message_id: msgId, reply_markup: { inline_keyboard: [] } })
    const plugin = tgPlugins.get(cbData === 'cb_hd' ? 'hd' : 'hdv1')
    try { await plugin?.handler(cbChat, '', ctx) } catch (e) { await sendMsg(cbChat, '❌ Error: ' + (e as Error).message) }
    return
  }
  if (cbData === 'cb_hdv2') {
    await tgApi('editMessageReplyMarkup', { chat_id: cbChat, message_id: msgId, reply_markup: { inline_keyboard: [] } })
    const multKeyboard = {
      inline_keyboard: [[{ text: '2x', callback_data: 'cb_hdv2_2x' }, { text: '4x', callback_data: 'cb_hdv2_4x' }]]
    }
    await sendMsg(cbChat, '🔍 *Pilih tingkat upscale HD V2:*', { reply_markup: multKeyboard })
    return
  }
  if (cbData === 'cb_hdv2_2x' || cbData === 'cb_hdv2_4x') {
    await tgApi('editMessageReplyMarkup', { chat_id: cbChat, message_id: msgId, reply_markup: { inline_keyboard: [] } })
    const mult   = cbData === 'cb_hdv2_4x' ? '4x' : '2x'
    const plugin = tgPlugins.get('hdv2')
    try { await plugin?.handler(cbChat, mult, ctx) } catch (e) { await sendMsg(cbChat, '❌ Error: ' + (e as Error).message) }
    return
  }
  if (cbData === 'cb_removebg' || cbData === 'cb_removewm') {
    await tgApi('editMessageReplyMarkup', { chat_id: cbChat, message_id: msgId, reply_markup: { inline_keyboard: [] } })
    const plugin = tgPlugins.get(cbData === 'cb_removebg' ? 'removebg' : 'removewm')
    try { await plugin?.handler(cbChat, '', ctx) } catch (e) { await sendMsg(cbChat, '❌ Error: ' + (e as Error).message) }
    return
  }

  // ── Callback khusus owner ─────────────────────────────────────────
  if (!ctx.isOwner) return void sendMsg(cbChat, '⛔ Akses ditolak. Tombol ini khusus owner.')

  const OWNER_BTN: Record<string, string> = {
    cb_status: 'status', cb_restart: 'restart', cb_cc: 'cc',
    cb_on: 'on', cb_off: 'off', cb_listbot: 'listbot',
  }
  const plugin = OWNER_BTN[cbData] ? tgPlugins.get(OWNER_BTN[cbData]) : undefined
  if (plugin) { try { await plugin.handler(cbChat, '', ctx) } catch (e) { await sendMsg(cbChat, '❌ Error: ' + (e as Error).message) } }
}

// ─── Proses SATU update (dipanggil tanpa di-await di poll(), biar paralel) ──
async function processUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallback(update.callback_query)
    return
  }
  const msg = update.message
  if (!msg) return
  const chatId = msg.chat.id
  const from   = msg.from?.id
  const ctx: TgContext = { from, isOwner: isOwner(from), raw: msg }

  // ── Foto polos (tanpa caption command) → tampilkan menu HD ─────
  if (msg.photo && msg.photo.length > 0 && !(msg.caption?.trim() || '').startsWith('/')) {
    const best = msg.photo[msg.photo.length - 1]
    tgSetPendingPhoto(chatId, best.file_id)
    const hdMenuKeyboard = {
      inline_keyboard: [
        [{ text: 'HD', callback_data: 'cb_hd' }, { text: 'HDV1', callback_data: 'cb_hdv1' }, { text: 'HDV2', callback_data: 'cb_hdv2' }],
        [{ text: '🧼 Remove BG', callback_data: 'cb_removebg' }, { text: '🧹 Remove WM', callback_data: 'cb_removewm' }]
      ]
    }
    await sendMsg(chatId, '🖼️ *Foto diterima!*\n\nTingkatkan kualitas foto atau hapus wm dan background?', { reply_markup: hdMenuKeyboard })
    return
  }

  // Tentukan command dari text ATAU caption (untuk pesan foto)
  const _rawText = msg.text?.trim() || msg.caption?.trim() || ''
  const _rawCmd  = _rawText.split(' ')[0].toLowerCase().replace('/', '')
  const _plugin  = tgPlugins.get(_rawCmd)

  // Command image yang "buttonOnly" (hd/hdv1/hdv2/removebg/removewm) tetap dianggap
  // publik supaya orang lain TIDAK kena "Akses ditolak" — hanya dibatasi eksekusinya
  // lewat flag `buttonOnly` (cuma bisa dipicu tombol, bukan diketik).
  const isKnownPublicOrHidden = _plugin ? !_plugin.owner : (_rawCmd === '' || _rawCmd === 'start')
  if (!ctx.isOwner && !isKnownPublicOrHidden) {
    await sendMsg(chatId, '⛔ Akses ditolak.')
    return
  }

  // ── Handle foto dengan caption command ──────────────────────────
  if (msg.photo && msg.photo.length > 0) {
    const _cap    = msg.caption?.trim() || ''
    const _capCmd = _cap.split(' ')[0].toLowerCase().replace('/', '')
    if (_capCmd === 'aiedit') tgSetPendingPhoto(chatId, msg.photo[msg.photo.length - 1].file_id)
    const _capArgs = _cap.split(' ').slice(1).join(' ')
    const capPlugin = tgPlugins.get(_capCmd)
    if (capPlugin?.buttonOnly) {
      await sendMsg(chatId, '❌ Command tidak dikenal.\n\nSilahkan kirim foto saja tanpa command.')
    } else if (capPlugin) {
      try { await capPlugin.handler(chatId, _capArgs, ctx) } catch (e) { await sendMsg(chatId, '❌ Error: ' + (e as Error).message) }
    }
    return
  }

  if (!msg.text) return
  const text = msg.text?.trim() || ''
  if (!text) return

  const [cmd, ...argParts] = text.split(' ')
  const command = cmd.toLowerCase().replace('/', '')
  const args     = argParts.join(' ')

  // ── Kalau reply foto, inject ke pending photo ──────────────────
  if (command === 'aiedit' && msg.reply_to_message?.photo?.length) {
    tgSetPendingPhoto(chatId, msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1].file_id)
  }

  logger.system('tgbot', `Command: ${cmd} dari ${from}`)
  const plugin = tgPlugins.get(command)
  if (plugin?.buttonOnly) {
    await sendMsg(chatId, '❌ Command tidak dikenal.\n\nSilahkan kirim foto saja tanpa command.')
  } else if (plugin) {
    try { await plugin.handler(chatId, args, ctx) } catch (e) {
      await sendMsg(chatId, `❌ Error: ${(e as Error).message}`)
    }
  } else if (text.startsWith('/')) {
    await sendMsg(chatId, `❌ Command tidak dikenal: ${cmd}\n\nKetik /start untuk menu.`)
  }
}

async function poll(): Promise<void> {
  const { token, ownerId } = getTgCfg()
  if (!token || !ownerId) return
  try {
    const updates = await tgApi(
      'getUpdates',
      { offset: _offset, timeout: 12, limit: 10 },
      AXIOS_POLLING_TIMEOUT
    ) as TgUpdate[] | null
    if (!updates || !Array.isArray(updates)) return
    for (const update of updates) {
      _offset = update.update_id + 1
      // Tidak di-`await` di sini secara sengaja: supaya command dari user A yang
      // prosesnya lama (HD, download, dll) TIDAK memblokir command dari user B.
      // Tiap update diproses paralel, mirip event handler di bot WA.
      processUpdate(update).catch(e => {
        console.error('[TGBOT] processUpdate error:', (e as Error).message)
      })
    }
  } catch (e) {
    const err = e as Error & { code?: number }
    const msg = err.message ?? ''
    if (err.code === 409 || msg.includes('TGBOT_409_CONFLICT') || msg.includes('409')) {
      logger.warn('tgbot', '409 Conflict — instance lain masih polling. Tunggu 15s...')
      _polling = false
      await new Promise<void>(r => setTimeout(() => r(), 15000))
      startTgBot().catch(() => {})
      return
    }
    if (!msg.includes('timeout') && !msg.includes('ECONNRESET') && !msg.includes('ETIMEDOUT'))
      console.error('[TGBOT] Poll error:', msg)
  }
}

async function skipPendingUpdates(): Promise<void> {
  try {
    const updates = await tgApi('getUpdates', { offset: -1, limit: 1, timeout: 0 }, 10000) as TgUpdate[] | null
    if (updates && updates.length > 0) {
      _offset = updates[updates.length - 1].update_id + 1
      logger.system('tgbot', `Skip pending updates, offset → ${_offset}`)
    }
  } catch (e) { console.error('[TGBOT] skipPendingUpdates error:', (e as Error).message) }
}

export async function startTgBot(): Promise<void> {
  initTgGlobal()
  const { token, ownerId } = getTgCfg()
  if (!token) { logger.warn('tgbot', 'Token belum diset di tg_global.json'); return }
  await tgPlugins.loadAll()
  if (_polling) { tgNotifyWaOnline(); return }
  _polling = true
  setStartTime(Date.now())
  try { await tgApi('deleteWebhook', { drop_pending_updates: false }) } catch {}
  await skipPendingUpdates()
  logger.success('tgbot', 'Telegram Remote Control aktif')
  logger.system('tgbot', `Owner ID: ${ownerId || '(belum diset)'}`)
  tgNotifyWaOnline()
  const loop = async () => {
    while (_polling) {
      await poll()
      await new Promise<void>(r => setTimeout(() => r(), 500))
    }
  }
  loop().catch(e => console.error('[TGBOT] Loop error:', (e as Error).message))
}

export function tgNotifyWaOnline(): void {
  const { ownerId } = getTgCfg()
  if (!ownerId) return
  const now = Date.now()
  if (now - _lastNotifTime < NOTIF_COOLDOWN) { logger.system('tgbot', 'Notif WA Online di-skip (cooldown)'); return }
  _lastNotifTime = now
  sendMsg(ownerId,
    `✅ *Bot WA Online!*\n\n` +
    `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n` +
    `Ketik /start untuk menu.`
  ).catch(() => {})
}

export function stopTgBot(): void {
  _polling = false
  if (_pollingTimer) clearInterval(_pollingTimer)
  logger.warn('tgbot', 'Telegram bot dihentikan')
}

export async function tgNotify(text: string): Promise<unknown> {
  const { ownerId } = getTgCfg()
  if (!ownerId) return
  return sendMsg(ownerId, text)
}

export async function tgNotifyLogout(): Promise<void> {
  const { ownerId } = getTgCfg()
  if (!ownerId) return
  try {
    await sendMsg(ownerId,
      `🔴 *BOT WA LOGOUT!*\n\n` +
      `WhatsApp telah memutus sesi bot. Bot sengaja *dihentikan otomatis* ` +
      `dan TIDAK auto re-pair, supaya nomor tidak makin gampang kena ` +
      `pembatasan/spam-flag dari WhatsApp akibat pairing berulang dalam waktu berdekatan.\n\n` +
      `*Sebelum hapus session & pairing ulang:*\n` +
      `1. Cek dulu apakah akun WA kamu sedang kena pembatasan (notifikasi "Saat ini akun Anda dibatasi") di HP.\n` +
      `2. Kalau iya, tunggu beberapa jam/hari sampai pembatasan hilang dulu sebelum pairing ulang.\n` +
      `3. Kalau tidak ada pembatasan dan memang sesi biasa logout, baru hapus folder \`./session\` dan restart bot untuk scan ulang.\n\n` +
      `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
    )
  } catch {}
}

export default { startTgBot, stopTgBot, tgNotify, tgNotifyWaOnline, tgNotifyLogout }
