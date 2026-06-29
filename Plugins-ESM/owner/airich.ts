import { Button, ButtonV2, Carousel, AIRich } from '../../Library/MessageBuilder.js'

const handler = async (m: any, { Morela, conn, reply }: any) => {
  const client = Morela

  const b1 = new Button(client)
  b1.setImage('https://cdn.ornzora.eu.cc/b57c0d1e-d7a6-4277-8739-8f6b1d9894e6-FIORA.jpg')
    .setTitle('🚀 MORELA').setSubtitle('Interactive Message')
    .setBody('Pilih menu di bawah').setFooter('© Morela v2')
    .addReply('📦 Menu', '.menu', { icon: 'DEFAULT' })
    .addReply('👤 Profile', '.profile', { icon: 'REVIEW' })
    .addUrl('🌐 Website', 'https://wa.me/628999889149', true, { icon: 'PROMOTION' })
    .addCopy('📋 Copy Kode', 'MORELA-2026', { icon: 'DOCUMENT' })
    .addCall('📞 Hubungi', '628999889149')
    .addLocation()
    .addSelection('📚 Pilih Kategori')
      .makeSection('🔥 Populer')
        .makeRow('HOT', 'Downloader', 'Download medsos', '.dl')
        .makeRow('AI', 'AI Chat', 'Chat dengan AI', '.ai')
      .makeSection('⚙️ Lainnya')
        .makeRow('', 'Ping', 'Cek speed bot', '.ping')
    .setContextInfo({ mentionedJid: [m.sender] })
  const msg1 = await b1.build(m.chat, { quoted: m })
  await Morela.relayMessage(m.chat, msg1.message, { messageId: msg1.key.id })

  const b2 = new ButtonV2(client)
  b2.setThumbnail('https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')
    .setTitle('🚀 MORELA').setSubtitle('Buttons Message')
    .setBody('Halo dunia').setFooter('© Morela v2')
    .addButton('📦 Menu', '.menu')
    .addButton('👤 Profile', '.profile')
  const msg2 = await b2.build(m.chat)
  await Morela.relayMessage(m.chat, msg2.message, { messageId: msg2.key.id })

  const b3 = new ButtonV2(client)
  b3.setThumbnail('https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')
    .setTitle('🚀 MORELA').setSubtitle('Buttons Message')
    .setBody('Halo dunia').setFooter('© Morela v2')
    .addButton('📦 Menu', '.menu')
    .addButton('👤 Profile', '.profile')
    .addButton('📊 Status', '.status')
    .addRawButton({ buttonId: '.ping', buttonText: { displayText: '🏓 Ping' }, type: 1 })
  const msg3 = await b3.build(m.chat)
  await Morela.relayMessage(m.chat, msg3.message, { messageId: msg3.key.id })

  const c = new Carousel(client)
  c.setBody('🎠 Carousel').setFooter('© Morela v2')
    .addCard(await new Button(client)
      .setTitle('🖼️ Card Image').setSubtitle('Image Card')
      .setBody('Card pakai setImage()').setFooter('Rp 1.000')
      .setImage('https://cdn.ornzora.eu.cc/152f4f0b-02fb-4d60-aacc-fc4cfa87ccdb-FIORA.jpg')
      .addReply('🛒 Beli', '.beli morela')
      .addUrl('💬 Admin', 'https://wa.me/628999889149', true)
      .addCopy('📋 No Admin', '628999889149')
      .toCard()
    )
    .addCard(await new Button(client)
      .setTitle('🎬 Card Video').setSubtitle('Video Card')
      .setBody('Card pakai setVideo()').setFooter('0:10')
      .setVideo('https://www.w3schools.com/html/mov_bbb.mp4')
      .addReply('▶️ Play', '.play1')
      .addUrl('⬇️ Download', 'https://www.w3schools.com/html/mov_bbb.mp4', false)
      .toCard()
    )
  const msg4 = c.build(m.chat, { quoted: m })
  await Morela.relayMessage(m.chat, msg4.message, { messageId: msg4.key.id })

  await new AIRich(client)
    .setTitle('🤖 Morela AI')
    .setFooter('© Morela v2')
    .addSuggest(['📦 Menu', '👤 Profile', '💬 Hubungi'])
    .addTip('💡 Powered by Morela v2')
    .addText(
      '# Halo!\n## Morela Bot\n\n---\n\n=={ Highlight }==\n\n' +
      'Hyperlink: [GitHub](https://github.com)\n\n' +
      'Citation: [](https://openai.com)\n\n' +
      'LaTeX: [Morela|200|80]<https://cdn.ornzora.eu.cc/a3a756f2-6bb8-4814-a024-c325524a2308-FIORA.png>'
    )
    .addCode('javascript',
      'const { AIRich } = await import(\'./Library/MessageBuilder.js\');\n' +
      'await new AIRich(conn).setTitle(\'Hello\').addText(\'World!\').send(m.chat);'
    )
    .addTable([
      ['Class',    'Kegunaan'],
      ['Button',   'Interactive native flow'],
      ['ButtonV2', 'Legacy buttons'],
      ['Carousel', 'Swipeable card'],
      ['AIRich',   'AI rich response'],
    ])
    .addSource([
      ['https://cdn.ornzora.eu.cc/dc85c945-96f7-4d50-aaa4-1dff7249aaf4-FIORA.jpg', 'https://wa.me/628999889149', 'Morela'],
      ['https://cdn.ornzora.eu.cc/dc85c945-96f7-4d50-aaa4-1dff7249aaf4-FIORA.jpg', 'https://wa.me/628999889149', 'Morela Bot'],
    ])
    .addImage([
      'https://cdn.ornzora.eu.cc/d987ff9c-c16c-4f1e-a8d6-953e375f4aec-FIORA.jpg',
      'https://cdn.ornzora.eu.cc/152f4f0b-02fb-4d60-aacc-fc4cfa87ccdb-FIORA.jpg',
    ], { mimeType: 'image/jpeg' })
    .addVideo({ url: 'https://cdn.ornzora.eu.cc/a1a3124d-533a-490d-8b56-517b8dccffb1-FIORA.mp4', duration: 10 })
    .addProduct({
      title: 'Morela Bot', brand: 'Morela Dev',
      price: 'Rp 1.000', sale_price: 'Rp 0',
      product_url: 'https://wa.me/628999889149',
      icon_url: 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg',
      image_url: 'https://cdn.ornzora.eu.cc/152f4f0b-02fb-4d60-aacc-fc4cfa87ccdb-FIORA.jpg',
    })
    .addProduct(Array(5).fill({
      title: 'Morela', brand: 'Morela Bot',
      price: 'Rp 1.000', sale_price: 'Rp 0',
      url: 'https://wa.me/628999889149',
      icon: 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg',
      image: 'https://cdn.ornzora.eu.cc/152f4f0b-02fb-4d60-aacc-fc4cfa87ccdb-FIORA.jpg',
    }))
    .addPost(Array(3).fill({
      profile_url: 'https://cdn.ornzora.eu.cc/2498bf66-6870-4f8a-8421-0a77f7baa95b-FIORA.jpg',
      username: 'morela_bot', title: 'Morela Bot', subtitle: 'Morela Store',
      caption: 'hii~ im Morela Bot!',
      verified: true, url: 'https://wa.me/628999889149',
      thumbnail: 'https://cdn.ornzora.eu.cc/7048efb4-2abf-4081-bdd1-2f65972d793a-FIORA.jpg',
      source: 'INSTAGRAM', orientation: 'LANDSCAPE', post_type: 'PHOTO',
      like: 9999, comment: 42, share: 100,
    }))
    .addReels(Array(3).fill({
      username: 'Morela',
      profile_url: 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg',
      thumbnail: 'https://cdn.ornzora.eu.cc/d6b36500-3b7e-49ee-9123-52bb1bf106be-FIORA.jpg',
      url: 'https://wa.me/628999889149',
      like: 12000, share: 500, view: 999999, source: 'IG', verified: true,
    }))
    .send(m.chat, { quoted: m })
}

handler.command = ['airich', 'msgtest', 'buildertest']
handler.tags    = ['owner']
handler.help    = ['airich — test semua tampilan MessageBuilder']
handler.noLimit = true
handler.owner   = true

export default handler