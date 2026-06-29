import axios   from 'axios'
import { logger } from './System/logger.js'
import fs      from 'fs'
import path    from 'path'
import os      from 'os'
import { fileURLToPath } from 'url'
import { getTgToken, getTgChatId, initTgGlobal } from './Library/tg_global.js'
import { getAllGroups } from './Database/db.js'

interface TgApiResult {
  result?: unknown
}

interface TgUpdate {
  update_id:      number
  message?:       TgMessage
  callback_query?: TgCallbackQuery
}

interface TgPhotoSize {
  file_id:   string
  file_size: number
}

interface TgMessage {
  chat:               { id: number }
  from?:              { id: number }
  text?:              string
  caption?:           string
  photo?:             TgPhotoSize[]
  message_id?:        number
  reply_to_message?:  TgMessage
}

interface TgCallbackQuery {
  id:       string
  from?:    { id: number }
  message?: { chat: { id: number }; message_id?: number }
  data?:    string
}

type CommandHandler = (chatId: number | string, args?: string) => Promise<void>

const __dirname = path.dirname(fileURLToPath(import.meta.url as string))


function getTgCfg() {
  const token   = getTgToken()
  const ownerId = getTgChatId()
  return { token, ownerId: String(ownerId) }
}

let _offset         = 0
let _polling        = false
let _pollingTimer: ReturnType<typeof setTimeout> | null = null
let _startTime      = Date.now()
let _lastNotifTime  = 0
const _pendingPhoto: Record<string, string> = {} // dipakai saat reply foto
const NOTIF_COOLDOWN = 60000

const AXIOS_DEFAULT_TIMEOUT  = 15000
const AXIOS_POLLING_TIMEOUT  = 30000

async function tgApi(
  method: string,
  params: Record<string, unknown> = {},
  axiosTimeout: number = AXIOS_DEFAULT_TIMEOUT
): Promise<unknown> {
  const { token } = getTgCfg()
  if (!token) return null
  try {
    const { data } = await axios.post<TgApiResult>(
      `https://api.telegram.org/bot${token}/${method}`,
      params,
      { timeout: axiosTimeout }
    )
    return data?.result ?? null
  } catch (e) {
    const msg        = (e as Error).message ?? ''
    const statusCode = (e as { response?: { status?: number } })?.response?.status ?? 0
    if (statusCode === 409) throw Object.assign(new Error('TGBOT_409_CONFLICT'), { code: 409 })
    const isSilent =
      method === 'getUpdates' &&
      (msg.includes('timeout') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') ||
       msg.includes('ENOTFOUND') || msg.includes('socket hang up') || msg.includes('network'))
    if (!isSilent) console.error(`[TGBOT] API error ${method}:`, msg)
    return null
  }
}

async function sendMsg(chatId: number | string, text: string, opts: Record<string, unknown> = {}): Promise<unknown> {
  return tgApi('sendMessage', {
    chat_id:    chatId,
    text:       text.slice(0, 4096),
    parse_mode: 'Markdown',
    ...opts
  })
}

async function sendPhoto(chatId: number | string, photoPath: string, caption: string, replyMarkup: unknown = null): Promise<unknown> {
  try {
    const FormData = (await import('form-data')).default
    const form     = new FormData()
    form.append('chat_id', String(chatId))
    form.append('caption', caption.slice(0, 1024))
    form.append('parse_mode', 'Markdown')
    if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup))
    if (photoPath.startsWith('http')) {
      form.append('photo', photoPath)
    } else {
      form.append('photo', fs.createReadStream(photoPath), { filename: 'menu.jpg' })
    }
    const { token } = getTgCfg()
    const { data }  = await axios.post<TgApiResult>(
      `https://api.telegram.org/bot${token}/sendPhoto`,
      form,
      { headers: form.getHeaders(), timeout: 30000 }
    )
    return data?.result ?? null
  } catch (e) {
    console.error('[TGBOT] sendPhoto error:', (e as Error).message)
    return null
  }
}

async function answerCallback(callbackQueryId: string, text: string = ''): Promise<unknown> {
  return tgApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
}

async function editMsg(chatId: number | string, messageId: number | undefined, text: string, replyMarkup: unknown = null): Promise<unknown> {
  return tgApi('editMessageText', {
    chat_id:    chatId,
    message_id: messageId,
    text:       text.slice(0, 4096),
    parse_mode: 'Markdown',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  })
}

function isOwner(from: number | undefined): boolean {
  const { ownerId } = getTgCfg()
  if (!ownerId) return false
  return String(from) === ownerId
}

function formatUptime(ms: number): string {
  const s   = Math.floor(ms / 1000)
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}j ${m}m ${sec}d`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// ── Shared helpers untuk image commands ─────────────────────────────────────
async function tgDownloadPhoto(fileId: string): Promise<Buffer> {
  const { token } = getTgCfg()
  const fileInfo  = await tgApi('getFile', { file_id: fileId }) as { file_path?: string }
  if (!fileInfo?.file_path) throw new Error('Gagal get file info dari Telegram')
  const res = await axios.get(`https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`, { responseType: 'arraybuffer', timeout: 30000 })
  return Buffer.from(res.data)
}

async function tgUploadToCDN(buf: Buffer): Promise<string> {
  // Coba ornzora dulu, fallback ke imgbb
  try {
    const form = new (await import('form-data')).default()
    form.append('file', buf, { filename: 'image.jpg', contentType: 'image/jpeg' })
    const res  = await axios.post('https://cdn.ornzora.eu.cc/upload', form, { headers: form.getHeaders(), timeout: 30000 })
    const url  = res.data?.url || res.data?.data?.url || res.data?.link || res.data?.data?.link
    if (url) return url as string
  } catch {}
  // Fallback imgbb
  const form2 = new (await import('form-data')).default()
  form2.append('image', buf.toString('base64'))
  const res2 = await axios.post(`https://api.imgbb.com/1/upload?key=${global.apiKeys.imgbb}`, form2, { headers: form2.getHeaders(), timeout: 30000 })
  const url2 = res2.data?.data?.url
  if (!url2) throw new Error('Upload CDN gagal')
  return url2 as string
}

