import { botName } from '../../Library/utils.js'
import { ButtonV2 } from '../../Library/MessageBuilder.js'

// Gambar sama persis dengan yang dipakai di welcome
const WELCOME_THUMB = 'https://cdn.ornzora.eu.cc/92fb27b5-5ffd-4f5f-905a-9b8d0573a1af-upload-1780208822400.jpg'

const bratSessions = new Map()

async function sendBratMenu(m: any, Morela: any, text: string, fkontak: any) {
  const btn = new ButtonV2(Morela)
    .setTitle('🎨 Brat Sticker')
    .setSubtitle(`Teks: ${text}`)
    .setBody(
      `Pilih style\n\n` +
      `◦ 🖤 Original\n` +
      `◦ 🌸 Ruromiya\n` +
      `◦ 🎬 Vid`
    )
    .setFooter(`© ${botName}`)
    .setThumbnail(WELCOME_THUMB)

  // Maksimal 3 button
  btn.addButton('🖤 Original', '.brat_orig')
  btn.addButton('🌸 Ruromiya', '.brat_ruromiya')
  btn.addButton('🎬 Vid',      '.brat_vid')

  const builtMsg = await btn.build(m.chat, { quoted: fkontak || m })
  await Morela.relayMessage(m.chat, builtMsg.message, { messageId: builtMsg.key.id })
}

const handler = async (m: any, { Morela, text, command, reply, fkontak }: any) => {

  // Handler tombol yang dipilih
  const bratButtonCmds = ['brat_orig', 'brat_ruromiya', 'brat_vid']
  if (bratButtonCmds.includes(command)) {
    const session = bratSessions.get(m.sender)
    if (!session) return reply('ketik ulang brat lagi 😊')

    bratSessions.delete(m.sender)

    const cmdMap: Record<string, string> = {
      brat_orig:     'bratoriginal',
      brat_ruromiya: 'bratruromiya',
      brat_vid:      'bratvid',
    }

    const { default: pluginManager } = await import('../_pluginmanager.js')
    const plugin = pluginManager.getPlugin(cmdMap[command])
    if (!plugin) return reply('❌ Plugin tidak ditemukan!')

    m.text = session.text
    m.body = `.${cmdMap[command]} ${session.text}`

    return plugin.plugin.handler(m, {
      Morela,
      text:       session.text,
      args:       session.text.split(' '),
      reply,
      command:    cmdMap[command],
      fkontak,
      usedPrefix: '.',
      isOwn:      false,
      isPrem:     false,
      isAdmin:    false,
      botAdmin:   false,
    })
  }

  // Pesan panduan jika tidak ada teks
  if (!text?.trim()) return reply(
    `╭╌「 🎨 *Brat Sticker* 」\n` +
    `┃ Contoh: *.brat haloii*\n` +
    `┃\n` +
    `┃ Style dengan button:\n` +
    `┃ ◦ 🖤 Original\n` +
    `┃ ◦ 🌸 Ruromiya\n` +
    `┃ ◦ 🎬 Vid\n` +
    `┃\n` +
    `┃ Style ketik langsung:\n` +
    `┃ ◦ .bratv2 <teks>\n` +
    `┃ ◦ .bratgura <teks>\n` +
    `┃ ◦ .bratspongebob <teks>\n` +
    `┃ ◦ .brattren <teks>\n` +
    `╰╌\n\n© ${botName}`
  )

  // Simpan sesi dan kirim menu ButtonV2
  bratSessions.set(m.sender, { text: text.trim() })
  setTimeout(() => bratSessions.delete(m.sender), 2 * 60 * 1000)

  await sendBratMenu(m, Morela, text.trim(), fkontak)
}

handler.command = ['brat', 'brat_orig', 'brat_ruromiya', 'brat_vid']
handler.tags    = ['sticker']
handler.help    = ['brat <teks>']

export default handler