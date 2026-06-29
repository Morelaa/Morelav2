import fs   from 'fs'
import { buildFkontak, menuBuf, imagePath, CHANNEL_URL, OWNER_WA, botName } from '../../Library/utils.js'
import { kvGet, kvSet } from '../../Database/kvstore.js'

const DEFAULT_PAY = { dana: '', gopay: '', bca: '', atas: '' }

function readPay() {
  try {
    const saved = kvGet<Record<string, string>>('payment', 'config', {})
    return { ...DEFAULT_PAY, ...saved }
  } catch {}
  return { ...DEFAULT_PAY }
}

function savePay(data: unknown) {
  kvSet('payment', 'config', data)
}

function waThumb() {
  return {
    externalAdReply: {
      body:                  botName,
      thumbnail:             fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : undefined,
      sourceUrl:             'https://www.whatsapp.com',
      mediaType:             2,
      renderLargerThumbnail: false,
      showAdAttribution:     false
    }
  }
}

const handler = async (m: any, { Morela, reply, command, args, isOwn, usedPrefix, fkontak }: any) => {

  const pay = readPay()

  if (command === 'setpay') {
    if (!isOwn) return reply('❌ Owner only!')

    const method  = args[0]?.toLowerCase()
    const value   = args.slice(1).join(' ').trim()
    const allowed = ['dana', 'gopay', 'bca', 'atas']

    if (!method || !allowed.includes(method)) {
      await Morela.relayMessage(m.chat, {
        interactiveMessage: {
          header: { hasMediaAttachment: false },
          body: {
            text:
              `╭──「 💳 *Set Payment* 」\n` +
              `│\n` +
              `│  📌 *Format:*\n` +
              `│  ${usedPrefix}setpay dana  <nomor>\n` +
              `│  ${usedPrefix}setpay gopay <nomor>\n` +
              `│  ${usedPrefix}setpay bca   <nomor>\n` +
              `│  ${usedPrefix}setpay atas  <nama penerima>\n` +
              `│\n` +
              `│  📋 *Konfigurasi saat ini:*\n` +
              `│  DANA  : ${pay.dana  || '❌ Belum diset'}\n` +
              `│  GoPay : ${pay.gopay || '❌ Belum diset'}\n` +
              `│  BCA   : ${pay.bca   || '❌ Belum diset'}\n` +
              `│  Atas  : ${pay.atas  || '❌ Belum diset'}\n` +
              `│\n` +
              `╰─────────────────────`
          },
          footer: { text: `© ${botName}` },
          contextInfo: { forwardingScore: 1, isForwarded: true, quotedMessage: (fkontak || m)?.message },
          nativeFlowMessage: {
            buttons: [{
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({ display_text: 'Chat Owner', url: OWNER_WA, merchant_url: OWNER_WA })
            }]
          }
        }
      }, { messageId: Morela.generateMessageTag() })
      return
    }

    if (!value) return reply(`❌ Nilai tidak boleh kosong!\n\nContoh: ${usedPrefix}setpay ${method} 08xxxxxxxxx`)

    pay[method] = value
    savePay(pay)

    return reply(
      `✅ *Berhasil diset!*\n\n` +
      `📌 Metode : *${method.toUpperCase()}*\n` +
      `💬 Nilai  : *${value}*\n\n` +
      `Ketik *${usedPrefix}pay* untuk melihat hasilnya.`
    )
  }

  const adaMetode = pay.dana || pay.gopay || pay.bca

  if (!adaMetode) {
    return reply(
      `❌ *Info pembayaran belum diset!*\n\n` +
      `Owner silakan setup dulu:\n` +
      `${usedPrefix}setpay dana  08xxxxxxxxx\n` +
      `${usedPrefix}setpay gopay 08xxxxxxxxx\n` +
      `${usedPrefix}setpay bca   1234567890`
    )
  }

  const buttons = []

  if (pay.dana) {
    buttons.push({
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify({
        display_text: `💙 DANA${pay.atas ? ' — ' + pay.atas : ''}`,
        copy_code:    pay.dana
      })
    })
  }

  if (pay.gopay) {
    buttons.push({
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify({
        display_text: `💚 GoPay${pay.atas ? ' — ' + pay.atas : ''}`,
        copy_code:    pay.gopay
      })
    })
  }

  if (pay.bca) {
    buttons.push({
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify({
        display_text: `💛 BCA — ${pay.bca}`,
        copy_code:    pay.bca
      })
    })
  }

  buttons.push({
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({
      display_text: 'Channel',
      url:          CHANNEL_URL,
      merchant_url: CHANNEL_URL
    })
  })

  let footerText =
    `╭──「 💳 *INFORMASI PEMBAYARAN* 」\n` +
    `│\n` +
    `│  Pilih metode pembayaran di bawah:\n` +
    `│\n`

  if (pay.atas)  footerText += `│  👤 A/N   : *${pay.atas}*\n│\n`
  if (pay.dana)  footerText += `│  💙 DANA  : *${pay.dana}*\n`
  if (pay.gopay) footerText += `│  💚 GoPay : *${pay.gopay}*\n`
  if (pay.bca)   footerText += `│  💛 BCA   : *${pay.bca}*\n`

  footerText +=
    `│\n` +
    `│  > _Konfirmasi ke owner setelah transfer._\n` +
    `│\n` +
    `╰─────────────────────\n` +
    `_Tekan tombol untuk menyalin nomor_\n` +
    `© ${botName}`

  await Morela.relayMessage(m.chat, {
    interactiveMessage: {
      header: { hasMediaAttachment: false },
      body:   { text: footerText },
      footer: { text: `© ${botName}` },
      contextInfo: { forwardingScore: 1, isForwarded: true, quotedMessage: (fkontak || m)?.message },
      nativeFlowMessage: { buttons }
    }
  }, { messageId: Morela.generateMessageTag() })
}

handler.command = ['pay', 'payment', 'setpay']
handler.tags    = ['owner', 'tools']
handler.help    = ['pay', 'setpay <metode> <nilai>']
handler.noLimit = true
handler.owner   = false

export default handler