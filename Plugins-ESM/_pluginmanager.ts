import fs from 'fs'
import { buildFkontak, botName, ownerName, BOT_JID, CHANNEL_JID } from '../Library/utils.js'
import { kvGet, kvSet, kvGetAll, kvSetAll, kvDelete } from '../Database/kvstore.js'

let _sharpInstance: any = null
async function getSharp() {
  if (!_sharpInstance) _sharpInstance = (await import('sharp')).default
  return _sharpInstance
}

const _DOC_IMG_FALLBACK = 'https://cdn.ornzora.eu.cc/b815ef37-1be8-4b37-b522-16c445ef3fbd-upload-1781387499469.jpg'

let _docThumbCache: Buffer | null = null
let _docThumbLastUrl: string      = ''

function _getDocImgUrl(): string {
  try {
    const url = kvGet<string>('menuimg', 'url', '')
    if (url) return url
  } catch {}
  return _DOC_IMG_FALLBACK
}

async function getDocThumb(): Promise<Buffer> {
  const currentUrl = _getDocImgUrl()

  // Kalau URL berubah (habis .setpp), bust cache supaya reload
  if (_docThumbCache && _docThumbLastUrl === currentUrl) return _docThumbCache

  const sharp = await getSharp()

  // Download dari URL (menuimg.json atau hardcoded fallback)
  const buf = Buffer.from(await (await fetch(currentUrl)).arrayBuffer())
  _docThumbCache   = await sharp(buf).resize(320, 320, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer()
  _docThumbLastUrl = currentUrl
  return _docThumbCache
}

export function bustDocThumbCache() {
  _docThumbCache   = null
  _docThumbLastUrl = ''
}
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import chalk from 'chalk'
import { checkLimit, addUsage, getUsage, DAILY_LIMIT, getUserDailyLimit } from '../Database/usagelimit.js'
import { trackCommand } from '../Database/stats.js'
import { checkAbuse } from '../Library/antiabuse.js'
import { isJadibot } from '../Library/jadibotdb.js'
import { isMainOwner } from '../System/mainowner.js'
import { getPhoneByLid } from '../Database/db.js'
import type { PluginModule, HandleData, MsgObj, ExtSocket } from '../types/global.js'
import { EventEmitter } from 'events'

EventEmitter.defaultMaxListeners = 50

interface FkontakCache {
  value: any
  expireAt: number
}
let _fkontakCache: FkontakCache | null = null
const FKONTAK_TTL_MS = 30_000  

async function buildFkontakCached(Morela: ExtSocket): Promise<any> {
  const now = Date.now()
  if (_fkontakCache && now < _fkontakCache.expireAt) {
    return _fkontakCache.value
  }
  try {
    const val = await buildFkontak(Morela)
    _fkontakCache = { value: val, expireAt: now + FKONTAK_TTL_MS }
    return val
  } catch {
    return _fkontakCache?.value ?? null  
  }
}

const __filename  = fileURLToPath(import.meta.url as string)
const __dirname   = path.dirname(__filename)

interface DisabledEntry {
  disabledAt: number
  reason:     string
}

function _loadDisabled(): Record<string, DisabledEntry> {
  try {
    return kvGetAll<DisabledEntry>('disabled_plugins')
  } catch { return {} }
}

function _saveDisabled(data: Record<string, DisabledEntry>): void {
  try { kvSetAll('disabled_plugins', data) } catch {}
}

export function disablePlugin(command: string, reason = 'Dalam perbaikan'): boolean {
  try { kvSet('disabled_plugins', command.toLowerCase(), { disabledAt: Date.now(), reason }) } catch {}
  return true
}

export function enablePlugin(command: string): boolean {
  const existing = kvGet<DisabledEntry | null>('disabled_plugins', command.toLowerCase(), null)
  if (!existing) return false
  kvDelete('disabled_plugins', command.toLowerCase())
  return true
}

export function isPluginDisabled(command: string): DisabledEntry | null {
  return kvGet<DisabledEntry | null>('disabled_plugins', command.toLowerCase(), null)
}

export function getDisabledPlugins(): Record<string, DisabledEntry> {
  return _loadDisabled()
}

const PLUGINS_DIR = __dirname

function getPluginExt(): string {

  return __filename.endsWith('.ts') ? '.ts' : '.js'
}
function getManagerFilename(): string {
  const ext = getPluginExt()
  return `_pluginmanager${ext}`
}

interface PluginEntry {
  file: string
  plugin: PluginModule
  command: string[]
  help: string[]
  tags: string[]
}

interface PassiveEntry {
  file: string
  plugin: PluginModule
  tags: string[]
}

interface ValidationResult {
  valid: boolean
  plugin?: PluginModule
  error?: string
}

interface ReloadResult {
  success: boolean
  error?: string
  rolledBack?: boolean
}

class PluginManager {
  plugins: Map<string, PluginEntry>
  passiveHandlers: PassiveEntry[]
  pluginCount: number
  passiveCount: number
  ready: Promise<void>

  constructor() {
    this.plugins         = new Map()
    this.passiveHandlers = []
    this.pluginCount     = 0
    this.passiveCount    = 0
    this.ready           = this.loadAllPlugins()
    this.watchPlugins()
  }

  scanPlugins(dir: string): string[] {
    const ext     = getPluginExt()
    const manager = getManagerFilename()
    const results: string[] = []
    let items: fs.Dirent[]
    try { items = fs.readdirSync(dir, { withFileTypes: true }) } catch { return results }
    for (const item of items) {
      if (item.isDirectory()) {
        results.push(...this.scanPlugins(path.join(dir, item.name)))
      } else if (item.name.endsWith(ext) && item.name !== manager) {
        results.push(path.join(dir, item.name))
      }
    }
    return results
  }

  scanMjs(dir: string): string[] { return this.scanPlugins(dir) }

  async loadAllPlugins(): Promise<void> {
    const files = this.scanPlugins(PLUGINS_DIR)
    for (const filepath of files) await this.loadPlugin(filepath)
    const total = this.pluginCount + this.passiveCount

    const tagCount = new Map<string, number>()
    for (const [, entry] of this.plugins) {
      const tags: string[] = (entry.tags && entry.tags.length > 0) ? entry.tags : ['other']
      for (const t of tags) {
        tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
      }
    }
    for (const entry of this.passiveHandlers) {
      const tags: string[] = (entry.tags && entry.tags.length > 0) ? entry.tags : ['passive']
      for (const t of tags) {
        tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
      }
    }

    const sorted = [...tagCount.entries()].sort((a, b) => b[1] - a[1])
    const TOP      = 8
    const topTags  = sorted.slice(0, TOP)
    const restTags = sorted.slice(TOP)
    const restTotal    = restTags.reduce((s, [, c]) => s + c, 0)
    const categories   = tagCount.size

    const colors = ['#c084fc', '#818cf8', '#34d399', '#f472b6', '#60a5fa', '#facc15', '#fb923c', '#a78bfa']

    const div = chalk.hex('#4b5563')('─'.repeat(52))
    console.log('\n' + div)
    console.log(
      chalk.hex('#a855f7').bold('  plugins') +
      chalk.white(` ${total} total`) +
      chalk.gray(`  ${categories} kategori`)
    )
    console.log(div)

    for (let i = 0; i < topTags.length; i += 2) {
      const [tag1, cnt1] = topTags[i]
      const col1 = chalk.hex(colors[i] ?? '#c084fc')
      const num1 = chalk.bgHex(colors[i] ?? '#c084fc').black(` ${cnt1} `)
      let row = `  ${col1(tag1.padEnd(10))} ${num1}`

      if (i + 1 < topTags.length) {
        const [tag2, cnt2] = topTags[i + 1]
        const col2 = chalk.hex(colors[i + 1] ?? '#818cf8')
        const num2 = chalk.bgHex(colors[i + 1] ?? '#818cf8').black(` ${cnt2} `)
        row += `   ${col2(tag2.padEnd(10))} ${num2}`
      }
      console.log(row)
    }

    if (restTotal > 0) {
      console.log(
        chalk.gray(`  +${restTags.length} lainnya`) +
        chalk.white(`   ${restTotal}`)
      )
    }

    console.log(div)
    console.log(
      chalk.green('  ✓') + ' ' +
      chalk.hex('#a855f7').bold('plugin') + '  ' +
      chalk.white(`${total} plugin dimuat`)
    )
    console.log(
      chalk.green('  ✓') + ' ' +
      chalk.hex('#a855f7').bold('command') + ' ' +
      chalk.white(`${this.pluginCount} command`) +
      chalk.gray('  ·  ') +
      chalk.hex('#a855f7').bold('passive') + ' ' +
      chalk.white(`${this.passiveCount}`)
    )
    console.log(div + '\n')
  }

  async _validatePlugin(filepath: string): Promise<ValidationResult> {
    const relFile = path.relative(PLUGINS_DIR, filepath)
    try {
      if (!fs.existsSync(filepath)) {
        return { valid: false, error: `File tidak ditemukan: ${relFile}` }
      }
      const url = pathToFileURL(filepath).href + `?v=${Date.now()}`
      const { default: mod } = await import(url) as { default: PluginModule }

      if (!mod) return { valid: false, error: 'Tidak ada default export' }

      let plugin: PluginModule
      if (typeof mod === 'function') {

        const modAny = mod as any
        plugin = {
          handler:   modAny,
          command:   modAny.command   || [],
          mainOwner: modAny.mainOwner,  
          owner:     modAny.owner,
          premium:   modAny.premium,
          group:     modAny.group,
          private:   modAny.private,
          admin:     modAny.admin,
          botAdmin:  modAny.botAdmin,
          noLimit:   modAny.noLimit,
          help:      modAny.help     || [],
          tags:      modAny.tags     || []
        }
      } else {
        plugin = mod
      }

      if (!plugin.handler || typeof plugin.handler !== 'function') {
        return { valid: false, error: 'handler bukan fungsi atau tidak ada' }
      }

      if (plugin.command && plugin.command.length > 0) {
        if (!Array.isArray(plugin.command)) {
          return { valid: false, error: 'command harus berupa array' }
        }
        for (const c of plugin.command) {
          if (typeof c !== 'string' || c.trim() === '') {
            return { valid: false, error: `command "${c}" tidak valid` }
          }
        }
      }

      return { valid: true, plugin }
    } catch (e) { const err = e as Error
      return { valid: false, error: err.message }
    }
  }

  async loadPlugin(filepath: string): Promise<boolean> {
    if (!path.isAbsolute(filepath)) filepath = path.join(PLUGINS_DIR, filepath)
    const relFile = path.relative(PLUGINS_DIR, filepath)

    const { valid, plugin, error } = await this._validatePlugin(filepath)
    if (!valid || !plugin) {
      console.error(chalk.red(`✗ Plugin invalid [${relFile}]: ${error}`))
      return false
    }

    if (!plugin.command || plugin.command.length === 0) {
      this.passiveHandlers.push({ file: relFile, plugin, tags: plugin.tags || [] })
      this.passiveCount++
      return true
    }

    const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command]
    for (const c of cmds) {
      this.plugins.set(c.toLowerCase(), {
        file: relFile, plugin, command: cmds,
        help: plugin.help || [], tags: plugin.tags || []
      })
    }
    this.pluginCount++
    return true
  }

  getPlugin(cmd: string): PluginEntry | undefined {
    return this.plugins.get(cmd.toLowerCase())
  }

  getPassiveHandlers(): PassiveEntry[] {
    return this.passiveHandlers
  }

  async reloadPlugin(relPath: string): Promise<ReloadResult> {
    const ext = getPluginExt()
    if (!relPath.endsWith(ext)) relPath += ext
    const fullPath = path.join(PLUGINS_DIR, relPath)

    const _oldPlugins = new Map<string, PluginEntry>()
    const _oldPassive: PassiveEntry[] = []

    for (const [k, v] of this.plugins.entries()) {
      if (v.file === relPath) _oldPlugins.set(k, v)
    }
    for (const h of this.passiveHandlers) {
      if (h.file === relPath) _oldPassive.push(h)
    }

    const { valid, plugin, error } = await this._validatePlugin(fullPath)
    if (!valid || !plugin) {
      console.error(chalk.red(`✗ Reload gagal [${relPath}]: ${error}`))
      console.log(chalk.yellow(`↩ Rollback: plugin lama dipertahankan`))
      return { success: false, error, rolledBack: true }
    }

    for (const [k, v] of this.plugins.entries()) {
      if (v.file === relPath) this.plugins.delete(k)
    }
    this.passiveHandlers = this.passiveHandlers.filter((h: PassiveEntry) => h.file !== relPath)

    try {
      if (!plugin.command || plugin.command.length === 0) {
        this.passiveHandlers.push({ file: relPath, plugin, tags: plugin.tags || [] })
      } else {
        const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command]
        for (const c of cmds) {
          this.plugins.set(c.toLowerCase(), {
            file: relPath, plugin, command: cmds,
            help: plugin.help || [], tags: plugin.tags || []
          })
        }
      }
      console.log(chalk.green(`✓ Reloaded: ${relPath}`))
      return { success: true, rolledBack: false }
    } catch (e) { const err = e as Error
      console.error(chalk.red(`✗ Reload runtime error [${relPath}]: ${err.message}`))
      console.log(chalk.yellow(`↩ Rollback: restore plugin lama`))
      for (const [k, v] of this.plugins.entries()) {
        if (v.file === relPath) this.plugins.delete(k)
      }
      this.passiveHandlers = this.passiveHandlers.filter((h: PassiveEntry) => h.file !== relPath)
      for (const [k, v] of _oldPlugins) this.plugins.set(k, v)
      for (const h of _oldPassive) this.passiveHandlers.push(h)
      return { success: false, error: err.message, rolledBack: true }
    }
  }

  async addPlugin(filename: string, code: string): Promise<string> {
    const ext = getPluginExt()
    if (!filename.endsWith(ext)) filename += ext
    const filepath = path.join(PLUGINS_DIR, filename)
    fs.mkdirSync(path.dirname(filepath), { recursive: true })
    fs.writeFileSync(filepath, code)
    await this.reloadPlugin(filename)
    return `✅ Plugin ${filename} ditambahkan`
  }

  deletePlugin(filename: string): string {
    const ext = getPluginExt()
    if (!filename.endsWith(ext)) filename += ext
    let relPath  = filename
    let filepath = path.join(PLUGINS_DIR, filename)
    if (!fs.existsSync(filepath)) {
      const allFiles = this.scanPlugins(PLUGINS_DIR)
      const found    = allFiles.find((f: string) => path.basename(f) === path.basename(filename))
      if (!found) throw new Error('Plugin tidak ditemukan')
      filepath = found
      relPath  = path.relative(PLUGINS_DIR, found)
    }
    for (const [k, v] of this.plugins.entries()) {
      if (v.file === relPath) this.plugins.delete(k)
    }
    this.passiveHandlers = this.passiveHandlers.filter((h: PassiveEntry) => h.file !== relPath)
    fs.unlinkSync(filepath)
    return `✅ Plugin ${relPath} dihapus`
  }

  listPlugins(): PluginEntry[] {
    const map = new Map<string, any>()
    for (const v of this.plugins.values()) {
      if (!map.has(v.file))
        map.set(v.file, { file: v.file, commands: v.command, help: v.help, tags: v.tags, type: 'command' })
    }
    for (const h of this.passiveHandlers) {
      if (!map.has(h.file))
        map.set(h.file, { file: h.file, commands: [], help: [], tags: h.tags, type: 'passive' })
    }
    return [...map.values()]
  }

  getPluginCode(filename: string): string {
    const ext = getPluginExt()
    if (!filename.endsWith(ext)) filename += ext
    let filepath = path.join(PLUGINS_DIR, filename)
    if (!fs.existsSync(filepath)) {
      const allFiles = this.scanPlugins(PLUGINS_DIR)
      const found    = allFiles.find((f: string) => path.basename(f) === path.basename(filename))
      if (!found) throw new Error('Plugin tidak ditemukan')
      filepath = found
    }
    return fs.readFileSync(filepath, 'utf-8')
  }

  watchPlugins(): void {

    if ((this as any)._watcher) return
    const _watchDebounce = new Map<string, NodeJS.Timeout>()
    const ext = getPluginExt()
    const watcher = fs.watch(PLUGINS_DIR, { recursive: true }, (_, file) => {
      if (!file || !file.endsWith(ext)) return
      if (file === getManagerFilename()) return
      if (_watchDebounce.has(file)) clearTimeout(_watchDebounce.get(file)!)
      const t = setTimeout(async () => {
        _watchDebounce.delete(file)
        const fullPath = path.join(PLUGINS_DIR, file)
        if (!fs.existsSync(fullPath)) return
        console.log(chalk.cyan(`[PLUGIN-WATCH] Perubahan terdeteksi: ${file}`))
        const result = await this.reloadPlugin(file)
        if (result.success) {
          console.log(chalk.green(`[PLUGIN-WATCH] ✅ Auto-reload berhasil: ${file}`))
        } else if (result.rolledBack) {
          console.log(chalk.yellow(`[PLUGIN-WATCH] ⚠️ Reload gagal, rollback ke versi lama: ${file}`))
          console.log(chalk.red(`[PLUGIN-WATCH] Error: ${result.error}`))
        }
      }, 300)
      _watchDebounce.set(file, t)
    })

    ;(this as any)._watcher = watcher
  }
}

