if (!(globalThis as Record<string, unknown>).__ai2Status__) (globalThis as Record<string, unknown>).__ai2Status__ = {}

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
        price:       'Auto AI 2',
        sale_price:  '',
        product_url: 'https://wa.me/628999889149',
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })
    for (const tip of tips) builder.addTip(tip)
    return builder.send(m.chat, { quoted: fkontak || m })
  }

  if (command === 'ai2on') {
    ;(globalThis as Record<string, unknown>).__ai2Status__[m.chat] = true
    return send([
      '✅ Auto AI 2 telah ON di grup ini.',
      'Bot akan merespon semua pesan otomatis.',
    ])
  }

  if (command === 'ai2off') {
    ;(globalThis as Record<string, unknown>).__ai2Status__[m.chat] = false
    return send(['❌ Auto AI 2 telah OFF di grup ini.'])
  }

  if (command === 'ai2reset') {
    if (!(globalThis as Record<string, unknown>).__aiHistory__) (globalThis as Record<string, unknown>).__aiHistory__ = {}
    const keys = Object.keys((globalThis as Record<string, unknown>).__aiHistory__).filter((k: unknown) => k.startsWith(m.chat))
    keys.forEach((k: unknown) => delete (globalThis as Record<string, unknown>).__aiHistory__[k])
    return send([
      '🧹 History percakapan AI di grup ini sudah direset!',
      `${keys.length} user dihapus.`,
    ])
  }

  if (command === 'ai2status') {
    const status = (globalThis as Record<string, unknown>).__ai2Status__[m.chat] ? '✅ ON' : '❌ OFF'
    return send([`🤖 Status Auto AI 2 di grup ini: ${status}`])
  }
}

handler.command = ['ai2on', 'ai2off', 'ai2status', 'ai2reset']
handler.tags    = ['a2i']
handler.group   = true
handler.admin   = true
handler.noLimit = true
handler.help    = ['ai2on — aktifkan auto AI 2 di grup', 'ai2off — matikan auto AI 2 di grup', 'ai2status — cek status auto AI 2', 'ai2reset — reset history percakapan AI 2']

export default handler
