import * as baileys from '@itsliaaa/baileys'
import pino    from 'pino'
import fs      from 'fs'
import path    from 'path'
import { botName } from '../../Library/utils.js'
import { addJadibot, removeJadibot, isJadibot, listJadibot } from '../../Library/jadibotdb.js'
import { isMainOwner } from '../../Library/resolve.js'
import { kvGet } from '../../Database/kvstore.js'

const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  jidNormalizedUser
} = baileys

if (!global.jadibotSessions) global.jadibotSessions = new Map()

const MAX_JADIBOT_SESSIONS = 5

const sessionDir = (nomor) =>
  path.join(process.cwd(), 'sessions', 'jadibot', nomor)

const cleanNumber = (text) => text.replace(/[^0-9]/g, '')

async function spawnJadibot(nomor: unknown, sendMsg: unknown, m: Record<string, unknown>, chatJid: unknown) {
  const dir = sessionDir(nomor)
  fs.mkdirSync(dir, { recursive: true })

  addJadibot(nomor)

  const { state, saveCreds } = await useMultiFileAuthState(dir)
  const { version }          = await fetchLatestBaileysVersion()

  const conn = makeWASocket({
    logger:             pino({ level: 'silent' }),
    printQRInTerminal:  false,
    version,
    auth:               state,
    browser:            ['Ubuntu', 'Chrome', '114.0.5735.198'],
    syncFullHistory:    false,
    getMessage:         async () => undefined
  })

  let stopped = false

  const { jidDecode: _jidDecode } = baileys
  conn.decodeJid = (jid) => {
    if (!jid) return jid
    if (/:\d+@/gi.test(jid)) {
      const decode = _jidDecode(jid) || {}
      return decode.user && decode.server ? decode.user + '@' + decode.server : jid
    }
    return jid
  }

  if (!conn.authState.creds.registered) {
    try {
      await new Promise(r => setTimeout(r, 2000))
      const code      = await conn.requestPairingCode(nomor, "MORELAXZ")
      const formatted = code?.match(/.{1,4}/g)?.join('-') || code

      const _sock = (globalThis as Record<string, unknown>).__sock__
      const { generateWAMessageFromContent } = await import('@itsliaaa/baileys')
      const { getMainOwner } = await import('../../System/mainowner.js')
      const mainOwnerNum = getMainOwner()

      const pairingMsg = generateWAMessageFromContent(
        chatJid,
        {
          interactiveMessage: {
            header: {
              title: `J A D I B O T   ◦   P A I R I N G`,
              hasMediaAttachment: false
            },
            body: {
              text:
                `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ᴋᴏᴅᴇ ᴘᴀɪʀɪɴɢ*\n` +
                `✧ ɴᴏᴍᴏʀ : _+${nomor}_\n` +
                `✧ ᴋᴏᴅᴇ : *${formatted}*\n\n` +
                `*📋 ᴄᴀʀᴀ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ ᴋᴏᴅᴇ:*\n` +
                `*1️⃣* Salin kode di atas lalu buka WA nomor *+${nomor}*\n` +
                `*2️⃣* Klik titik tiga *( ⋮ )* pojok kanan atas\n` +
                `*3️⃣* Buka *Perangkat Tertaut*\n` +
                `*4️⃣* Klik *Tautkan Perangkat*\n` +
                `*5️⃣* Klik *Tautkan dengan nomor telepon saja*\n` +
                `*6️⃣* Masukkan kode yang sudah disalin\n\n` +
                `⏳ _Kode berlaku 60 detik!_`
            },
            footer: {
              text: `© ${botName}`
            },
            nativeFlowMessage: {
              messageParamsJson: '{}',
              buttons: [
                {
                  name: 'cta_copy',
                  buttonParamsJson: JSON.stringify({
                    display_text: `Salin Kode : ${formatted}`,
                    copy_code: formatted
                  })
                }
              ]
            }
          }
        },
        { userJid: _sock.user.id }
      )
      await _sock.relayMessage(chatJid, pairingMsg.message, { messageId: pairingMsg.key.id })
    } catch (e) {
      await sendMsg(
        `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ɢᴀɢᴀʟ*\n` +
        `✧ ꜱᴛᴀᴛᴜꜱ : ❌ *ɢᴀɢᴀʟ ʀᴇQᴜᴇꜱᴛ ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ*\n` +
        `✧ ɪɴꜰᴏ : _${(e as Error).message}_\n` +
        `© ${botName}`
      )

      removeJadibot(nomor)
      fs.rmSync(dir, { recursive: true, force: true })
      return null
    }
  }

  conn.ev.on('creds.update', saveCreds)

  conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'open') {
      const botNum = conn.user?.id?.split(':')[0] || nomor

      addJadibot(nomor)
      await sendMsg(
        `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ᴛᴇʀʜᴜʙᴜɴɢ*\n` +
        `✧ ꜱᴛᴀᴛᴜꜱ : 🟢 *ʙᴇʀʜᴀꜱɪʟ ᴛᴇʀʜᴜʙᴜɴɢ*\n` +
        `✧ ɴᴏᴍᴏʀ : _+${botNum}_\n` +
        `✧ ɪɴꜰᴏ : _Gunakan .stopbot ${nomor} untuk menghentikannya_\n` +
        `© ${botName}`
      )
    }

    if (connection === 'close') {
      const code   = lastDisconnect?.error?.output?.statusCode
      const logout = code === DisconnectReason.loggedOut

      const safeNotify = async (teks) => {
        try {
          const _main = (globalThis as Record<string, unknown>).__sock__
          if (_main) await _main.sendMessage(chatJid, { text: teks })
        } catch {}
      }

      if (stopped || logout) {
        removeJadibot(nomor) 
        global.jadibotSessions.delete(nomor)
        if (logout) {
          fs.rmSync(dir, { recursive: true, force: true })
          await safeNotify(
            `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ʟᴏɢᴏᴜᴛ*\n` +
            `✧ ꜱᴛᴀᴛᴜꜱ : ⚠️ *ꜱᴇꜱɪ ᴅɪʜᴀᴘᴜꜱ*\n` +
            `✧ ɴᴏᴍᴏʀ : _+${nomor} logout_\n` +
            `✧ ɪɴꜰᴏ : _Sesi dihapus otomatis_\n` +
            `© ${botName}`
          )
        }
      } else {

        setTimeout(() => spawnJadibot(nomor, safeNotify, null, chatJid), 5000)
      }
    }
  })

  conn.ev.on('messages.upsert', async (update) => {

    if (update.type !== 'notify') {
      const _tmp = update.messages?.[0]
      const _isSelf = _tmp?.key?.fromMe && !_tmp?.key?.remoteJid?.endsWith('@g.us')
      if (update.type !== 'append' || !_isSelf) return
    }

    let mek = update.messages[0]
    if (!mek?.message) return
    if (mek.key.fromMe && mek.key.remoteJid?.endsWith('@g.us')) return
    if (mek.key?.remoteJid === 'status@broadcast') return

    const _outerKey = Object.keys(mek.message)[0]
    if (_outerKey === 'deviceSentMessage') {
      mek.message = mek.message.deviceSentMessage?.message || mek.message
    } else if (_outerKey === 'ephemeralMessage') {
      mek.message = mek.message.ephemeralMessage?.message || mek.message
    }

    try {
      const { default: morelaHandler } = await import('../../Morela.js')
      const { smsg }                   = await import('../../System/message.js')

      const store = global.jadibotSessions.get(nomor)?.store || { messages: {}, groupMetadata: {} }
      const sMsg  = smsg(conn, mek, store)

      sMsg._isJadibot        = true
      sMsg._jadibotOwnerNomor = nomor  

      await morelaHandler(conn, sMsg, update, store).catch((e: unknown) => {
        console.error(`[JADIBOT-${nomor}] morelaHandler error:`, (e as Error).message)
      })
    } catch (e) {
      console.error(`[JADIBOT-${nomor}] upsert error:`, (e as Error).message)
    }
  })

  const session = {
    conn,
    store:     { messages: {}, groupMetadata: {}, contacts: {} },
    startedAt: Date.now(),
    stop: async () => {
      stopped = true
      try { await conn.logout() } catch { conn.end() }
      removeJadibot(nomor) 
      global.jadibotSessions.delete(nomor)
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }

  global.jadibotSessions.set(nomor, session)
  return session
}

