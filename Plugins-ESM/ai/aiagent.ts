if (!(globalThis as Record<string, unknown>).__aiAgentStatus__)  (globalThis as Record<string, unknown>).__aiAgentStatus__  = {}
if (!(globalThis as Record<string, unknown>).__aiAgentHistory__) (globalThis as Record<string, unknown>).__aiAgentHistory__ = {}

const handler = async (m: any, { Morela, command, fkontak }: any) => {
  const { AIRich } = await import('../../Library/MessageBuilder.js?v=' + Date.now())

  const ppUrl = await Morela.profilePictureUrl(
    Morela.user.id.replace(/:\d+@/, '@'), 'image'
  ).catch(() => 'https://i.ibb.co/zHV7Wy2C/f4eff2a0725d.jpg')

  const send = (tips: string[]) => {
    const builder = new AIRich(Morela)
      .setTitle('AI Assistant')
      .addProduct({
        title:       '',
        brand:       'Morela',
        price:       'AI Agent',
        sale_price:  '',
        product_url: 'https://wa.me/628999889149',
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })
    for (const tip of tips) builder.addTip(tip)
    return builder.send(m.chat, { quoted: fkontak || m })
  }

  if (command === 'aiagenton' || command === 'agenton') {
    ;(globalThis as Record<string, unknown>).__aiAgentStatus__[m.chat] = true
    return send([
      '🤖 AI Agent telah ON di grup ini!',
      'Bot akan merespon semua pesan secara otomatis.',
      '',
      '📌 Kemampuan AI Agent:',
      '🔹 Chat & tanya jawab bebas',
      '🔹 Download video (TikTok, IG, YT, dll)',
      '🔹 Download & putar lagu/musik',
      '🔹 Fetch data dari URL/API',
      '🔹 Baca & list file di server (khusus Main Owner)',
      '🔹 Buat / convert plugin bot (khusus Main Owner)',
      '',
      '💡 Ketik reset untuk hapus history percakapan.',
    ])
  }

  if (command === 'aiagentoff' || command === 'agentoff') {
    ;(globalThis as Record<string, unknown>).__aiAgentStatus__[m.chat] = false
    return send(['❌ AI Agent telah OFF di grup ini.'])
  }

  if (command === 'aiagenreset' || command === 'agenreset') {
    const hist = (globalThis as Record<string, unknown>).__aiAgentHistory__ as Record<string, unknown>
    const keys = Object.keys(hist).filter((k: string) => k.startsWith(m.chat))
    keys.forEach((k: string) => delete hist[k])
    return send([
      '🧹 History percakapan AI Agent di grup ini sudah direset!',
      `${keys.length} user dihapus.`,
    ])
  }

  if (command === 'aiagenstat' || command === 'agenstat') {
    const isOn  = !!(globalThis as Record<string, unknown>).__aiAgentStatus__[m.chat]
    const hist  = (globalThis as Record<string, unknown>).__aiAgentHistory__ as Record<string, unknown>
    const users = Object.keys(hist).filter((k: string) => k.startsWith(m.chat)).length
    return send([
      `🤖 Status AI Agent: ${isOn ? '✅ ON' : '❌ OFF'}`,
      `📊 History: ${users} user aktif`,
      'Ketik reset untuk bersihkan history.',
    ])
  }
}

handler.command = [
  'aiagenton', 'aiagentoff', 'aiagenreset', 'aiagenstat',
  'agenton',   'agentoff',   'agenreset',   'agenstat',
]
handler.tags    = ['ai']
handler.group   = true
handler.admin   = true
handler.noLimit = true
handler.help    = [
  'aiagenton / agenton     — aktifkan AI Agent di grup',
  'aiagentoff / agentoff   — matikan AI Agent di grup',
  'aiagenstat / agenstat   — cek status AI Agent',
  'aiagenreset / agenreset — reset history percakapan',
]

export default handler
