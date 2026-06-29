const handler = async (m: any, { Morela, command, args, reply, fkontak }: any) => {

  if (!m.quoted) {
    return reply(
      `❌ *Harus reply pesan dulu!*\n\n` +
      `Cara pakai:\n` +
      `• Reply pesan → ketik *.crm*\n` +
      `• Reply pesan → ketik *.crm <jid>* (kirim ke chat lain)\n` +
      `• Reply pesan → ketik *.rawjson* (lihat raw JSON)\n\n` +
      `_Mendukung: button, media, sticker, text, dll_`
    )
  }

  const ctxInfo = m.msg?.contextInfo
  const rawQuotedMessage: Record<string, unknown> | null =
    ctxInfo?.quotedMessage ?? null

  if (!rawQuotedMessage) {
    return reply(
      `❌ Tidak dapat mengambil raw message.\n` +
      `Coba gunakan *.rawjson* untuk melihat struktur quoted.`
    )
  }

  if (command === 'rawjson' || command === 'rawijson') {
    const json = JSON.stringify(rawQuotedMessage, null, 2)
    if (json.length > 3500) {
      await Morela.sendMessage(m.chat, {
        document: Buffer.from(json),
        mimetype: 'application/json',
        fileName: `${Date.now()}.json`,
        caption: `📄 *Raw Quoted Message JSON*\n\nmtype: \`${m.quoted?.mtype ?? 'unknown'}\`\nsize: ${json.length} chars`
      }, { quoted: fkontak || m })
    } else {
      await reply(
        `📄 *Raw Quoted Message*\n` +
        `mtype: \`${m.quoted?.mtype ?? 'unknown'}\`\n\n` +
        `\`\`\`json\n${json}\n\`\`\``
      )
    }
    return
  }

  let targetJid: string = m.chat
  if (args[0]) {
    const argJid = args[0].trim()
    if (/^\d+$/.test(argJid)) {
      targetJid = `${argJid}@s.whatsapp.net`
    } else if (/^\d+@/.test(argJid) || argJid.includes('@g.us') || argJid.includes('@newsletter')) {
      targetJid = argJid
    } else {
      return reply(`❌ JID tidak valid: \`${argJid}\`\n\nContoh:\n• \`628xxx\` → nomor WA\n• \`120363xxx@g.us\` → grup`)
    }
  }

  try {
    const { generateWAMessageFromContent } = await import('@itsliaaa/baileys')

    const generatedMsg = generateWAMessageFromContent(
      targetJid,
      rawQuotedMessage,
      { userJid: Morela.user?.id ?? '' }
    )

    await Morela.relayMessage(
      targetJid,
      generatedMsg.message,
      { messageId: generatedMsg.key.id }
    )

    if (targetJid !== m.chat) {
      await reply(
        `✅ *Berhasil relay pesan!*\n\n` +
        `📨 Tipe: \`${m.quoted?.mtype ?? 'unknown'}\`\n` +
        `📍 Tujuan: \`${targetJid}\``
      )
    }

  } catch (_) {
    try {
      await Morela.relayMessage(targetJid, rawQuotedMessage, {})

      if (targetJid !== m.chat) {
        await reply(`✅ Relay berhasil\n📍 Tujuan: \`${targetJid}\``)
      }

    } catch (err2: any) {
      await reply(
        `❌ *Relay gagal!*\n\n` +
        `Error: ${err2.message}\n\n` +
        `💡 Coba *.rawjson* untuk lihat struktur pesan,\n` +
        `lalu relay manual via \`>\` eval.`
      )
      return
    }
  }

  try {
    const json = JSON.stringify(rawQuotedMessage, null, 2)
    const mtype = m.quoted?.mtype ?? 'unknown'

    await Morela.sendMessage(m.chat, {
      document: Buffer.from(json),
      mimetype: 'application/json',
      fileName: `${mtype}.json`,
    }, { quoted: fkontak || m })

  } catch (jsonErr: any) {
    await reply(`⚠️ Relay sukses tapi gagal kirim JSON:\n${jsonErr.message}`)
  }
}

handler.command   = ['crm', 'rawjson', 'rawijson']
handler.tags      = ['owner']
handler.mainOwner = true
handler.noLimit   = true
handler.help      = [
  'crm          — relay exact pesan yang di-reply + kirim file JSON',
  'crm <jid>    — relay ke JID/grup tertentu',
  'rawjson      — lihat raw JSON dari quoted message',
]

export default handler