async function tgSendPhoto(chatId: string | number, urlOrBuf: string | Buffer, caption: string = '') {
  const token = getTgToken()
  let buf: Buffer
  if (typeof urlOrBuf === 'string') {
    const res = await axios.get(urlOrBuf, { responseType: 'arraybuffer', timeout: 60000 })
    buf = Buffer.from(res.data)
  } else {
    buf = urlOrBuf
  }
  const FormData = (await import('form-data')).default
  const form = new FormData()
  form.append('chat_id', String(chatId))
  form.append('photo', buf, { filename: 'result.jpg', contentType: 'image/jpeg' })
  if (caption) form.append('caption', caption)
  form.append('parse_mode', 'Markdown')
  await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, { headers: form.getHeaders(), timeout: 60000 })
}

function tgGetPendingPhoto(chatId: string | number): string | null {
  return _pendingPhoto[String(chatId)] || null
}

function tgClearPendingPhoto(chatId: string | number) {
  delete _pendingPhoto[String(chatId)]
}


const commands: Record<string, CommandHandler> = {

  async start(chatId) {
    const menuPath = path.join(__dirname, 'media', 'menu.jpg')
    const mem      = process.memoryUsage()
    const sock     = globalThis.__sock__ as Record<string, unknown> | undefined
    const waUp     = (sock?.['user'] as Record<string, unknown>)?.['id'] ? '✅ Online' : '❌ Offline'
    const uptime   = formatUptime(Date.now() - _startTime)
    const caption  =
      `*╔══〔 🤖 MORELA BOT 〕══╗*\n` +
      `┃ WA Bot  : ${waUp}\n` +
      `┃ Uptime  : ${uptime}\n` +
      `┃ Node.js : ${process.version}\n` +
      `┃ RAM     : ${formatBytes(mem.heapUsed)}\n` +
      `*╚══════════════════╝*`
    const keyboard = {
      inline_keyboard: [
        [{ text: '📊 Status', callback_data: 'cb_status' }, { text: '🔄 Restart', callback_data: 'cb_restart' }],
        [{ text: '🧹 Clear Cache', callback_data: 'cb_cc' }, { text: '✅ Bot ON', callback_data: 'cb_on' }],
        [{ text: '❌ Bot OFF', callback_data: 'cb_off' }, { text: '🤖 Listbot', callback_data: 'cb_listbot' }],
        [{ text: '📋 Menu Lengkap', callback_data: 'cb_menu' }, { text: '❎ Tutup', callback_data: 'cb_close' }]
      ]
    }
    if (fs.existsSync(menuPath)) {
      await sendPhoto(chatId, menuPath, caption, keyboard)
    } else {
      await sendMsg(chatId, caption, { reply_markup: keyboard })
    }
  },

  async status(chatId) {
    const mem    = process.memoryUsage()
    const uptime = formatUptime(Date.now() - _startTime)
    const sock   = globalThis.__sock__ as Record<string, unknown> | undefined
    const waUp   = (sock?.['user'] as Record<string, unknown>)?.['id'] ? '✅ Online' : '❌ Offline'
    const jadibotCount = globalThis.jadibotSessions?.size ?? 0
    const jadibots = jadibotCount > 0
      ? [...(globalThis.jadibotSessions?.keys() ?? [])].map(n => `+${n}`).join(', ')
      : 'Tidak ada'
    await sendMsg(chatId,
      `📊 *STATUS BOT MORELA*\n\n` +
      `🤖 WA Bot    : ${waUp}\n` +
      `⏱️ Uptime    : ${uptime}\n` +
      `🔢 Node.js   : ${process.version}\n\n` +
      `💾 *Memory:*\n` +
      `├ Heap Used : ${formatBytes(mem.heapUsed)}\n` +
      `├ RSS       : ${formatBytes(mem.rss)}\n` +
      `└ Free RAM  : ${formatBytes(os.freemem())} / ${formatBytes(os.totalmem())}\n\n` +
      `🤖 *Jadibot:*\n` +
      `├ Aktif     : ${jadibotCount}\n` +
      `└ Nomor     : ${jadibots}`
    )
  },

  async restart(chatId) {
    await sendMsg(chatId, '🔄 *Merestart bot WA...*\n\n_Bot akan online lagi dalam beberapa detik._')
    logger.warn('tgbot', 'Restart diminta dari Telegram')
    setTimeout(() => process.kill(process.pid, 'SIGTERM'), 1500)
  },

  async cc(chatId) {
    await sendMsg(chatId, '🧹 *Membersihkan cache...*')
    try {
      const { clearAllCache } = await import('./Plugins-ESM/owner/clearcache.js') as { clearAllCache: () => Promise<{ filesDeleted: number; bytesFreed: number; duration: number; results: string[] }> }
      const result = await clearAllCache()
      await sendMsg(chatId,
        `✅ *Cache berhasil dibersihkan!*\n\n` +
        `🗑️ File dihapus : ${result.filesDeleted}\n` +
        `💾 Space freed  : ${formatBytes(result.bytesFreed)}\n` +
        `⏱️ Durasi       : ${result.duration}ms\n\n` +
        `_Detail:_\n` +
        result.results.map(r => `• ${r}`).join('\n')
      )
    } catch (e) {
      await sendMsg(chatId, `❌ Gagal: ${(e as Error).message}`)
    }
  },

  async on(chatId) {
    try {
      globalThis.__privateModeOn__ = false
      try { const { setPrivateMode } = await import('./System/privatemode.js') as { setPrivateMode: (v: boolean) => void }; setPrivateMode(false) } catch {}
      await sendMsg(chatId, '✅ *Bot WA aktif* — Semua orang bisa pakai fitur bot.')
    } catch (e) { await sendMsg(chatId, `❌ Gagal: ${(e as Error).message}`) }
  },

  async off(chatId) {
    try {
      globalThis.__privateModeOn__ = true
      try { const { setPrivateMode } = await import('./System/privatemode.js') as { setPrivateMode: (v: boolean) => void }; setPrivateMode(true) } catch {}
      await sendMsg(chatId, '❌ *Bot WA self mode* — Hanya owner yang bisa pakai.')
    } catch (e) { await sendMsg(chatId, `❌ Gagal: ${(e as Error).message}`) }
  },

  async listbot(chatId) {
    const sessions = globalThis.jadibotSessions
    if (!sessions || sessions.size === 0) return void sendMsg(chatId, 'ℹ️ Tidak ada jadibot yang aktif.')
    let teks = `🤖 *JADIBOT AKTIF (${sessions.size})*\n\n`
    let no   = 1
    for (const [nomor, session] of sessions) {
      const uptime = formatUptime(Date.now() - (session.startedAt ?? 0))
      teks += `${no++}. *+${nomor}*\n    ⏱️ Uptime: ${uptime}\n`
    }
    teks += `\nStop: /stopbot \\<nomor\\>`
    await sendMsg(chatId, teks)
  },

  async stopbot(chatId, args = '') {
    const nomor = args.replace(/[^0-9]/g, '')
    if (!nomor) return void sendMsg(chatId, '❌ Format: /stopbot 628xxxxxxxxxx')
    const sessions = globalThis.jadibotSessions
    if (!sessions?.has(nomor)) return void sendMsg(chatId, `⚠️ Jadibot *+${nomor}* tidak ditemukan.\nCek: /listbot`)
    try {
      await sessions.get(nomor)!.stop()
      await sendMsg(chatId, `✅ Jadibot *+${nomor}* berhasil dihentikan.`)
    } catch {
      sessions.delete(nomor)
      await sendMsg(chatId, `✅ Jadibot *+${nomor}* dihentikan (force).`)
    }
  },


  async resetlink(chatId, args = '') {
    const sock = globalThis.__sock__ as Record<string, unknown> | null
    if (!sock) return void sendMsg(chatId, '❌ WA Bot tidak terhubung')
    try {
      const groupsData = getAllGroups() as Record<string, { name?: string; subject?: string; participants?: Array<{ id: string; admin?: string }> }>
      const botNum     = ((sock['user'] as Record<string, string>)?.['id']?.split(':')[0] || '').replace(/[^0-9]/g, '')
      const adminGroups: Array<{ jid: string; name: string }> = []
      for (const [jid, meta] of Object.entries(groupsData)) {
        const botP = meta.participants?.find(p => p.id?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') === botNum)
        if (botP?.admin === 'admin' || botP?.admin === 'superadmin') adminGroups.push({ jid, name: meta.name || jid })
      }
      if (!adminGroups.length) return void sendMsg(chatId, `⚠️ *Bot bukan admin di grup manapun!*`)
      const target = args?.trim()
      if (target) {
        const idx   = parseInt(target) - 1
        const group = (!isNaN(idx) && idx >= 0 && idx < adminGroups.length) ? adminGroups[idx] : adminGroups.find(g => g.name.toLowerCase().includes(target.toLowerCase()))
        if (!group) return void sendMsg(chatId, `❌ Grup tidak ditemukan: *${target}*`)
        const revokeInvite = sock['groupRevokeInvite'] as (jid: string) => Promise<unknown>
        const sendWA       = sock['sendMessage'] as (jid: string, content: unknown) => Promise<unknown>
        await revokeInvite(group.jid)
        try { await sendWA(group.jid, { text: `🔄 *Link grup telah direset!*\n\n_Direset via Telegram Remote_` }) } catch {}
        return void sendMsg(chatId, `✅ *Link berhasil direset!*\n\n📌 Grup : *${group.name}*`)
      }
      let list = `🔑 *GRUP YANG BOT JADI ADMIN (${adminGroups.length})*\n\n`
      adminGroups.forEach((g, i) => { list += `${i + 1}. *${g.name}*\n` })
      list += `\n*Cara reset:*\n/resetlink <nomor>\n/resetlink all — reset SEMUA`
      return void sendMsg(chatId, list)
    } catch (e) { await sendMsg(chatId, `❌ Gagal: ${(e as Error).message}`) }
  },

  async resetlinkall(chatId) {
    const sock = globalThis.__sock__ as Record<string, unknown> | null
    if (!sock) return void sendMsg(chatId, '❌ WA Bot tidak terhubung')
    await sendMsg(chatId, '⏳ Reset link semua grup (bot admin)...')
    try {
      const groupsData = getAllGroups() as Record<string, { participants?: Array<{ id: string; admin?: string }> }>
      const botNum     = ((sock['user'] as Record<string, string>)?.['id']?.split(':')[0] || '').replace(/[^0-9]/g, '')
      let berhasil = 0, gagal = 0, dilewati = 0
      const revokeInvite = sock['groupRevokeInvite'] as (jid: string) => Promise<unknown>
      const sendWA       = sock['sendMessage'] as (jid: string, content: unknown) => Promise<unknown>
      for (const [jid, meta] of Object.entries(groupsData)) {
        const botP    = meta.participants?.find(p => p.id?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') === botNum)
        const isAdmin = botP?.admin === 'admin' || botP?.admin === 'superadmin'
        if (!isAdmin) { dilewati++; continue }
        try {
          await revokeInvite(jid)
          try { await sendWA(jid, { text: `🔄 *Link grup telah direset!*\n\n_Direset via Telegram Remote_` }) } catch {}
          berhasil++
          await new Promise<void>(r => setTimeout(() => r(), 1000))
        } catch { gagal++ }
      }
      await sendMsg(chatId, `✅ *Reset Link Selesai!*\n\n✅ Berhasil : ${berhasil} grup\n❌ Gagal    : ${gagal} grup\n⏭️ Dilewati : ${dilewati} grup`)
    } catch (e) { await sendMsg(chatId, `❌ Gagal: ${(e as Error).message}`) }
  },

  async exec(chatId, args = '') {
    if (!args) return void sendMsg(chatId, '❌ Format: /exec <kode JS>')
    try {
      const util = (await import('util')).default
      const code = args.replace(/[\u200e\u200f\u200b\u200d\u2028\u2029\ufeff\u00a0]/g, ' ').trim()
      const result = await eval(`(async () => { return ${code} })()`)
      let output = util.format(result)
      if (output.length > 3800) output = output.slice(0, 3800) + '\n...(terpotong)'
      await sendMsg(chatId, `📤 *Result*\n\n\`\`\`\n${output}\n\`\`\``)
    } catch (e) { await sendMsg(chatId, `❌ *Error*\n\n\`\`\`\n${(e as Error).message}\n\`\`\``) }
  },

  async eval(chatId, args = '') {
    if (!args) return void sendMsg(chatId, '❌ Format: /eval <kode JS>')
    try {
      const util = (await import('util')).default
      const code = args.replace(/[\u200e\u200f\u200b\u200d\u2028\u2029\ufeff\u00a0]/g, ' ').trim()
      let evaled: unknown
      try { evaled = await eval(`(async () => { return ${code} })()`) }
      catch { evaled = await eval(`(async () => { ${code} })()`) }
      if (evaled === undefined) evaled = '✅ Done (no return value)'
      let output = typeof evaled === 'string' ? evaled : util.inspect(evaled, { depth: 3 })
      if (output.length > 3800) output = output.slice(0, 3800) + '\n...(terpotong)'
      await sendMsg(chatId, `✅ *Eval*\n\n\`\`\`\n${output}\n\`\`\``)
    } catch (e) { await sendMsg(chatId, `❌ *Eval Error*\n\n\`\`\`\n${(e as Error).message}\n\`\`\``) }
  },

  async shell(chatId, args = '') {
    if (!args) return void sendMsg(chatId, '❌ Format: /shell <command>')
    try {
      const { promisify } = await import('util')
      const { exec }      = await import('child_process')
      const execP         = promisify(exec)
      const { stdout, stderr } = await execP(args, { timeout: 30000 })
      if (stderr) return void sendMsg(chatId, `⚠️ *stderr*\n\n\`\`\`\n${stderr.slice(0, 3800)}\n\`\`\``)
      const out = stdout?.trim() || '✅ Command executed (no output)'
      await sendMsg(chatId, `📤 *stdout*\n\n\`\`\`\n${out.slice(0, 3800)}\n\`\`\``)
    } catch (e) { await sendMsg(chatId, `❌ *Shell Error*\n\n\`\`\`\n${(e as Error).message}\n\`\`\``) }
  },

  async hd(chatId) {
    const fileId = tgGetPendingPhoto(chatId)
    if (!fileId) return void sendMsg(chatId, '❌ *Reply foto* dengan /hd')
    tgClearPendingPhoto(chatId)
    await sendMsg(chatId, '⏳ *Memproses Super HD...*\n_Harap tunggu ±30-60 detik_')
    try {
      const imgBuf = await tgDownloadPhoto(fileId)
      const imgUrl = await tgUploadToCDN(imgBuf)
      const hdRes  = await axios.get('https://api-faa.my.id/faa/superhd', { params: { url: imgUrl }, responseType: 'arraybuffer', timeout: 180000, headers: { 'User-Agent': 'Mozilla/5.0' }, maxContentLength: 50 * 1024 * 1024 })
      const hdBuf  = Buffer.from(hdRes.data)
      if (hdBuf.length < 1000) throw new Error('Response tidak valid')
      const hdUrl  = await tgUploadToCDN(hdBuf)
      await tgSendPhoto(chatId, hdUrl, `✅ *Super HD selesai!*\n📦 ${(imgBuf.length/1024).toFixed(1)} KB → ${(hdBuf.length/1024).toFixed(1)} KB`)
    } catch (e) { await sendMsg(chatId, `❌ Gagal Super HD: ${(e as Error).message}`) }
  },

  async aiedit(chatId, args = '') {
    if (!args) return void sendMsg(chatId, '❌ Format: /aiedit <prompt>\n\nContoh: /aiedit to anime')
    const fileId = tgGetPendingPhoto(chatId)
    if (!fileId) return void sendMsg(chatId, '❌ *Reply foto* dengan /aiedit <prompt>')
    tgClearPendingPhoto(chatId)
    await sendMsg(chatId, `🎨 *Mengedit gambar...*\n📝 Prompt: *${args}*`)
    try {
      const imgBuf    = await tgDownloadPhoto(fileId)
      const imgUrl    = await tgUploadToCDN(imgBuf)
      const editRes   = await axios.get('https://api.neoxr.eu/api/qwen-edit', { params: { image: imgUrl, prompt: args, apikey: global.apiKeys.neoxr }, timeout: 120000 })
      if (!editRes.data?.status) throw new Error(editRes.data?.message || 'API gagal')
      const resultUrl = editRes.data.data?.url || editRes.data.data?.downloadUrl
      if (!resultUrl) throw new Error('URL hasil tidak ditemukan')
      await tgSendPhoto(chatId, resultUrl, `✅ *AI Edit selesai!*\n📝 Prompt: ${args}`)
    } catch (e) { await sendMsg(chatId, `❌ Gagal AI Edit: ${(e as Error).message}`) }
  },

  async hdv1(chatId) {
    const fileId = tgGetPendingPhoto(chatId)
    if (!fileId) return void sendMsg(chatId, '❌ *Reply foto* dengan /hdv1')
    tgClearPendingPhoto(chatId)
    await sendMsg(chatId, '⏳ *Memproses HD V1...*\n_Harap tunggu sebentar_')
    try {
      const imgBuf   = await tgDownloadPhoto(fileId)
      const FormData = (await import('form-data')).default
      const IMGLARGER_BASE_URL = 'https://get1.imglarger.com/api/UpscalerNew'
      const IMGLARGER_HEADERS  = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36',
        'Origin':     'https://imgupscaler.com',
        'Referer':    'https://imgupscaler.com/',
      }

      // Engine 1: Imglarger
      let resultBuf: Buffer | null = null
      let methodUsed = 'Imglarger'
      try {
        const form = new FormData()
        form.append('myfile', imgBuf, { filename: 'image.jpg', contentType: 'image/jpeg' })
        form.append('scaleRadio', '4')
        const upload = await axios.post(`${IMGLARGER_BASE_URL}/UploadNew`, form, {
          headers: { ...IMGLARGER_HEADERS, ...form.getHeaders() },
          timeout: 30000,
        })
        if (upload.data.code !== 200 || !upload.data.data?.code) throw new Error('Gagal upload ke Imglarger')
        const fileCode = upload.data.data.code
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 3000))
          const s = await axios.post(
            `${IMGLARGER_BASE_URL}/CheckStatusNew`,
            { code: fileCode, scaleRadio: 4 },
            { headers: { ...IMGLARGER_HEADERS, 'Content-Type': 'application/json' }, timeout: 10000 }
          )
          if (s.data.code === 200 && s.data.data?.status === 'success') {
            const url = s.data.data.downloadUrls?.[0]
            if (!url) throw new Error('URL hasil tidak ada')
            const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 })
            resultBuf = Buffer.from(res.data)
            break
          }
          if (s.data.data?.status === 'error') throw new Error('Server Imglarger error')
        }
        if (!resultBuf) throw new Error('Timeout: Server Imglarger sibuk')
      } catch (e1) {
        // Engine 2: PicsArt fallback
        methodUsed = 'PicsArt'
        const jsUrl = 'https://picsart.com/-/landings/4.290.0/static/index-msH24PNW-B73n3SC9.js'
        const jsRes = await axios.get(jsUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36' },
          timeout: 10000,
        })
        const match = jsRes.data.match(/"x-app-authorization":"Bearer ([^"]+)"/)
        if (!match) throw new Error('Token PicsArt tidak ditemukan')
        const authToken = `Bearer ${match[1]}`

        // Upload ke PicsArt
        const upForm = new FormData()
        upForm.append('type', 'editing-temp-landings')
        upForm.append('file', imgBuf, { filename: 'image.jpeg', contentType: 'image/jpeg' })
        upForm.append('url', '')
        upForm.append('metainfo', '')
        const upRes = await axios.post('https://upload.picsart.com/files', upForm, {
          headers: {
            ...upForm.getHeaders(),
            'authority': 'upload.picsart.com', 'accept': '*/*',
            'accept-language': 'id-ID,id;q=0.9', 'origin': 'https://picsart.com',
            'referer': 'https://picsart.com/',
            'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
          },
          timeout: 30000,
        })
        if (!upRes.data?.result?.url) throw new Error('Upload ke PicsArt gagal')
        const uploadedUrl = upRes.data.result.url

        // Enhance
        const params = new URLSearchParams({ picsart_cdn_url: uploadedUrl, format: 'PNG', model: 'REALESERGAN' })
        const enhRes = await axios.post(`https://ai.picsart.com/gw1/diffbir-enhancement-service/v1.7.6?${params}`, {
          image_url:         uploadedUrl,
          colour_correction: { enabled: false, blending: 0.5 },
          face_enhancement:  { enabled: true, blending: 1, max_faces: 1000, impression: false, gfpgan: true, node: 'ada' },
          seed:              42,
          upscale:           { enabled: true, node: 'esrgan', target_scale: 4 },
        }, {
          headers: {
            'authority': 'ai.picsart.com', 'accept': 'application/json', 'content-type': 'application/json',
            'origin': 'https://picsart.com', 'referer': 'https://picsart.com/',
            'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
            'x-app-authorization': authToken, 'x-touchpoint': 'widget_EnhancedImage', 'x-touchpoint-referrer': '/image-upscale/',
          },
          timeout: 30000,
        })
        if (!enhRes.data?.id) throw new Error('Enhance request gagal')
        const jobId = enhRes.data.id

        // Poll status
        let resultUrl: string | null = null
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000))
          const s = await axios.get(`https://ai.picsart.com/gw1/diffbir-enhancement-service/v1.7.6/${jobId}`, {
            headers: {
              'authority': 'ai.picsart.com', 'accept': 'application/json',
              'origin': 'https://picsart.com', 'referer': 'https://picsart.com/',
              'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
              'x-app-authorization': authToken,
            },
            timeout: 10000,
          })
          if (s.data.status === 'DONE') { resultUrl = s.data.result.image_url; break }
          if (s.data.status === 'FAILED') throw new Error(s.data.error_message || 'PicsArt FAILED')
        }
        if (!resultUrl) throw new Error('Timeout menunggu PicsArt')
        const dlRes = await axios.get(resultUrl, { responseType: 'arraybuffer', timeout: 30000 })
        resultBuf = Buffer.from(dlRes.data)
      }

      const hdUrl = await tgUploadToCDN(resultBuf!)
      await tgSendPhoto(chatId, hdUrl, `✅ *HD V1 selesai!* (${methodUsed})\n📦 ${(imgBuf.length/1024).toFixed(1)} KB → ${(resultBuf!.length/1024).toFixed(1)} KB`)
    } catch (e) { await sendMsg(chatId, `❌ Gagal HD V1: ${(e as Error).message}`) }
  },

  async hdv2(chatId, args = '') {
    const fileId = tgGetPendingPhoto(chatId)
    if (!fileId) return void sendMsg(chatId, '❌ *Reply foto* dengan /hdv2 [2x|4x]')
    tgClearPendingPhoto(chatId)
    const multiplier = args.includes('4') ? 4 : 2
    await sendMsg(chatId, `⏳ *Memproses HD V2 (${multiplier}x)...*\n_Harap tunggu sebentar_`)
    try {
      const imgBuf  = await tgDownloadPhoto(fileId)
      const FormData = (await import('form-data')).default
      const filename = `image_${Date.now()}.jpg`

      // Ambil token & taskId dari iloveimg
      const pageRes = await fetch('https://www.iloveimg.com/id/tingkatkan-gambar', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
      const html    = await pageRes.text()
      const token   = html.match(/"token":"([^"]+)"/)?.[1]
      const taskId  = html.match(/ilovepdfConfig\.taskId\s*=\s*'([^']+)'/)?.[1]
      if (!token || !taskId) throw new Error('Gagal ambil token/taskId iloveimg')

      // Upload
      const uploadForm = new FormData()
      uploadForm.append('name', filename)
      uploadForm.append('chunk', '0')
      uploadForm.append('chunks', '1')
      uploadForm.append('task', taskId)
      uploadForm.append('preview', '1')
      uploadForm.append('pdfinfo', '0')
      uploadForm.append('pdfforms', '0')
      uploadForm.append('pdfresetforms', '0')
      uploadForm.append('v', 'web.0')
      uploadForm.append('file', imgBuf, { filename, contentType: 'image/jpeg' })
      const uploadRes = await axios.post('https://api1g.iloveimg.com/v1/upload', uploadForm, {
        headers: { ...uploadForm.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Authorization': `Bearer ${token}` }
      })
      const serverFilename = uploadRes.data?.server_filename
      if (!serverFilename) throw new Error('Upload iloveimg gagal')

      // Process
      const processForm = new FormData()
      processForm.append('packaged_filename', 'iloveimg-upscaled')
      processForm.append('multiplier', String(multiplier))
      processForm.append('task', taskId)
      processForm.append('tool', 'upscaleimage')
      processForm.append('files[0][server_filename]', serverFilename)
      processForm.append('files[0][filename]', filename)
      const processRes = await axios.post('https://api1g.iloveimg.com/v1/process', processForm, {
        headers: { ...processForm.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Authorization': `Bearer ${token}`, 'Origin': 'https://www.iloveimg.com' }
      })
      if (processRes.data?.status !== 'TaskSuccess') throw new Error('Processing gagal: ' + JSON.stringify(processRes.data))

      // Download
      const dlRes = await axios.get(`https://api1g.iloveimg.com/v1/download/${taskId}`, {
        responseType: 'arraybuffer',
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
      const resultBuf = Buffer.from(dlRes.data)
      const hdUrl     = await tgUploadToCDN(resultBuf)
      await tgSendPhoto(chatId, hdUrl, `✅ *HD V2 ${multiplier}x selesai!*\n📦 ${(imgBuf.length/1024).toFixed(1)} KB → ${(resultBuf.length/1024).toFixed(1)} KB`)
    } catch (e) { await sendMsg(chatId, `❌ Gagal HD V2: ${(e as Error).message}`) }
  },

  async tiktok(chatId, args = '') {
    const url = args.trim()
    const TT_REGEX = /https?:\/\/(?:www\.|m\.|vm\.|vt\.|v\.)?tiktok\.com(?:\/[^\s]*)?|https?:\/\/(?:vm|vt)\.tiktok\.com\/[^\s]*/i
    if (!url || !TT_REGEX.test(url)) {
      return void sendMsg(chatId,
        '🎵 *TikTok Downloader*\n\n' +
        'Cara pakai:\n`/tiktok https://vt.tiktok.com/xxx`\n`/tt https://vm.tiktok.com/xxx`'
      )
    }
    await sendMsg(chatId, '⏳ *Mengunduh TikTok...*\n_Harap tunggu_')
    try {
      const NEOXR_KEY = global.apiKeys.neoxr
      const res = await axios.get('https://api.neoxr.eu/api/tiktok', {
        params:  { url, apikey: NEOXR_KEY },
        timeout: 30000,
      })
      const d = res.data
      if (!d?.status || !d?.data) throw new Error(d?.message || 'Neoxr API gagal')
      const data      = d.data
      if (!data.video) throw new Error('URL video tidak ditemukan')

      const playUrl  = data.video
      const author   = data.author?.nickname   || 'unknown'
      const uniqueId = data.author?.unique_id  || ''
      const desc     = data.caption            || ''
      const views    = data.statistic?.views   || 0
      const likes    = data.statistic?.likes   || 0
      const comments = data.statistic?.comments || 0
      const music    = data.music?.title       || ''
      const duration = data.music?.duration    || 0

      const numFmt = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : String(n)
      const fmtDur = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

      // Download video
      const videoBuf = Buffer.from((await axios.get(playUrl, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.tiktok.com/' },
        timeout:      90000,
        maxRedirects: 10,
      })).data)
      const sizeMB = (videoBuf.length / 1024 / 1024).toFixed(2)

      // Upload ke CDN lalu kirim
      const { token } = getTgCfg()
      const FormData  = (await import('form-data')).default
      const form      = new FormData()
      form.append('chat_id', String(chatId))
      form.append('video', videoBuf, { filename: 'tiktok.mp4', contentType: 'video/mp4' })
      form.append('duration', String(duration))
      form.append('caption',
        `🎵 *TikTok*\n` +
        `👤 ${author}${uniqueId ? ` (@${uniqueId})` : ''}\n` +
        `📝 ${desc.slice(0, 100)}${desc.length > 100 ? '...' : ''}\n` +
        `👁️ ${numFmt(views)}  ❤️ ${numFmt(likes)}  💬 ${numFmt(comments)}\n` +
        `⏱️ ${fmtDur(duration)}  📦 ${sizeMB} MB\n` +
        `🎵 ${music.slice(0, 50)}${music.length > 50 ? '...' : ''}`
      )
      form.append('parse_mode', 'Markdown')
      await axios.post(`https://api.telegram.org/bot${token}/sendVideo`, form, {
        headers: { ...form.getHeaders() },
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength:    Infinity,
      })
    } catch (e) { await sendMsg(chatId, `❌ Gagal TikTok: ${(e as Error).message}`) }
  },

  async tt(chatId, args = '') { return commands.tiktok!(chatId, args) },

  async ig(chatId, args = '') {
    const url = args.trim()
    const IG_REGEX = /instagram\.com\/(p|reel|tv|stories|share\/reel)\//i
    if (!url || !IG_REGEX.test(url)) {
      return void sendMsg(chatId,
        '📸 *Instagram Downloader*\n\n' +
        'Cara pakai:\n`/ig https://instagram.com/p/xxx`\n`/ig https://instagram.com/reel/xxx`'
      )
    }
    await sendMsg(chatId, '⏳ *Mengunduh Instagram...*\n_Harap tunggu_')
    try {
      const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36'
      const FormData = (await import('form-data')).default

      // ── Helper download buffer ───────────────────────────────────
      const dlBuf = async (u: string) => Buffer.from((await axios.get(u, {
        responseType: 'arraybuffer', timeout: 60000,
        headers: { 'User-Agent': UA, 'Referer': 'https://www.instagram.com/' },
        maxRedirects: 5
      })).data)

      // ── Fetch via 4 fallback sumber ──────────────────────────────
      type IGResult = { title: string; videos: { url: string; quality: string }[]; images: { url: string }[] }
      let result: IGResult | null = null

      // 1. Deline
      try {
        const { data } = await axios.get('https://api.deline.web.id/downloader/ig', { params: { url }, timeout: 30000 })
        if (data?.status && data?.result) {
          const media = data.result.media
          result = {
            title:  data.result.title || '',
            videos: (media?.videos || []).map((v: string) => ({ url: v, quality: '' })),
            images: (media?.images || []).map((i: string) => ({ url: i })),
          }
          if (!result.videos.length && !result.images.length) result = null
        }
      } catch {}

      // 2. Cobalt fallback
      if (!result) {
        try {
          const r = await axios.post('https://api.cobalt.tools/api/json',
            { url, vCodec: 'h264', vQuality: '720', aFormat: 'mp3', isNoTTWatermark: true },
            { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Content-Type': 'application/json' }, timeout: 25000 }
          )
          const d = r.data
          if (d.status === 'picker') {
            result = {
              title: '',
              videos: (d.picker?.filter((p: any) => p.type === 'video') || []).map((p: any) => ({ url: p.url, quality: '' })),
              images: (d.picker?.filter((p: any) => p.type === 'photo') || []).map((p: any) => ({ url: p.url })),
            }
          } else if (d.url) {
            result = { title: '', videos: [{ url: d.url, quality: '720p' }], images: [] }
          }
          if (result && !result.videos.length && !result.images.length) result = null
        } catch {}
      }

      if (!result) throw new Error('Semua sumber gagal. Akun mungkin private atau link tidak valid.')

      const total = result.videos.length + result.images.length
      await sendMsg(chatId,
        `📸 *Instagram*\n` +
        `🖼️ Gambar: ${result.images.length}  🎬 Video: ${result.videos.length}  📦 Total: ${total}` +
        (result.title ? `\n📝 ${result.title.slice(0, 60)}` : '')
      )

      const { token } = getTgCfg()
      let sent = 0

      // Kirim gambar
      for (let i = 0; i < result.images.length; i++) {
        try {
          const buf  = await dlBuf(result.images[i].url)
          const form = new FormData()
          form.append('chat_id', String(chatId))
          form.append('photo', buf, { filename: 'ig.jpg', contentType: 'image/jpeg' })
          form.append('caption', result.images.length > 1 ? `🖼️ ${i+1}/${result.images.length}` : '📸 Instagram')
          await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, {
            headers: form.getHeaders(), timeout: 60000, maxContentLength: Infinity, maxBodyLength: Infinity
          })
          sent++
        } catch (e) { console.error('[IG img]', (e as Error).message) }
      }

      // Kirim video
      for (let i = 0; i < result.videos.length; i++) {
        try {
          const buf    = await dlBuf(result.videos[i].url)
          const sizeMB = buf.length / 1024 / 1024
          if (sizeMB > 50) { await sendMsg(chatId, `⚠️ Video ${i+1} terlalu besar (${sizeMB.toFixed(1)} MB), skip.`); continue }
          const form = new FormData()
          form.append('chat_id', String(chatId))
          form.append('video', buf, { filename: 'ig.mp4', contentType: 'video/mp4' })
          form.append('caption', `🎬 Instagram${result.videos[i].quality ? ' • '+result.videos[i].quality : ''}`)
          await axios.post(`https://api.telegram.org/bot${token}/sendVideo`, form, {
            headers: form.getHeaders(), timeout: 120000, maxContentLength: Infinity, maxBodyLength: Infinity
          })
          sent++
        } catch (e) { console.error('[IG vid]', (e as Error).message) }
      }

      if (sent === 0) throw new Error('Semua media gagal dikirim')
    } catch (e) { await sendMsg(chatId, `❌ Gagal IG: ${(e as Error).message}`) }
  },

  async removebg(chatId) {
    const fileId = tgGetPendingPhoto(chatId)
    if (!fileId) return void sendMsg(chatId, '❌ *Reply foto* dengan /removebg')
    tgClearPendingPhoto(chatId)
    await sendMsg(chatId, '⏳ *Memproses Remove Background...*\n_Harap tunggu sebentar_')
    try {
      const imgBuf = await tgDownloadPhoto(fileId)
      const fs     = await import('fs')
      const path   = await import('path')
      const os     = await import('os')
      const FormData = (await import('form-data')).default

      // Upload ke pixelcut
      const tmpFile = path.join(os.tmpdir(), `removebg_${Date.now()}.jpg`)
      fs.writeFileSync(tmpFile, imgBuf)
      let resultBuf: Buffer
      try {
        const form = new FormData()
        form.append('image', fs.createReadStream(tmpFile), path.basename(tmpFile))
        form.append('format', 'png')
        form.append('model', 'v1')
        const res = await axios.post('https://api2.pixelcut.app/image/matte/v1', form, {
          headers: {
            'User-Agent':        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
            'Accept':            'application/json, text/plain, */*',
            'x-locale':          'en',
            'x-client-version':  'web:pixa.com:4a5b0af2',
            'origin':            'https://www.pixa.com',
            'referer':           'https://www.pixa.com/',
            'accept-language':   'id-ID,id;q=0.9',
            ...form.getHeaders()
          },
          responseType: 'arraybuffer',
          timeout:      30000
        })
        resultBuf = Buffer.from(res.data)
        if (!resultBuf.length) throw new Error('Buffer hasil kosong')
      } finally {
        try { fs.unlinkSync(tmpFile) } catch {}
      }

      const sizeBefore = (imgBuf.length / 1024).toFixed(1)
      const sizeAfter  = (resultBuf.length / 1024).toFixed(1)
      const { token }  = getTgCfg()
      const form2      = new FormData()
      form2.append('chat_id', String(chatId))
      form2.append('document', resultBuf, { filename: 'removebg.png', contentType: 'image/png' })
      form2.append('caption', `✅ *Remove Background selesai!*\n📦 ${sizeBefore} KB → ${sizeAfter} KB`)
      form2.append('parse_mode', 'Markdown')
      await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form2, {
        headers: form2.getHeaders(), timeout: 60000, maxContentLength: Infinity, maxBodyLength: Infinity
      })
    } catch (e) { await sendMsg(chatId, `❌ Gagal Remove BG: ${(e as Error).message}`) }
  },

  async broadcast(chatId, args = '') {
    if (!args) return void sendMsg(chatId, '❌ Format: /broadcast <pesan>')
    const sock = globalThis.__sock__ as Record<string, unknown> | null
    if (!sock) return void sendMsg(chatId, '❌ WA Bot tidak terhubung')
    await sendMsg(chatId, `⏳ Mengirim broadcast ke semua grup...`)
    try {
      const fetchAll = sock['groupFetchAllParticipating'] as () => Promise<Record<string, unknown>>
      const sendWA   = sock['sendMessage'] as (jid: string, content: unknown) => Promise<unknown>
      const chats    = await fetchAll()
      const jids     = Object.keys(chats)
      let sukses     = 0
      for (const jid of jids) {
        try { await sendWA(jid, { text: args }); sukses++ } catch {}
        await new Promise<void>(r => setTimeout(r, 500))
      }
      await sendMsg(chatId, `✅ *Broadcast selesai!*\n\n📤 Terkirim : ${sukses}/${jids.length} grup`)
    } catch (e) { await sendMsg(chatId, `❌ Gagal broadcast: ${(e as Error).message}`) }
  }
}

