const handler = async (m: any, { Morela, reply, fkontak }: any) => {
  const jid = m.chat

  if (!jid.endsWith("@g.us"))
    return reply("Perintah ini hanya bisa digunakan di grup")

  const crypto = await import('crypto')
  const secret = crypto.default.randomBytes(32).toString('base64')

  const metadata = await Morela.groupMetadata(jid)
  const allMembers = metadata.participants.map((p: any) => p.id)

  const sender    = m.key.participant || m.chat
  const senderNum = sender.split('@')[0]

  let content = ""
  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
  if (quoted && !m.text) {
    content = quoted.conversation || quoted.extendedTextMessage?.text || ""
  } else {
    content = m.text?.replace(/^(\.hidetag|\!hidetag|\/hidetag|\.h|\!h|\/h)\s*/i, "").trim()
  }

  const message = `@${senderNum} : ${content || "\u200e"}`

  await Morela.relayMessage(jid, {
    extendedTextMessage: {
      text: message,
      contextInfo: {
        mentionedJid: [sender, ...allMembers],
        quotedMessage: fkontak?.message,
        participant: fkontak?.key?.participant || fkontak?.key?.remoteJid,
        remoteJid: fkontak?.key?.remoteJid,
      }
    },
    messageContextInfo: {
      threadId: [],
      messageSecret: secret,
    }
  }, { messageId: 'MORELA-' + Date.now() })
}

handler.command = ["hidetag", "h"]
handler.tags    = ["group"]
handler.help    = ["hidetag <teks>"]
handler.group   = true
handler.admin   = true
handler.noLimit = true

export default handler
