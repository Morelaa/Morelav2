const handler = async (m: any, { conn, fkontak }: any) => {

  const { AIRich } = await import('../../Library/MessageBuilder.js?v=' + Date.now())

  const OWNER_URL  = 'https://wa.me/628999889149'
  const IMAGE_URL  = 'https://i.ibb.co/zHV7Wy2C/f4eff2a0725d.jpg'
  const IMAGE_URL2 = 'https://i.ibb.co/KzXTnDkC/a9531e6a7433.jpg'

  const ppUrl = await conn.profilePictureUrl(
    conn.user.id.replace(/:\d+@/, '@'), 'image'
  ).catch(() => IMAGE_URL)

  await new AIRich(conn)

    .setTitle('Ai Assistant')

    .addProduct({
      title      : '',
      brand      : 'Morela',
      price      : 'Mulai Rp 20.000',
      sale_price : '',
      product_url: OWNER_URL,
      icon_url   : ppUrl,
      image_url  : ppUrl,
    })

    .addTip(' ')  

    .addImage(IMAGE_URL2, { mimeType: 'image/jpeg' })

    .addProduct([
      {
        title      : '🔵 Basic',
        brand      : '1 Bulan Sewa',
        price      : 'Rp 20.000',
        sale_price : '',
        url        : OWNER_URL,
        icon       : ppUrl,
        image      : IMAGE_URL,
      },
      {
        title      : '🟢 Plus',
        brand      : '3 Bulan Sewa',
        price      : 'Rp 55.000',
        sale_price : '',
        url        : OWNER_URL,
        icon       : ppUrl,
        image      : IMAGE_URL,
      },
      {
        title      : '🟡 Pro',
        brand      : '6 Bulan Sewa',
        price      : 'Rp 100.000',
        sale_price : '',
        url        : OWNER_URL,
        icon       : ppUrl,
        image      : IMAGE_URL,
      },
    ])

    .addSource([
      ['https://www.google.com/s2/favicons?domain=whatsapp.com&sz=16', 'https://wa.me/628999889149', 'WhatsApp Morela'],
      ['https://www.google.com/s2/favicons?domain=github.com&sz=16',   'https://github.com/MorelaXz', 'GitHub Morela'],
    ])

    .addTip('✨ Fitur Unggulan')
    .addTip('🤖 AI Agent')
    .addTip('🧠 AI Session')
    .addTip('🔒 Self Mode')
    .addTip('📋 Menu 4 Varian')
    .addTip('🔘 All Button')
    .addTip('📥 All Downloader')
    .addTip('🎮 Games & RPG')
    .addTip('🛡️ Admin Tools')
    .addTip('🎵 Music Player')
    .addTip('🤖 Jadibot')
    .addTip('🔌 Plugin Manager')
    .addTip('🆓 Free API Key')

    .addTip('🤖 AIRich Layer  Pesan gaya AI: teks, gambar, video, produk, reels & post')
    .addTip('🔘 Button Tombol interaktif modern: reply, URL, copy, call, list, lokasi')
    .addTip('🎠 Carousel Card swipe kiri-kanan dengan gambar atau video')
    .addTip('🔲 ButtonV2 Tombol legacy kiri-kanan / atas-bawah')

    .addTip('Hubungi owner untuk pembelian:')
    .addText('[Klik di sini](' + OWNER_URL + ')')

    .setFooter('© Morela v2 | AIRich Layer')

    .send(m.chat, { quoted: fkontak || m })

}

handler.command = ['sc', 'sewa', 'harga']
handler.tags    = ['owner']
handler.noLimit = true
handler.help    = [
  'sc    — Info & harga sewa bot Morela',
  'sewa  — Alias sc',
  'harga — Alias sc',
]

export default handler