const pluginManager = new PluginManager()
export default pluginManager

const _cooldownMap = new Map<string, number>()

function checkCooldown(jid: string, command: string, seconds: number = 3): number {
  const key  = `${jid}:${command}`
  const now  = Date.now()
  const last = _cooldownMap.get(key) || 0
  const sisa = (seconds * 1000) - (now - last)
  if (sisa > 0) return Math.ceil(sisa / 1000)
  _cooldownMap.set(key, now)
  return 0
}

setInterval(() => {
  const now = Date.now()
  for (const [key, time] of _cooldownMap.entries()) {
    if (now - time > 10 * 60 * 1000) _cooldownMap.delete(key)
  }
}, 10 * 60 * 1000)

export async function handlePluginCommand(
  m: MsgObj,
  command: string,
  { Morela, text, args, reply, isOwn, isPrem, isAdmin, botAdmin, downloadContentFromMessage, senderJid, usedPrefix }: HandleData & { reply: (msg: string) => Promise<unknown> }
): Promise<unknown> {
  const data = pluginManager.getPlugin(command)
  if (!data) return false

  const h = data.plugin

  const _rawSenderJid = (senderJid || m?.sender || '')
  let _senderNum = _rawSenderJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')

  if (_rawSenderJid.endsWith('@lid')) {
    const _resolved = getPhoneByLid(_senderNum)
    if (_resolved) _senderNum = _resolved.replace(/[^0-9]/g, '')
  }

  const _allSenderNums = [
    _senderNum,
    (m?.sender   || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, ''),
    (m?.key?.participant || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, ''),

    (!(m?.key?.remoteJid || '').endsWith('@g.us')
      ? (m?.key?.remoteJid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
      : '')
  ].filter((n): n is string => !!(n && /^\d{5,}$/.test(n)))

  const _isMainOwner = _allSenderNums.some(n => isMainOwner(n))

  if (!_isMainOwner) {
    const _disabledInfo = isPluginDisabled(command)
    if (_disabledInfo) {
      const _tglDisable = new Date(_disabledInfo.disabledAt).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta'
      })
      return reply(
        `🔧 *Fitur Sedang Dalam Perbaikan*\n\n` +
        `◦ Command  : *.${command}*\n` +
        `◦ Alasan   : ${_disabledInfo.reason}\n` +
        `◦ Sejak    : ${_tglDisable}\n\n` +
        `_Mohon tunggu hingga fitur ini dipulihkan. 🙏_`
      )
    }
  }

  const _isJadibotSender = !_isMainOwner && (
    !!(((global as Record<string, unknown>).jadibotSessions as Map<string,unknown> | undefined)?.has(_senderNum)) || isJadibot(_senderNum)
  )

  if (_isJadibotSender) {
    console.warn(chalk.red(`[SECURITY] Blocked jadibot sender ${_senderNum} — command: ${command}`))
    if (h.mainOwner || h.owner || h.premium) return reply('❌ Fitur ini tidak tersedia saat kamu sedang aktif sebagai jadibot!')
    isOwn  = false
    isPrem = false
  }

  if (h.mainOwner && !_isMainOwner)     return reply('❌ Fitur ini hanya untuk Main Owner!')
  if (h.owner    && !isOwn)             return reply('❌ Fitur ini hanya untuk Owner!')
  if (h.premium  && !isPrem && !isOwn)  return reply('❌ Fitur ini hanya untuk Premium!')
  if (h.group    && !m.isGroup)         return reply('❌ Fitur ini hanya di dalam Grup!')
  if (h.private  && m.isGroup)          return reply('❌ Fitur ini hanya di Private Chat!')
  if (h.admin    && !isAdmin && !isOwn) return reply('❌ Fitur ini hanya untuk Admin Grup!')
  if (h.botAdmin && !botAdmin)          return reply('❌ Bot harus jadi Admin Grup dulu!')

  if (!isOwn) {
    const abuseResult = checkAbuse(
      senderJid || m.sender || m.key?.remoteJid || '',
      command
    )
    if (!abuseResult.allowed) {
      if ('autoBlacklist' in abuseResult && abuseResult.autoBlacklist) {
        try {
          const { banUser } = await import('../Database/db.js')
          banUser(senderJid || m.sender || m.key?.remoteJid || '', 1)
          console.warn(chalk.red(`[ANTIABUSE] Auto-blacklist: ${senderJid || m?.sender}`))
        } catch {}
      }
      return reply(abuseResult.action)
    }

    const sisaDetik = checkCooldown(
      senderJid || m.sender || m.key?.remoteJid || '',
      command,
      3
    )
    if (sisaDetik > 0) {
      return reply(`⏳ Pelan-pelan! Tunggu *${sisaDetik}s* dulu.`)
    }
  }

  const shouldLimit = !isOwn && !isPrem && !h.noLimit
  let userDailyLimit = DAILY_LIMIT

  if (shouldLimit) {
    const limitKey = senderJid || m.sender || m.key?.remoteJid || ''
    try {
      const { getUser: _getUser } = await import('../Database/db.js')
      const _ud = _getUser(limitKey)
      userDailyLimit = getUserDailyLimit(_ud?.level || 0)
    } catch { userDailyLimit = DAILY_LIMIT }

    const cek = checkLimit(limitKey, userDailyLimit)
    if (!cek.allowed) {
      const sisaMs  = (cek as any).resetAt - Date.now()
      const sisaJam = Math.floor(sisaMs / (60 * 60 * 1000))
      const sisaMnt = Math.floor((sisaMs % (60 * 60 * 1000)) / (60 * 1000))
      return reply(
        `🚫 *Limit Harian Tercapai!*\n\n` +
        `Kamu sudah pakai *${userDailyLimit} fitur* hari ini.\n\n` +
        `⏰ Reset dalam: *${sisaJam}j ${sisaMnt}m*\n\n` +
        `_Naikkan level untuk limit lebih banyak!_`
      )
    }
  }

  if (!isOwn && !isPrem) {
    try {
      const { getUser } = await import('../Database/db.js')
      const lookupJid   = senderJid || m.sender || m.key?.remoteJid || ''
      const userData    = getUser(lookupJid)
      if (userData?.is_banned === 1) {
        console.warn(`[BAN] Blocked banned user: ${lookupJid}`)
        return true
      }
    } catch {}
  }

  const _REGISTER_BYPASS = ['daftar', 'daftar_auto', 'unreg', 'unregister']

  if (!isOwn && !isPrem && !_isMainOwner && !_REGISTER_BYPASS.includes(command)) {
    try {
      const { isRegistered: _isReg, getPhoneByLid: _getPhone } = await import('../Database/db.js')
      const rawLookup = senderJid || m.sender || m.key?.remoteJid || ''
      if (rawLookup && rawLookup.length >= 5) {
        let lookupJid = rawLookup
        if (rawLookup.endsWith('@lid')) {
          const _resolved = _getPhone(rawLookup.split('@')[0])
          if (_resolved) lookupJid = _resolved + '@s.whatsapp.net'
        }
        const { getMainOwner: _getMO2 } = await import('../System/mainowner.js')
        const _mo2 = _getMO2()
        const _allJids2 = [senderJid || '', m.sender || '', m.key?.remoteJid || '', lookupJid]
        const _isMO2 = _mo2 && _allJids2.some(j => j && j.split('@')[0].split(':')[0].replace(/[^0-9]/g,'') === _mo2)
        if (!_isMO2 && !_isReg(lookupJid)) {
          // Kirim notif "belum terdaftar" langsung dari sini, jangan silent
          try {
            const { botName: _bn } = await import('../Library/utils.js')
            const _rawNum   = lookupJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
            const _mention  = lookupJid.endsWith('@s.whatsapp.net') ? lookupJid : `${_rawNum}@s.whatsapp.net`
            const _isGroup  = (m.key?.remoteJid as string || '').endsWith('@g.us')
            const _pesan    = _isGroup
              ? `⚠️ @${_rawNum} *Kamu belum terdaftar!*\n\nKetik *.daftar* untuk mulai menggunakan bot.\n\n꒰ © ${_bn} ꒱`
              : `⚠️ *Kamu belum terdaftar!*\n\nKetik *.daftar* untuk mulai menggunakan bot.\n\n꒰ © ${_bn} ꒱`

            // Cek cooldown supaya tidak spam
            const _cdKey  = `reg_notif_${_rawNum}`
            const _cdNow  = Date.now()
            const _cdLast = (globalThis as any).__regNotifCd__?.get?.(_cdKey) || 0
            if (_cdNow - _cdLast > 10000) {
              if (!(globalThis as any).__regNotifCd__) (globalThis as any).__regNotifCd__ = new Map()
              ;(globalThis as any).__regNotifCd__.set(_cdKey, _cdNow)

              const _regImgPath = (await import('path')).default.join(process.cwd(), 'media', 'register.jpg')
              const _fs = (await import('fs')).default
              const _imgBuf = _fs.existsSync(_regImgPath) ? _fs.readFileSync(_regImgPath) : null

              if (_imgBuf) {
                await Morela.sendMessage(m.chat, {
                  image:   _imgBuf,
                  caption: _pesan,
                  ...(_isGroup ? { mentions: [_mention] } : {})
                }, { quoted: m })
              } else {
                await Morela.sendMessage(m.chat, {
                  text: _pesan,
                  ...(_isGroup ? { mentions: [_mention] } : {})
                }, { quoted: m })
              }
            }
          } catch (_e) {
            console.error('[REG NOTIF] error:', (_e as Error).message)
          }
          return true
        }
      }
    } catch (e) { const err = e as Error
      console.error('[REG CHECK] error:', err.message)
    }
  }

  let fkontak: any = m
  try { fkontak = await buildFkontakCached(Morela) } catch {}

  const _botJid = (Morela.user?.id || BOT_JID).replace(/:\d+@/, '@')
  const _botNum  = _botJid.split('@')[0]

  const _origSend = Morela.sendMessage.bind(Morela)
  let _lastSentMsg: any = null
  let _lastSentJid: string | null = null

  const wrappedMorela = new Proxy(Morela, {
    get(target: any, prop: any) {
      if (prop !== 'sendMessage') return target[prop]
      return (jid: string, content: any, opts: any = {}) => (async () => {

        if (!content || content.react || content.delete || content.poll || content.edit) {
          return _origSend(jid, content, opts)
        }

        const isSticker    = !!(content?.sticker)
        const isAudio      = !!(content?.audio)
        const isInteractive = !!(content?.interactiveButtons || content?.footer ||
                               content?.hasMediaAttachment === false || content?.buttonText ||
                               content?.sections || content?.listType !== undefined)
        const isText       = !!(content?.text) && !content?.image && !content?.video &&
                             !isAudio && !content?.document && !isSticker && !isInteractive &&
                             !(content?.mentions?.length)

        if (isText) {
          try {
            const _thumb  = await getDocThumb()
            const _fk     = opts.quoted ?? fkontak
            const result  = await (Morela as any).relayMessage(jid, {
              extendedTextMessage: {
                text:          `https://google.com\n\n${content.text}`,
                matchedText:   'https://google.com',
                description:   `Owner: ${ownerName}`,
                title:         '',
                previewType:   'NONE',
                jpegThumbnail: _thumb.toString('base64'),
                contextInfo:   {
                  forwardingScore: 999,
                  isForwarded:     true,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid:   CHANNEL_JID,
                    newsletterName:  'Kunjungi Saluran Resmi Kami ✨',
                    serverMessageId: 143
                  },
                  quotedMessage: _fk?.message,
                  participant:   _fk?.key?.participant,
                  stanzaId:      _fk?.key?.id,
                  remoteJid:     _fk?.key?.remoteJid
                }
              }
            }, {})
            _lastSentMsg = result || null
            _lastSentJid = jid
            return result
          } catch {}
        }

        if (!isSticker && !isAudio && !opts.quoted) {
          opts = { ...opts, quoted: fkontak }
        }

        const result = await _origSend(jid, content, opts)
        if (!content.react && !content.delete && !content.poll && !content.edit) {
          _lastSentMsg = result || null
          _lastSentJid = jid
        }
        return result
      })()
    }
  })

  const replyFk = async (teks: string) => {
    try {
      return await wrappedMorela.sendMessage(m.chat || '', { text: teks }, { quoted: fkontak })
    } catch {
      return reply(teks)
    }
  }

  const _trackJid = senderJid || m.sender || m.key?.remoteJid || ''
  try { trackCommand(command, _trackJid) } catch {}

  try {
    await h.handler(m, {
      Morela: wrappedMorela,
      conn: wrappedMorela,
      text, args,
      reply: replyFk,
      command,
      isOwn, isPrem, isAdmin, botAdmin,
      downloadContentFromMessage,
      senderJid,
      usedPrefix,
      fkontak
    } as any)

    if (shouldLimit) {
      const limitJid = senderJid || m.sender || m.key?.remoteJid || ''
      addUsage(limitJid, userDailyLimit)
      try {
        const usage   = getUsage(limitJid, userDailyLimit)
        const isHabis = (usage as any).sisa <= 0
        if (isHabis) {
          const quotedRef = _lastSentMsg || m
          await wrappedMorela.sendMessage(
            _lastSentJid || m.chat,
            { text: `⚠️ *Limit harian habis!* (${(usage as any).count}/${userDailyLimit}x) — Reset otomatis 24 jam` },
            { quoted: quotedRef }
          )
        }
      } catch (notifErr: any) {
        console.error('[LIMIT NOTIF] Gagal kirim notif:', notifErr.message)
      }
    }

    return true
  } catch (e) { const err = e as Error
    replyFk(`❌ Error: ${err.message}`)
    console.error(`[Plugin Error] ${command}:`, e)
    try {
      const _own = kvGet<string[]>('own', 'list', [])
      const _jid = _own[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'
      ;((globalThis as Record<string, unknown>).__sock__ as any)?.sendMessage(_jid, {
        text: `⚠️ *Plugin Error*\n\n📌 Command: ${command}\n\n${err.stack || err.message}`.slice(0, 1500)
      })
    } catch {}
    return true
  }
}