// ─── Handle callback_query ───────────────────────────────────────────────────
async function handleCallback(cb: TgCallbackQuery): Promise<void> {
  const cbFrom = cb.from?.id
  const cbChat = cb.message?.chat?.id!
  const cbData = cb.data || ''
  const msgId  = cb.message?.message_id

  await answerCallback(cb.id)

  // ── Callback publik (semua orang boleh) ──────────────────────────
  if (cbData === 'cb_menu') {
    await sendMsg(cbChat,
      `🖼️ *Image (reply foto dulu):*\n` +
      `/hd — Super HD\n` +
      `/hdv1 — HD V1 (imglarger)\n` +
      `/hdv2 [4x] — HD V2 (iloveimg)\n` +
      `/aiedit <prompt> — AI Edit\n\n` +
      `🎵 *Downloader:*\n` +
      `/tiktok <url> — Download TikTok\n` +
      `/ig <url> — Download Instagram\n` +
      `/removebg — Hapus Background (reply foto)\n\n` +
      `🔒 *Khusus Owner:*\n` +
      `🔧 /status /restart /cc /on /off\n` +
      `🤖 /listbot /stopbot <nomor>\n` +
      `📢 /broadcast /resetlink /resetlink all\n` +
      `💻 /exec /eval /shell <cmd>`
    )
    return
  }
  if (cbData === 'cb_close') {
    await tgApi('editMessageReplyMarkup', { chat_id: cbChat, message_id: msgId, reply_markup: { inline_keyboard: [] } })
    return
  }

  // ── Callback khusus owner ─────────────────────────────────────────
  if (!isOwner(cbFrom)) return void sendMsg(cbChat, '⛔ Akses ditolak. Tombol ini khusus owner.')

  if      (cbData === 'cb_status')  await commands.status!(cbChat)
  else if (cbData === 'cb_restart') await commands.restart!(cbChat)
  else if (cbData === 'cb_cc')      await commands.cc!(cbChat)
  else if (cbData === 'cb_on')      await commands.on!(cbChat)
  else if (cbData === 'cb_off')     await commands.off!(cbChat)
  else if (cbData === 'cb_listbot') await commands.listbot!(cbChat)
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
      if (update.callback_query) {
        await handleCallback(update.callback_query)
        continue
      }
      const msg    = update.message
      if (!msg) continue
      const chatId = msg.chat.id
      const from   = msg.from?.id

      // Tentukan command dari text ATAU caption (untuk pesan foto)
      const _rawText = msg.text?.trim() || msg.caption?.trim() || ''
      const _rawCmd  = _rawText.split(' ')[0].toLowerCase().replace('/', '')
      const PUBLIC_COMMANDS = ['start', 'hd', 'hdv1', 'hdv2', 'aiedit', 'tiktok', 'tt', 'ig', 'instagram', 'igdl', 'insta', 'removebg', 'nobg']
      if (!isOwner(from) && !PUBLIC_COMMANDS.includes(_rawCmd)) {
        await sendMsg(chatId, '⛔ Akses ditolak.')
        continue
      }

      // ── Handle foto dengan caption command ──────────────────────────
      if (msg.photo && msg.photo.length > 0) {
        const _cap = msg.caption?.trim() || ''
        if (!_cap.startsWith('/')) continue
        const _capCmd = _cap.split(' ')[0].toLowerCase().replace('/', '')
        if (['hd', 'hdv1', 'hdv2', 'aiedit', 'removebg', 'nobg'].includes(_capCmd)) {
          const best = msg.photo[msg.photo.length - 1]
          _pendingPhoto[String(chatId)] = best.file_id
        }
        const _capArgs = _cap.split(' ').slice(1).join(' ')
        if (commands[_capCmd]) { try { await commands[_capCmd]!(chatId, _capArgs) } catch(e) { await sendMsg(chatId, '❌ Error: ' + (e as Error).message) } }
        continue
      }

      if (!msg.text) continue
      const text = msg.text?.trim() || ''
      if (!text) continue

      const [cmd, ...argParts] = text.split(' ')
      const command = cmd.toLowerCase().replace('/', '')
      const args    = argParts.join(' ')

      // ── Kalau reply foto, inject ke _pendingPhoto ──────────────────
      if (['hd', 'aiedit', 'hdv1', 'hdv2', 'removebg', 'nobg'].includes(command) && msg.reply_to_message?.photo?.length) {
        const best = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1]
        _pendingPhoto[String(chatId)] = best.file_id
      }

      logger.system('tgbot', `Command: ${cmd} dari ${from}`)
      if (command === 'resetlink' && args.trim().toLowerCase() === 'all') {
        try { await commands.resetlinkall!(chatId) } catch (e) { await sendMsg(chatId, `❌ Error: ${(e as Error).message}`) }
      } else if (commands[command]) {
        try { await commands[command]!(chatId, args) } catch (e) {
          await sendMsg(chatId, `❌ Error: ${(e as Error).message}`)
        }
      } else if (text.startsWith('/')) {
        await sendMsg(chatId, `❌ Command tidak dikenal: ${cmd}\n\nKetik /start untuk menu.`)
      }
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
  if (_polling) { tgNotifyWaOnline(); return }
  _polling   = true
  _startTime = Date.now()
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
