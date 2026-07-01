// ─── Plugin manager untuk Telegram bot ──────────────────────────────────────
// Mengikuti pola yang sama dengan Plugins-ESM/_pluginmanager.ts (WA bot):
// tiap fitur = 1 file, di-scan otomatis, tidak perlu didaftarkan manual.

import fs   from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { logger } from '../System/logger.js'
import type { TgPlugin } from './core/types.js'

const __dirname   = path.dirname(fileURLToPath(import.meta.url as string))
const PLUGINS_DIR = __dirname
const EXT         = path.extname(fileURLToPath(import.meta.url as string)) // .ts saat dev, .js saat build
const MANAGER_FILE = path.basename(fileURLToPath(import.meta.url as string))

class TgPluginManager {
  commands: Map<string, TgPlugin> = new Map()
  all:      TgPlugin[]            = []

  private scan(dir: string): string[] {
    const results: string[] = []
    let items: fs.Dirent[]
    try { items = fs.readdirSync(dir, { withFileTypes: true }) } catch { return results }
    for (const item of items) {
      if (item.name.startsWith('_') || item.name === 'core') continue
      const full = path.join(dir, item.name)
      if (item.isDirectory()) results.push(...this.scan(full))
      else if (item.name.endsWith(EXT) && item.name !== MANAGER_FILE) results.push(full)
    }
    return results
  }

  async loadAll(): Promise<void> {
    this.commands.clear()
    this.all = []
    const files = this.scan(PLUGINS_DIR)
    for (const filepath of files) {
      try {
        const url          = pathToFileURL(filepath).href + `?v=${Date.now()}`
        const { default: plugin } = await import(url) as { default: TgPlugin }
        if (!plugin?.command?.length || typeof plugin.handler !== 'function') {
          logger.warn('tgbot', `Plugin invalid dilewati: ${path.relative(PLUGINS_DIR, filepath)}`)
          continue
        }
        this.all.push(plugin)
        for (const cmd of plugin.command) this.commands.set(cmd.toLowerCase(), plugin)
      } catch (e) {
        logger.warn('tgbot', `Gagal load plugin ${path.relative(PLUGINS_DIR, filepath)}: ${(e as Error).message}`)
      }
    }
    logger.success('tgbot', `${this.all.length} plugin dimuat, ${this.commands.size} command aktif`)
  }

  get(command: string): TgPlugin | undefined {
    return this.commands.get(command.toLowerCase())
  }

  /** Plugin yang boleh ditampilkan di menu (tidak hidden), difilter public/owner */
  listForMenu(isOwner: boolean): TgPlugin[] {
    return this.all.filter(p => !p.hidden && (isOwner || !p.owner))
  }
}

export const tgPlugins = new TgPluginManager()
