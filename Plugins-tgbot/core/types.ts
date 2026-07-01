// ─── Tipe bersama untuk Telegram plugin system ──────────────────────────────
// Sama seperti Plugins-ESM (WA), tiap fitur tgbot sekarang jadi 1 file plugin
// yang di-load otomatis oleh _pluginmanager.ts.

export interface TgApiResult {
  result?: unknown
}

export interface TgUpdate {
  update_id:       number
  message?:        TgMessage
  callback_query?: TgCallbackQuery
}

export interface TgPhotoSize {
  file_id:   string
  file_size: number
}

export interface TgMessage {
  chat:              { id: number }
  from?:             { id: number }
  text?:             string
  caption?:          string
  photo?:            TgPhotoSize[]
  message_id?:       number
  reply_to_message?: TgMessage
}

export interface TgCallbackQuery {
  id:       string
  from?:    { id: number }
  message?: { chat: { id: number }; message_id?: number }
  data?:    string
}

// Context yang dikirim ke tiap plugin handler — supaya plugin tidak perlu
// tahu detail internal polling/offset dsb, cukup pakai yang relevan saja.
export interface TgContext {
  from:     number | undefined
  isOwner:  boolean
  raw:      TgMessage
}

// Kontrak wajib tiap file di Plugins-tgbot/**/*.ts
export interface TgPlugin {
  /** Command utama + alias, tanpa slash. Contoh: ['tiktok', 'tt'] */
  command: string[]
  /** Kategori untuk grouping di menu (owner|image|downloader|menu) */
  category: 'owner' | 'image' | 'downloader' | 'menu'
  /** Kalau true, hanya owner yang boleh menjalankan */
  owner: boolean
  /** Kalau true, command TIDAK ditampilkan di /start atau Menu Lengkap
   *  (contoh: /start dan /menu sendiri tidak perlu muncul sebagai baris menu) */
  hidden?: boolean
  /** Kalau true, command HANYA boleh dijalankan lewat tombol inline —
   *  kalau diketik manual sebagai text/caption, akan ditolak dengan pesan
   *  "Command tidak dikenal". Dipakai untuk hd/hdv1/hdv2/removebg/removewm. */
  buttonOnly?: boolean
  /** Teks singkat untuk baris menu, contoh: '/tiktok <url> — Download TikTok' */
  help?: string
  /** Handler eksekusi command */
  handler: (chatId: number | string, args: string, ctx: TgContext) => Promise<void>
}