export async function runPassiveHandlers(
  m: MsgObj,
  { Morela, isOwn, isPrem, isAdmin, botAdmin, downloadContentFromMessage }: Partial<HandleData> & { Morela: HandleData['Morela']; isOwn: boolean; isPrem: boolean; isAdmin: boolean; botAdmin: boolean }
): Promise<void> {
  if (!m._isJadibot && (((global as Record<string, unknown>).jadibotSessions as Map<string,unknown> | undefined)?.size ?? 0) > 0) {
    const _rawP1 = (m.sender || '')
    let _senderNum = _rawP1.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
    if (_rawP1.endsWith('@lid')) {
      const _rp1 = getPhoneByLid(_senderNum)
      if (_rp1) _senderNum = _rp1.replace(/[^0-9]/g, '')
    }
    if (!isMainOwner(_senderNum)) return
  }

  {
    const _rawP2 = (m.sender || '')
    let _senderNum = _rawP2.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
    if (_rawP2.endsWith('@lid')) {
      const _rp2 = getPhoneByLid(_senderNum)
      if (_rp2) _senderNum = _rp2.replace(/[^0-9]/g, '')
    }
    if (!isMainOwner(_senderNum) && ((((global as Record<string, unknown>).jadibotSessions as Map<string,unknown> | undefined)?.has(_senderNum)) || isJadibot(_senderNum))) {
      console.warn(chalk.red(`[SECURITY] Blocked jadibot sender ${_senderNum} from passive handler`))
      isOwn  = false
      isPrem = false
    }
  }

  let fkontak: any = m
  try { fkontak = await buildFkontakCached(Morela) } catch {}

  const _botJidP = (Morela.user?.id || BOT_JID).replace(/:\d+@/, '@')
  const _botNumP  = _botJidP.split('@')[0]

  const _origSendP = Morela.sendMessage.bind(Morela)

  const wrappedMorelaP = new Proxy(Morela, {
    get(target: any, prop: any) {
      if (prop !== 'sendMessage') return target[prop]
      return (jid: string, content: any, opts: any = {}) => (async () => {
        if (!content || content.react || content.delete || content.poll || content.edit) {
          return _origSendP(jid, content, opts)
        }

        const isSticker    = !!(content?.sticker)
        const isAudio      = !!(content?.audio)
        const isInteractive = !!(content?.interactiveButtons || content?.footer ||
                               content?.hasMediaAttachment === false || content?.buttonText ||
                               content?.sections || content?.listType !== undefined)
        const isText       = !!(content?.text) && !content?.image && !content?.video &&
                             !isAudio && !content?.document && !isSticker && !isInteractive &&
                             !(content?.mentions?.length)

        if (isText) {
          try {
            const _thumbP  = await getDocThumb()
            const _fkP     = opts.quoted ?? fkontak
            return await (Morela as any).relayMessage(jid, {
              extendedTextMessage: {
                text:          `https://google.com\n\n${content.text}`,
                matchedText:   'https://google.com',
                description:   `Owner: ${ownerName}`,
                title:         '',
                previewType:   'NONE',
                jpegThumbnail: _thumbP.toString('base64'),
                contextInfo:   {
                  forwardingScore: 999,
                  isForwarded:     true,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid:   CHANNEL_JID,
                    newsletterName:  'Kunjungi Saluran Resmi Kami ✨',
                    serverMessageId: 143
                  },
                  quotedMessage: _fkP?.message,
                  participant:   _fkP?.key?.participant,
                  stanzaId:      _fkP?.key?.id,
                  remoteJid:     _fkP?.key?.remoteJid
                }
              }
            }, {})
          } catch {}
        }

        if (!isSticker && !isAudio && !opts.quoted) {
          opts = { ...opts, quoted: fkontak }
        }

        return _origSendP(jid, content, opts)
      })()
    }
  })

  for (const { plugin, file } of pluginManager.getPassiveHandlers()) {

    const _passiveKey = path.basename(file).replace(/\.(ts|js)$/, '')
    if (isPluginDisabled(_passiveKey)) continue

    try {
      await plugin.handler(m, {
        Morela: wrappedMorelaP,
        isOwn, isPrem, isAdmin, botAdmin,
        downloadContentFromMessage,
        fkontak
      } as any)
    } catch (error: any) {
      console.error(`[Passive Handler Error] ${file}:`, error.message)
    }
  }
}