const handler = async (m: any, { Morela, conn, reply, text, fkontak }: any) => {
  conn = conn || Morela

  const sendInteractive = async (headerTitle: string, bodyText: string) => {
    const { generateWAMessageFromContent } = await import('@itsliaaa/baileys')

    const msg = generateWAMessageFromContent(
      m.chat,
      {
        interactiveMessage: {
          header: {
            title: headerTitle,
            hasMediaAttachment: false
          },
          body: {
            text: bodyText
          },
          footer: {
            text: `© ${botName}`
          },
          nativeFlowMessage: {
            messageParamsJson: '{}',
            buttons: []
          }
        }
      },
      { userJid: Morela.user.id, quoted: fkontak || m }
    )

    await Morela.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  }

  if (m._isJadibot) {
    return sendInteractive(
      '𝗝 𝗔 𝗗 𝗜 𝗕 𝗢 𝗧   ◦   𝗘 𝗥 𝗥 𝗢 𝗥',
      `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ᴅɪᴛᴏʟᴀᴋ*\n` +
      `✧ ꜱᴛᴀᴛᴜꜱ : ❌ *ᴛɪᴅᴀᴋ ʙɪꜱᴀ ꜱᴘᴀᴡɴ ᴊᴀᴅɪʙᴏᴛ ᴅᴀʀɪ ᴊᴀᴅɪʙᴏᴛ!*\n` +
      `✧ ɪɴꜰᴏ : _Gunakan bot utama untuk menjalankan .jadibot_`
    )
  }

  if (!text) return sendInteractive(
    '𝗝 𝗔 𝗗 𝗜 𝗕 𝗢 𝗧   ◦   𝗜 𝗡 𝗙 𝗢',
    `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ɪɴꜰᴏ*\n` +
    `✧ ɪɴꜰᴏ : _Jadikan nomor WA lain sebagai bot!_\n` +
    `✧ ꜰᴏʀᴍᴀᴛ : _.jadibot 628xxxxxxxxxx_\n` +
    `✧ ᴄᴏɴᴛᴏʜ : _.jadibot 628999889149_`
  )

  const nomor = cleanNumber(text)
  if (nomor.length < 8) return sendInteractive(
    '𝗝 𝗔 𝗗 𝗜 𝗕 𝗢 𝗧   ◦   𝗘 𝗥 𝗥 𝗢 𝗥',
    `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ɴᴏᴍᴏʀ ɪɴᴠᴀʟɪᴅ*\n` +
    `✧ ꜱᴛᴀᴛᴜꜱ : ❌ *ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n` +
    `✧ ɪɴꜰᴏ : _Gunakan format: 628xxxxxxxxxx_`
  )

  if (global.jadibotSessions?.has(nomor) || isJadibot(nomor)) return sendInteractive(
    '𝗝 𝗔 𝗗 𝗜 𝗕 𝗢 𝗧   ◦    𝗔 𝗞 𝗧 𝗜 𝗙',
    `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ꜱᴛᴀᴛᴜꜱ*\n` +
    `✧ ꜱᴛᴀᴛᴜꜱ : 🔴 *ꜱᴜᴅᴀʜ ʙᴇʀᴊᴀʟᴀɴ*\n` +
    `✧ ɴᴏᴍᴏʀ : _+${nomor}_\n` +
    `✧ ɪɴꜰᴏ : _Gunakan .stopbot ${nomor} untuk menghentikannya_`
  )

  try {
    const _owners = kvGet<string[]>('own', 'list', [])
    if (_owners.length) {
      if (_owners.map((n: unknown) => n.replace(/[^0-9]/g, '')).includes(nomor) && !isMainOwner(nomor)) {
        return sendInteractive(
          '𝗝 𝗔 𝗗 𝗜 𝗕 𝗢 𝗧   ◦   𝗗 𝗜 𝗧 𝗢 𝗟 𝗔 𝗞',
          `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ʀɪꜱɪᴋᴏ ᴋᴇᴀᴍᴀɴᴀɴ*\n` +
          `✧ ꜱᴛᴀᴛᴜꜱ : 🚫 *ᴅɪᴛᴏʟᴀᴋ!*\n` +
          `✧ ɴᴏᴍᴏʀ : _+${nomor} terdaftar sebagai Owner!_\n` +
          `✧ ɪɴꜰᴏ : _Hapus dulu dengan .delowner ${nomor}, lalu ulangi .jadibot_`
        )
      }
    }
  } catch (_) {}

  if (listJadibot().length >= MAX_JADIBOT_SESSIONS) {
    return sendInteractive(
      '𝗝 𝗔 𝗗 𝗜 𝗕 𝗢 𝗧   ◦    𝗕 𝗔 𝗧 𝗔 𝗦',
      `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ʟɪᴍɪᴛ*\n` +
      `✧ ꜱᴛᴀᴛᴜꜱ : ❌ *ʙᴀᴛᴀꜱ ᴊᴀᴅɪʙᴏᴛ ᴛᴇʀᴄᴀᴘᴀɪ*\n` +
      `✧ ᴍᴀᴋꜱɪᴍᴀʟ : _${MAX_JADIBOT_SESSIONS} jadibot aktif sekaligus_\n` +
      `✧ ɪɴꜰᴏ : _Gunakan .listbot / .stopbot <nomor> untuk kelola sesi_`
    )
  }

  await sendInteractive(
    '𝗝 𝗔 𝗗 𝗜 𝗕 𝗢 𝗧   ◦    𝗣 𝗥 𝗢 𝗦 𝗘 𝗦',
    `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ᴍᴇᴍᴜʟᴀɪ*\n` +
    `✧ ꜱᴛᴀᴛᴜꜱ : ⏳ *ꜱᴇᴅᴀɴɢ ᴅɪᴘʀᴏꜱᴇꜱ*\n` +
    `✧ ɴᴏᴍᴏʀ : _+${nomor}_\n` +
    `✧ ɪɴꜰᴏ : _Tunggu kode pairing dikirim..._`
  )

  const sendMsg = (teks) => conn.sendMessage(m.chat, { text: teks }, { quoted: fkontak || m })

  try {
    await spawnJadibot(nomor, sendMsg, m, m.chat)
  } catch (e) {
    sendInteractive(
      '𝗝 𝗔 𝗗 𝗜 𝗕 𝗢 𝗧   ◦    𝗚 𝗔 𝗚 𝗔 𝗟',
      `*乂  ᴊᴀᴅɪʙᴏᴛ   ◦   ᴇʀʀᴏʀ*\n` +
      `✧ ꜱᴛᴀᴛᴜꜱ : ❌ *ɢᴀɢᴀʟ ᴍᴇɴᴊᴀʟᴀɴᴋᴀɴ ᴊᴀᴅɪʙᴏᴛ*\n` +
      `✧ ɪɴꜰᴏ : _${(e as Error).message}_`
    )
  }
}

handler.command = ['jadibot']
handler.owner   = true
handler.noLimit = true
handler.tags    = ['owner']
handler.help    = ['jadibot <nomor>']

export { spawnJadibot }
export default handler
