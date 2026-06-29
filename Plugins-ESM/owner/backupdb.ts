import fs       from 'fs'
import path     from 'path'
import axios    from 'axios'
import FormData from 'form-data'
import archiver from 'archiver'
import { botName, ownerName } from '../../Library/utils.js'
import { getTgToken, getTgChatId } from '../../Library/tg_global.js'
import { getMainOwner } from '../../System/mainowner.js'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_FILE  = path.join(DATA_DIR, 'morela.db')

const EXCLUDE = [
  'fkontak_cache.json',
  'lastchat_owner.json',
  'rvo_sent.json',
  'rvo_tg.json',
  'meta-sessions.json',
]

function genZipName() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  return `backupdb-${ts}.zip`
}

function fmtSize(bytes: number) {
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getMainOwnerJid(): string {
  const num = getMainOwner().replace(/[^0-9]/g, '')
  if (!num) return ''
  return num + '@s.whatsapp.net'
}

async function sendToTg(zipBuf: Buffer, zipName: string, caption: string): Promise<boolean> {
  const token  = getTgToken()
  const chatId = getTgChatId()
  if (!token || !chatId) return false
  try {
    const form = new FormData()
    form.append('chat_id', chatId)
    form.append('caption', caption.replace(/[*_`]/g, ''))
    form.append('document', zipBuf, { filename: zipName, contentType: 'application/zip' })
    await axios.post(
      `https://api.telegram.org/bot${token}/sendDocument`,
      form,
      { headers: form.getHeaders(), timeout: 60000 }
    )
    return true
  } catch (e: any) {
    console.error('[BACKUPDB] TG error:', e.message)
    return false
  }
}

async function sendToMainOwnerDM(Morela: any, zipBuf: Buffer, zipName: string, caption: string, reason: string) {
  const ownerJid = getMainOwnerJid()
  if (!ownerJid) { console.error('[BACKUPDB] Main owner JID tidak ditemukan!'); return }
  try {
    await Morela.sendMessage(ownerJid, {
      document: zipBuf,
      fileName: zipName,
      mimetype: 'application/zip',
      caption:  caption + `\n\n⚠️ _${reason}_`
    })
  } catch (e: any) {
    console.error('[BACKUPDB] Gagal kirim ke main owner DM:', e.message)
  }
}

async function sendInteractive(Morela: any, chat: any, headerTitle: string, bodyText: string, fkontak: any) {
  const { generateWAMessageFromContent } = await import('@itsliaaa/baileys')
  const mainOwnerNum = getMainOwner()?.replace(/[^0-9]/g, '')
  const now = new Date()
  const end = new Date(now.getTime() + 10 * 60000)

  const buttons: any[] = []
  if (mainOwnerNum) {
    buttons.push({
      name: 'booking_confirmation',
      buttonParamsJson: JSON.stringify({
        start_datetime:         now.toISOString(),
        end_datetime:           end.toISOString(),
        location:               '🇮🇩Indonesia🇮🇩',
        booking_url:            `https://wa.me/${mainOwnerNum}`,
        phone_number:           mainOwnerNum,
        booking_management_url: `https://wa.me/${mainOwnerNum}`,
        description:
          `*◦ 👤 Name  :*  ${ownerName}\n` +
          `*◦ 👑 Status  :*  _Real Owner_\n`,
        email: '',
        display_text: `👑 ᴍᴀɪɴ ᴏᴡɴᴇʀ`,
        display_content: {
          display_language:                  'id',
          display_meeting_type:              'ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ',
          display_bottom_sheet_header:       '々   P R O F I L E     ◦     I N F O   々',
          display_add_to_calendar_cta_text:  'CALENDAR',
          display_view_on_maps_cta_text:     'O W N E R     ◦     C O U N T R Y',
          display_manage_booking_cta_text:   'Follow for More',
          display_manage_booking_not_supported_text: 'OWNER NOT REGISTERED',
          display_read_more:                 'READ MORE'
        }
      })
    })
  } else {
    buttons.push({
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text: `👑 ᴍᴀɪɴ ᴏᴡɴᴇʀ`,
        url: `https://wa.me/${mainOwnerNum}`,
        merchant_url: `https://wa.me/${mainOwnerNum}`
      })
    })
  }

  const msg = generateWAMessageFromContent(
    chat,
    {
      interactiveMessage: {
        header: { title: headerTitle, hasMediaAttachment: false },
        body:   { text: bodyText },
        footer: { text: `© ${botName}` },
        nativeFlowMessage: { messageParamsJson: '{}', buttons }
      }
    },
    { userJid: mainOwnerNum ? `${mainOwnerNum}@s.whatsapp.net` : Morela.user.id, quoted: fkontak }
  )
  return Morela.relayMessage(chat, msg.message, { messageId: msg.key.id })
}

const handler = async (m: any, { Morela, reply, fkontak }: any) => {
  const start = Date.now()

  let files: string[]
  try {
    files = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json') && !EXCLUDE.includes(f))
  } catch (e: any) {
    return sendInteractive(Morela, m.chat, `B A C K U P D B   ◦   E R R O R`,
      `*乂  ʙᴀᴄᴋᴜᴘᴅʙ   ◦   ɢᴀɢᴀʟ*\n✧ ꜱᴛᴀᴛᴜꜱ : ❌ *Gagal baca folder data/*\n✧ ɪɴꜰᴏ : _${e.message}_`, fkontak)
  }

  const hasDb   = fs.existsSync(DB_FILE)
  const fileCount = files.length + (hasDb ? 1 : 0)

  if (!fileCount) return sendInteractive(Morela, m.chat, `B A C K U P D B   ◦   E R R O R`,
    `*乂  ʙᴀᴄᴋᴜᴘᴅʙ   ◦   ɢᴀɢᴀʟ*\n✧ ꜱᴛᴀᴛᴜꜱ : ❌ *Tidak ada file database ditemukan di data/*`, fkontak)

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
  await sendInteractive(Morela, m.chat,
    `B A C K U P D B   ◦   P R O S E S`,
    `*乂  ʙᴀᴄᴋᴜᴘᴅʙ   ◦   ᴍᴇᴍʙᴜᴀᴛ ʙᴀᴄᴋᴜᴘ*\n` +
    `✧ ꜱᴛᴀᴛᴜꜱ : ⏳ *Membuat backup database...*\n` +
    `✧ ꜰɪʟᴇ : _${fileCount} file ditemukan (${hasDb ? 'morela.db + ' : ''}${files.length} json)_`,
    fkontak
  )

  const zipName = genZipName()

  try {
    const zipBuf: Buffer = await new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const archive = archiver('zip', { zlib: { level: 9 } })
      archive.on('data',  (chunk: Buffer) => chunks.push(chunk))
      archive.on('end',   () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
      for (const f of files) archive.file(path.join(DATA_DIR, f), { name: f })
      if (hasDb) archive.file(DB_FILE, { name: 'morela.db' })
      archive.finalize()
    })

    const size     = fmtSize(zipBuf.length)
    const duration = ((Date.now() - start) / 1000).toFixed(1)
    const hasTg    = !!(getTgToken() && getTgChatId())
    const caption  = `Backup DB ${botName} | ${fileCount} file | ${size} | ${duration}s`

    if (hasTg) {
      await Morela.sendMessage(m.chat, { react: { text: '📤', key: m.key } })
      const tgOk = await sendToTg(zipBuf, zipName, caption)

      if (tgOk) {
        await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        return sendInteractive(Morela, m.chat,
          `B A C K U P D B   ◦   B E R H A S I L`,
          `*乂  ʙᴀᴄᴋᴜᴘᴅʙ   ◦   ꜱᴇʟᴇꜱᴀɪ*\n` +
          `✧ ꜱᴛᴀᴛᴜꜱ : 🟢 *Backup Berhasil*\n` +
          `✧ ᴛᴏᴛᴀʟ : _${fileCount} file_\n` +
          `✧ ꜱɪᴢᴇ  : _${size}_\n` +
          `✧ ᴡᴀᴋᴛᴜ : _${duration}s_\n` +
          `✧ ɪɴꜰᴏ  : _Terkirim ke Telegram_`,
          fkontak
        )
      }

      console.warn('[BACKUPDB] TG gagal, fallback ke DM main owner')
      await sendToMainOwnerDM(Morela, zipBuf, zipName, caption, 'Telegram gagal — file dikirim ke DM kamu')
      await Morela.sendMessage(m.chat, { react: { text: '⚠️', key: m.key } })
      return sendInteractive(Morela, m.chat,
        `B A C K U P D B   ◦   W A R N I N G`,
        `*乂  ʙᴀᴄᴋᴜᴘᴅʙ   ◦   ᴛᴇʟᴇɢʀᴀᴍ ɢᴀɢᴀʟ*\n` +
        `✧ ꜱᴛᴀᴛᴜꜱ : ⚠️ *Telegram gagal*\n` +
        `✧ ɪɴꜰᴏ : _File dikirim ke DM main owner_`,
        fkontak
      )
    }

    await sendToMainOwnerDM(Morela, zipBuf, zipName, caption, 'TG belum disetup — setup: .tgbot token & .tgbot id')
    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
    return sendInteractive(Morela, m.chat,
      `B A C K U P D B   ◦   B E R H A S I L`,
      `*乂  ʙᴀᴄᴋᴜᴘᴅʙ   ◦   ꜱᴇʟᴇꜱᴀɪ*\n` +
      `✧ ꜱᴛᴀᴛᴜꜱ : 🟢 *Backup Berhasil*\n` +
      `✧ ᴛᴏᴛᴀʟ : _${fileCount} file_\n` +
      `✧ ꜱɪᴢᴇ  : _${size}_\n` +
      `✧ ᴡᴀᴋᴛᴜ : _${duration}s_\n` +
      `✧ ɪɴꜰᴏ  : _File dikirim ke DM main owner_`,
      fkontak
    )

  } catch (e: any) {
    console.error('[BACKUPDB]', e)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return sendInteractive(Morela, m.chat,
      `B A C K U P D B   ◦   E R R O R`,
      `*乂  ʙᴀᴄᴋᴜᴘᴅʙ   ◦   ɢᴀɢᴀʟ*\n` +
      `✧ ꜱᴛᴀᴛᴜꜱ : ❌ *Backup Gagal*\n` +
      `✧ ɪɴꜰᴏ : _${e.message}_`,
      fkontak
    )
  }
}

handler.command  = ['backupdb', 'dbbackup', 'backupdata']
handler.tags     = ['owner']
handler.help     = ['backupdb']
handler.noLimit  = true
handler.owner    = true
handler.premium  = false
handler.group    = false
handler.private  = false
handler.admin    = false
handler.botAdmin = false

export default handler
