import fs from 'fs'
import { bi, buildFkontak, sendCard, menuBuf as defaultMenuBuf, CHANNEL_URL, imagePath, botName } from '../../Library/utils.js'
import { getUser, setPremium } from '../../Database/db.js'
import { invalidatePremiumCache } from '../../Morela.js'
import * as baileys from '@itsliaaa/baileys'
import { isMainOwner, resolveTarget, normNum } from '../../Library/resolve.js'
import { kvGet, kvSet } from '../../Database/kvstore.js'

const { proto, generateWAMessageFromContent } = baileys

function readPrems() {
  try { return kvGet<unknown[]>('prem', 'list', []) } catch { return [] }
}

function savePrems(prems: unknown) {
  kvSet('prem', 'list', prems)
  global.premium = [...(prems as unknown[])]
}

function resolveNumber(m: Record<string, unknown>, args: string[], argIndex = 0): string | null {
  if (args[argIndex]) return normNum(args[argIndex]) || null
  const { jid } = resolveTarget(m, args, { argIndex })
  return jid ? normNum(jid) : null
}

const handler = async (m: any, { Morela, command, args, fkontak }: any) => {
  const imgBuf  = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : defaultMenuBuf
  const send    = (text) => sendCard(Morela, m.chat, text + `\n\n© ${botName}`, imgBuf, fkontak)

  if (!isMainOwner(m)) return send(`❌ Fitur ini hanya untuk Main Owner!`)

  let prems = readPrems()

  if (command === 'premium') {
    return send(
`╭──「 💎 *Premium Panel* 」
│
│  📋 *Manajemen Premium:*
│  ┌─────────────────────
│  │ .addprem  → Tambah premium
│  │ .delprem  → Hapus premium
│  │ .listprem → Daftar premium
│  └─────────────────────
│
│  📌 *Cara Input Nomor:*
│  ┌─────────────────────
│  │ Ketik nomor langsung
│  │ Mention contact
│  │ Reply pesan orangnya
│  └─────────────────────
│
│  📊 Premium aktif: *${prems.length} akun*
│
╰─────────────────────`
    )
  }

  if (command === 'listprem' || command === 'listpremium') {
    if (prems.length === 0) {
      return send(
        `💎 *PREMIUM LIST*\n\n` +
        `📭 Belum ada user premium!\n\n` +
        `Tambahkan dengan:\n.addprem <nomor>`
      )
    }

    for (let i = 0; i < prems.length; i++) {
      const num   = prems[i]
      const waUrl = `https://wa.me/${num}`
      const user  = getUser(num + '@s.whatsapp.net')
      const nama  = user?.name || 'User'

      const imageMessage = await (async () => {
        const { generateWAMessageContent } = baileys
        const { imageMessage } = await generateWAMessageContent(
          { image: imgBuf },
          { upload: Morela.waUploadToServer }
        )
        return imageMessage
      })()

      const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
            interactiveMessage: proto.Message.InteractiveMessage.fromObject({
              body:   proto.Message.InteractiveMessage.Body.fromObject({ text: ' ' }),
              footer: proto.Message.InteractiveMessage.Footer.fromObject({
                text:
                  `💎 *Premium ${i + 1}*\n\n` +
                  `📛 Nama  : ${nama}\n` +
                  `📱 Nomor : +${num}\n` +
                  `🤖 Bot   : ${botName}\n\n` +
                  `© ${botName}`
              }),
              header: proto.Message.InteractiveMessage.Header.fromObject({
                title: `💎 Premium ${i + 1} — ${botName}`,
                hasMediaAttachment: true,
                imageMessage
              }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [
                  {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                      display_text: `💬 Chat User ${i + 1}`,
                      url:          waUrl,
                      merchant_url: waUrl
                    })
                  },
                  {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                      display_text: 'Channel',
                      url:          CHANNEL_URL,
                      merchant_url: CHANNEL_URL
                    })
                  }
                ]
              })
            })
          }
        }
      }, { quoted: fkontak || m })

      await Morela.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    }
    return
  }

  if (command === 'addprem' || command === 'addpremium') {
    const number = resolveNumber(m, args, 0)

    if (!number || number.length < 10) return send(
      `❌ *Format Salah!*\n\n` +
      `Cara pakai:\n` +
      `┌─────────────────────\n` +
      `│ .addprem 628xxx\n` +
      `│ .addprem @mention\n` +
      `│ Reply pesan + .addprem\n` +
      `└─────────────────────`
    )

    if (prems.includes(number)) return send(
      `⚠️ *Sudah Premium!*\n\n` +
      `Nomor +${number}\n` +
      `sudah terdaftar sebagai premium.`
    )

    prems.push(number)
    try {
      savePrems(prems)
      invalidatePremiumCache()

      setPremium(number + '@s.whatsapp.net', 1)
      return send(
        `✅ *Premium Ditambahkan!*\n\n` +
        `📱 Nomor  : +${number}\n` +
        `💎 Status : Premium Aktif\n` +
        `📊 Total  : ${prems.length} user\n\n` +
        `User sudah bisa pakai fitur premium!`
      )
    } catch (e) {
      return send(`❌ Gagal menyimpan:\n${(e as Error).message}`)
    }
  }

  if (command === 'delprem' || command === 'delpremium') {
    const number = resolveNumber(m, args, 0)

    if (!number || number.length < 10) return send(
      `❌ *Format Salah!*\n\n` +
      `Cara pakai:\n` +
      `┌─────────────────────\n` +
      `│ .delprem 628xxx\n` +
      `│ .delprem @mention\n` +
      `│ Reply pesan + .delprem\n` +
      `└─────────────────────`
    )

    const index = prems.indexOf(number)
    if (index === -1) return send(
      `⚠️ *Tidak Ditemukan!*\n\n` +
      `Nomor +${number}\n` +
      `tidak terdaftar sebagai premium.\n\n` +
      `Cek daftar dengan .listprem`
    )

    prems.splice(index, 1)
    try {
      savePrems(prems)
      invalidatePremiumCache()

      setPremium(number + '@s.whatsapp.net', 0)
      return send(
        `🗑️ *Premium Dicabut!*\n\n` +
        `📱 Nomor  : +${number}\n` +
        `💎 Status : Dicabut\n` +
        `📊 Sisa   : ${prems.length} user\n\n` +
        `Akses premium telah dicabut!`
      )
    } catch (e) {
      return send(`❌ Gagal menyimpan:\n${(e as Error).message}`)
    }
  }
}

handler.command = ['premium', 'addprem', 'addpremium', 'delprem', 'delpremium', 'listprem', 'listpremium']
handler.mainOwner = true
handler.tags    = ['owner']
handler.help    = ['premium', 'addprem <nomor>', 'delprem <nomor>', 'listprem']
handler.noLimit = true

export default handler
