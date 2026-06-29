if (!(globalThis as Record<string, unknown>).__aiStatus__) (globalThis as Record<string, unknown>).__aiStatus__ = {}

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
        price:       'Auto AI',
        sale_price:  '',
        product_url: 'https://wa.me/628999889149',
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })
    for (const tip of tips) builder.addTip(tip)
    return builder
      .setFooter('© Morela')
      .send(m.chat, { quoted: fkontak || m })
  }

  if (command === 'aion') {
    ;(globalThis as Record<string, unknown>).__aiStatus__[m.chat] = true
    return send([
      '✅ Auto AI telah ON di grup ini.',
      'Bot akan merespon semua pesan otomatis.',
    ])
  }

  if (command === 'aioff') {
    ;(globalThis as Record<string, unknown>).__aiStatus__[m.chat] = false
    return send(['❌ Auto AI telah OFF di grup ini.'])
  }

  if (command === 'aireset') {
    if (!(globalThis as Record<string, unknown>).__aiHistory__) (globalThis as Record<string, unknown>).__aiHistory__ = {}
    const keys = Object.keys((globalThis as Record<string, unknown>).__aiHistory__).filter((k: unknown) => k.startsWith(m.chat))
    keys.forEach((k: unknown) => delete (globalThis as Record<string, unknown>).__aiHistory__[k])
    return send([
      '🧹 History percakapan AI di grup ini sudah direset!',
      `${keys.length} user dihapus.`,
    ])
  }

  if (command === 'aistatus') {
    const status = (globalThis as Record<string, unknown>).__aiStatus__[m.chat] ? '✅ ON' : '❌ OFF'
    return send([`🤖 Status Auto AI di grup ini: ${status}`])
  }
}

handler.command = ['aion', 'aioff', 'aistatus', 'aireset']
handler.tags    = ['ai']
handler.group   = true
handler.admin   = true
handler.noLimit = true
handler.help    = ['aion — aktifkan auto AI di grup', 'aioff — matikan auto AI di grup', 'aistatus — cek status auto AI', 'aireset — reset history percakapan AI']

export default handler
