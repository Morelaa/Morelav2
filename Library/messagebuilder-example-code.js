const { Toolkit } = await import('./Library/MessageBuilder.js?v=' + Date.now());

// Resize gambar (pakai sharp)
const resized = await Toolkit.resize(imageBuffer, 300, 300, 'cover');

// Fetch URL → Buffer
const buf = await Toolkit.fetchBuffer('https://example.com/img.jpg');
// silent default = true (tidak throw jika gagal)
const buf2 = await Toolkit.fetchBuffer('https://example.com/img.jpg', {}, { silent: false });

// Upload Buffer ke WA CDN → dapat URL
const waUrl = await Toolkit.toUrl(conn, imageBuffer, 'image');

// Resolve media (URL / Buffer / base64) → url | buffer | base64
const resolved = await Toolkit.resolveMedia(conn, 'https://example.com/img.jpg', 'image');
const resolvedBuf = await Toolkit.resolveMedia(conn, imageBuffer, 'image', { result: 'buffer' });
const resolvedB64 = await Toolkit.resolveMedia(conn, imageBuffer, 'image', { result: 'base64' });
const resolvedResized = await Toolkit.resolveMedia(conn, imageBuffer, 'image', {
  result: 'buffer',
  resize: true,
  width: 300,
  height: 300,
});

// Baca durasi MP4 dari buffer (pure JS, tanpa ffmpeg)
const duration = Toolkit.getMp4Duration(videoBuffer); // → detik (number)

// Extract thumbnail frame dari video (ffmpeg)
const thumb = await Toolkit.getMp4Preview(videoBuffer, {
  time: 5,        // detik ke berapa (default: 20% durasi, max 10)
  result: 'buffer',  // 'buffer' | 'base64'
  resize: true,
  width: 300,
  height: 300,
});

// Parse inline entities dari teks (hyperlink / citation / latex)
const { text, ie, inline_entities } = Toolkit.extractIE('[Google](https://google.com)');

// Resolve semua nested promise dalam object/array
const settled = await Toolkit.waitAllPromises({ a: Promise.resolve(1), b: [Promise.resolve(2)] });
// → { a: 1, b: [2] }



// 1. BUTTON — SEMUA FITUR
// Interactive message dengan semua jenis tombol.
// Icon options: 'DEFAULT' | 'REVIEW' | 'PROMOTION' | 'DOCUMENT'

const { Button } = await import('./Library/MessageBuilder.js?v=' + Date.now());

const b = new Button(conn);

// Header media
b.setImage('https://cdn.ornzora.eu.cc/b57c0d1e-d7a6-4277-8739-8f6b1d9894e6-FIORA.jpg')
// atau:
// b.setVideo('https://...')
// b.setDocument('https://...')

// Teks konten
b.setTitle('🚀 NIXCODE')
 .setSubtitle('Interactive Message')
 .setBody('Pilih menu di bawah')
 .setFooter('© Nixel')

// Tombol quick reply
b.addReply('📦 Menu', '.menu', { icon: 'DEFAULT' })
 .addReply('👤 Profile', '.profile', { icon: 'REVIEW' })

// Tombol buka URL (webview_interaction: true = buka dalam app)
b.addUrl('🌐 Website', 'https://wa.me/628999889149', true, { icon: 'PROMOTION' })

// Tombol salin teks ke clipboard
b.addCopy('📋 Copy Kode', 'NIX-2026', { icon: 'DOCUMENT' })

// Tombol telepon langsung
b.addCall('📞 Hubungi', '628999889149')

// Tombol kirim lokasi pengguna
b.addLocation()

// List selection (dropdown bertingkat)
b.addSelection('📚 Pilih Kategori')
  .makeSection('🔥 Populer')
    .makeRow('HOT', 'Downloader', 'Download medsos', '.dl')
    .makeRow('FAST', 'AI Chat', 'Chat dengan AI', '.ai')
  .makeSection('⚙️ Lainnya')
    .makeRow('', 'Ping', 'Cek speed bot', '.ping')
    .makeRow('', 'Info Bot', 'Lihat info bot', '.info')

// ContextInfo tambahan (mention, dll)
b.setContextInfo({ mentionedJid: [m.sender] })

// Kirim
await b.send(m.chat, { quoted: m });
// 2. BUTTON V2 — TOMBOL KIRI-KANAN (≤2 tombol)
// ButtonV2 memakai format buttonsMessage (legacy).
// ⚠️ v4.6: Toolkit.resize/fetchBuffer dipakai internal (bukan BaseBuilder lagi)

const { ButtonV2 } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new ButtonV2(conn)
  .setThumbnail('https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')
  .setTitle('🚀 NIXCODE')
  .setSubtitle('Buttons Message')
  .setBody('Halo dunia')
  .setFooter('© Nixel')
  .addButton('📦 Menu', '.menu')
  .addButton('👤 Profile', '.profile')
  .send(m.chat);

// 3. BUTTON V2 — TOMBOL ATAS-BAWAH (≥3 tombol) + RAW BUTTON
const { ButtonV2 } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new ButtonV2(conn)
  .setThumbnail('https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')
  .setTitle('🚀 NIXCODE')
  .setSubtitle('Legacy Button Message')
  .setBody('Halo! Pilih menu di bawah.')
  .setFooter('© Nixel')
  .addButton('📦 Menu', '.menu')
  .addButton('👤 Profile', '.profile')
  .addButton('📊 Status', '.status')
  // Tombol raw dengan nativeFlowInfo (list selection via ButtonV2)
  .addRawButton({
    buttonText: { displayText: '📡 Menu' },
    buttonId: 'Nixel',
    type: 1,
    nativeFlowInfo: {
      name: 'single_select',
      paramsJson: JSON.stringify({
        title: 'Click Here!',
        sections: [{
          title: 'Nixel',
          highlight_label: '',
          rows: [{ header: '', title: 'Nixel', description: '', id: '' }]
        }]
      })
    }
  })
  .send(m.chat, { quoted: m });

// 4. CAROUSEL — IMAGE CARDS

// Setiap card dibuat dari Button, lalu dimasukkan ke Carousel.
// Card WAJIB punya setImage() atau setVideo().
const { Button, Carousel } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new Carousel(conn)
  .setBody('🛍️ NIXCODE Store')
  .setFooter('Powered by Nixel')
  .addCard(await new Button(conn)
    .setTitle('Nixel Bot')
    .setSubtitle('Bot WA Terlengkap')
    .setBody('Harga spesial untuk kamu!')
    .setFooter('Rp 1.000')
    .setImage('https://cdn.ornzora.eu.cc/152f4f0b-02fb-4d60-aacc-fc4cfa87ccdb-FIORA.jpg')
    .addReply('🛒 Beli', '.beli nixel')
    .addUrl('💬 Hubungi Admin', 'https://wa.me/6285188349341', true)
    .addCopy('📋 Copy No Admin', '6285188349341')
    .toCard()
  )
  .addCard(await new Button(conn)
    .setTitle('🍕 Pizza Mozarella')
    .setSubtitle('New Menu')
    .setBody('Keju mozzarella premium, sauce spesial')
    .setFooter('Rp 55.000')
    .setImage('https://cdn.ornzora.eu.cc/36df8c36-c74e-4dc2-bc03-87893f373cb4-FIORA.jpg')
    .addReply('🛒 Beli', '.buy pizza')
    .addCopy('📋 Kode Diskon', 'PIZZA20')
    .toCard()
  )
  .send(m.chat, { quoted: m });

// 5. CAROUSEL — VIDEO CARDS
const { Button, Carousel } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new Carousel(conn)
  .setBody('🎬 Video Carousel')
  .setFooter('© Nixel')
  .addCard(await new Button(conn)
    .setTitle('🎬 Video 1')
    .setBody('Sample video pertama')
    .setFooter('0:10')
    .setVideo('https://www.w3schools.com/html/mov_bbb.mp4')
    .addReply('▶️ Play', '.play1')
    .addUrl('⬇️ Download', 'https://www.w3schools.com/html/mov_bbb.mp4', false)
    .toCard()
  )
  .addCard(await new Button(conn)
    .setTitle('🎬 Video 2')
    .setBody('Sample video kedua')
    .setFooter('0:10')
    .setVideo('https://www.w3schools.com/html/movie.mp4')
    .addReply('▶️ Play', '.play2')
    .addUrl('⬇️ Download', 'https://www.w3schools.com/html/movie.mp4', false)
    .toCard()
  )
  .send(m.chat, { quoted: m });

// 6. AIRICH — BASIC (title + text + tip + suggest)
// ⚠️ v4.6: addSuggest() default untuk banyak item = HScroll (bukan ActionRow)
// ⚠️ v4.6: AIRich.build() sekarang async — selalu await send()
const { AIRich } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new AIRich(conn)
  .setTitle('🧪 NIXCODE v4.6')
  .addText('Ini test fitur baru MessageBuilder v4.6!')
  .addTip('💡 Tip: Toolkit class baru tersedia di v4.6')
  // Single suggest → layout Single
  .addSuggest('MessageBuilder v4.6')
  // Multi suggest → layout HScroll (scrollable) — default baru v4.6
  .addSuggest(['Test Video', 'Test Product', 'Test Post'])
  // Multi suggest → layout ActionRow (non-scroll) — pass { scroll: false }
  .addSuggest(['Option A', 'Option B'], { scroll: false })
  // Override layout manual
  .addSuggest(['X', 'Y', 'Z'], { layout: 'HScroll' })
  .send(m.chat);



// 7. AIRICH — addVideo (v4.6 UPDATED — format baru)
// ❌ FORMAT LAMA (v4.5) — DIHAPUS:
//    .addVideo('https://example.com/video.mp4|10')
// ✅ FORMAT BARU (v4.6):
//    1. URL string biasa — autoFill otomatis fetch duration & thumbnail
//    2. Object dengan metadata lengkap
//    3. Buffer — didukung seperti URL
const { AIRich } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new AIRich(conn)
  .setTitle('🎬 Test Video v4.6')
  .addText('Video dengan autoFill (fetch duration & thumbnail otomatis):')
  // Format 1: string URL — autoFill = true secara default
  .addVideo('https://cdn.ornzora.eu.cc/5c3e1109-38d3-408e-926c-588694fd9581-FIORA.mp4')
  .addText('Video dengan metadata manual (object input):')
  // Format 2: object — set duration/thumbnail/file_length manual
  .addVideo({
    url: 'https://cdn.ornzora.eu.cc/5c3e1109-38d3-408e-926c-588694fd9581-FIORA.mp4',
    duration: 120,                    // detik
    file_length: 100000000,           // bytes
    mime_type: 'video/mp4',           // opsional
    thumbnail: 'https://cdn.ornzora.eu.cc/0800269d-8f1e-4c7e-b38e-8684db560345-FIORA.jpg',
    // thumbnail juga bisa Buffer atau base64
  })
  .addText('Video tanpa autoFill (metadata kosong, lebih cepat):')
  // Format 3: matikan autoFill
  .addVideo('https://cdn.ornzora.eu.cc/5c3e1109-38d3-408e-926c-588694fd9581-FIORA.mp4', { autoFill: false })
  .send(m.chat);

// 8. AIRICH — addText dengan Hyperlink, Citation, LaTeX
// ⚠️ v4.6 BARU: Prefix URL dengan '!' = is_trusted: false
//    [teks](url)  → trusted link
//    [teks](!url) → untrusted link (is_trusted: false)
const { AIRich } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new AIRich(conn)
  .setTitle('📝 Test Text v4.6')
  .addText(`
# Halo Dunia
## NIXCODE

---

=={ Yellow Text }==

---

## TRUSTED LINK
[Google](https://google.com)

## UNTRUSTED LINK (baru v4.6)
[Google](!https://google.com)

## AUTO CITATION
[](https://openai.com)

## LaTeX
[Shiroko|1429|1897]<https://cdn.ornzora.eu.cc/5442e78b-fe26-4cb9-939d-e6df83acad6a-FIORA.png>
  `)
  // Bisa matikan parse tertentu
  .addText('Teks tanpa hyperlink parse:', { hyperlink: false })
  .addText('Teks tanpa citation:', { citation: false })
  .addText('Teks tanpa latex:', { latex: false })
  .send(m.chat);

// 9. AIRICH — addCode (v4.6: 11 bahasa baru tersedia)
// Bahasa tersedia: javascript, typescript, python, java, golang,
//                  c, cpp, php, rust, html, bash, markdown,
//                  css, plaintext/txt/text (passthrough)
const { AIRich } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new AIRich(conn)
  .setTitle('💻 Code Examples v4.6')
  .addText('JavaScript:')
  .addCode('javascript',
`class Nixel {
  static hello() {
    return 'Hello World';
  }
}`
  )
  .addText('TypeScript (baru v4.6):')
  .addCode('typescript',
`interface User {
  name: string;
  age: number;
}
const greet = (user: User): string => {
  return \`Hello, \${user.name}\`;
};`
  )
  .addText('Python (baru v4.6):')
  .addCode('python',
`def greet(name: str) -> str:
    # Fungsi greeting
    return f"Hello, {name}"

print(greet("Nixel"))`
  )
  .addText('Bash (baru v4.6):')
  .addCode('bash',
`#!/bin/bash
# Script sederhana
if [ "$1" == "hello" ]; then
    echo "Hello World"
fi`
  )
  .addText('Plaintext (passthrough, tanpa highlight):')
  .addCode('plaintext', 'Ini plain text, tidak ada syntax highlight.')
  .send(m.chat);

// 10. AIRICH — addTable (v4.6: support IE per cell)
// ⚠️ v4.6 BARU: addTable() sekarang bisa parse hyperlink/citation/latex per cell
const { AIRich } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new AIRich(conn)
  .setTitle('📊 Tabel v4.6')
  // Default: hyperlink, citation, latex aktif semua
  .addTable([
    ['Nama', 'Role', 'Link'],
    ['[Nixel](https://wa.me/6285188349341)', 'Developer', '[GitHub](https://github.com)'],
    ['Fiora Sylvie', 'Assistant', '[Website](!https://fiora.nixel.my.id)'],
    ['[](https://openai.com)', 'AI', 'Citation contoh'],
  ])
  .addText('Tabel tanpa hyperlink parse:')
  .addTable([
    ['Nama', 'Role'],
    ['Nixel', 'Developer'],
  ], { hyperlink: false, citation: false, latex: false })
  .send(m.chat);

// 11. AIRICH — addProduct (Single & HScroll)
// ⚠️ v4.6: image & icon sekarang bisa Buffer atau base64 (via Toolkit.resolveMedia)
const { AIRich } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new AIRich(conn)
  .setTitle('🛍️ NIXCODE Store')
  .addTip('Ini adalah text tip (Metadata Text)')
  .addText('SingleLayout Product (Object Input):')
  // Single product → layout Single
  .addProduct({
    title: 'Nixel Bot',
    brand: 'Nixel',
    price: 'Rp 1.000',
    sale_price: 'Rp 0',
    url: 'https://wa.me/6285188349341',           // alias product_url
    image: 'https://cdn.ornzora.eu.cc/152f4f0b-02fb-4d60-aacc-fc4cfa87ccdb-FIORA.jpg', // alias image_url, bisa Buffer/base64
    icon: 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg',  // alias icon_url, bisa Buffer/base64
  })
  .addText('HScroll Product (Array of Object Input):')
  // Array product → layout HScroll
  .addProduct(Array(5).fill({
    title: 'Nixel Bot',
    brand: 'Nixel',
    price: 'Rp 1.000',
    sale_price: 'Rp 0',
    url: 'https://wa.me/6285188349341',
    image: 'https://cdn.ornzora.eu.cc/152f4f0b-02fb-4d60-aacc-fc4cfa87ccdb-FIORA.jpg',
    icon: 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg',
  }))
  .addSuggest(['🛒 Beli Sekarang', '💬 Hubungi Admin', '📦 Lihat Semua'])
  .send(m.chat);

// 12. AIRICH — addPost (Single & HScroll)
// ⚠️ v4.6: profile_picture_url, thumbnail_url, footer_icon di-resolve via Toolkit
const { AIRich } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new AIRich(conn)
  .setTitle('📸 Post Cards')
  // Single post
  .addPost({
    username: 'nixel_dev',
    title: 'NIXCODE Update',
    subtitle: 'MessageBuilder v4.6',
    caption: 'hii~ im fiora sylvie, just quietly observing things around here.',
    verified: true,                                    // alias is_verified
    url: 'https://fiora.nixel.my.id/',                 // alias post_url
    deeplink: 'https://fiora.nixel.my.id/',            // alias post_deeplink
    profile: 'https://cdn.ornzora.eu.cc/2498bf66-6870-4f8a-8421-0a77f7baa95b-FIORA.jpg', // Buffer/base64 supported
    thumbnail: 'https://cdn.ornzora.eu.cc/7048efb4-2abf-4081-bdd1-2f65972d793a-FIORA.jpg', // Buffer/base64 supported
    source: 'INSTAGRAM',                               // INSTAGRAM | FACEBOOK | THREADS
    footer: 'Fiora Sylvie',                            // alias footer_label
    icon: 'https://cdn.ornzora.eu.cc/2498bf66-6870-4f8a-8421-0a77f7baa95b-FIORA.jpg', // Buffer/base64 supported
    like: 999,   orientation: 'LANDSCAPE',   post_type: 'VIDEO',
  })
  // Multi post → HScroll
  .addPost(Array(5).fill({
    profile: 'https://cdn.ornzora.eu.cc/2498bf66-6870-4f8a-8421-0a77f7baa95b-FIORA.jpg',
    username: 'Nixel',
    title: 'Demo Post',
    subtitle: 'NIXCODE',
    caption: 'hii~ im fiora sylvie!',
    verified: true,
    url: 'https://fiora.nixel.my.id/',
    thumbnail: 'https://cdn.ornzora.eu.cc/7048efb4-2abf-4081-bdd1-2f65972d793a-FIORA.jpg',
    source: 'INSTAGRAM',
    footer: 'Fiora Sylvie',
    deeplink: 'https://fiora.nixel.my.id/',
    icon: 'https://cdn.ornzora.eu.cc/2498bf66-6870-4f8a-8421-0a77f7baa95b-FIORA.jpg',
    like: 1, comment: 1, share: 1,
    orientation: 'LANDSCAPE', post_type: 'VIDEO',
  }))
  .send(m.chat);

// 13. AIRICH — addReels
// ⚠️ v4.6: avatar & thumbnail di-resolve via Toolkit.resolveMedia
//    (mendukung Buffer dan base64 input sekarang)
const { AIRich } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new AIRich(conn)
  .setTitle('🎬 Nixel Reels')
  .addReels(Array(5).fill({
    username: 'Nixel',
    profile: 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg', // Buffer/base64 supported
    thumbnail: 'https://cdn.ornzora.eu.cc/0800269d-8f1e-4c7e-b38e-8684db560345-FIORA.jpg', // Buffer/base64 supported
    url: 'https://fiora.nixel.my.id/',
    title: 'Demo Reel',
    source: 'IG',    // 'IG' | 'YT'
    verified: true,
    like: 12000, share: 500, view: 999999,
  }))
  .send(m.chat);

// 14. AIRICH — addSource
// ⚠️ v4.6: favicon di-resolve via Toolkit.resolveMedia (Buffer/base64 supported)
const { AIRich } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new AIRich(conn)
  .setTitle('🔍 Source Cards')
  .addText('Sumber referensi:')
  .addSource([
    [
      'https://cdn.ornzora.eu.cc/dc85c945-96f7-4d50-aaa4-1dff7249aaf4-FIORA.jpg', // favicon, Buffer/base64 supported
      'https://github.com/ValdazGT/',
      'GitHub'
    ],
    [
      'https://cdn.ornzora.eu.cc/dc85c945-96f7-4d50-aaa4-1dff7249aaf4-FIORA.jpg',
      'https://fiora.nixel.my.id/',
      'Fiora Sylvie'
    ]
  ])
  .send(m.chat);

// 15. AIRICH — addImage & addSubmessage (Raw Inject)
// ⚠️ v4.6: addImage() sekarang menerima Buffer input
const { AIRich } = await import('./Library/MessageBuilder.js?v=' + Date.now());
await new AIRich(conn)
  .setTitle('🖼️ Image & Raw Inject')
  // URL string
  .addImage('https://cdn.ornzora.eu.cc/d987ff9c-c16c-4f1e-a8d6-953e375f4aec-FIORA.jpg')
  // Multiple images
  .addImage([
    'https://cdn.ornzora.eu.cc/d987ff9c-c16c-4f1e-a8d6-953e375f4aec-FIORA.jpg',
    'https://cdn.ornzora.eu.cc/152f4f0b-02fb-4d60-aacc-fc4cfa87ccdb-FIORA.jpg',
    // Buffer juga bisa di v4.6
  ])
  // Raw submessage inject
  .addSubmessage({ messageType: 2, messageText: 'Ini raw submessage!' })
  .addText('Plus addText biasa setelah raw inject')
  .send(m.chat);

// 16. AIRICH — build() dengan opsi (v4.6: build() sekarang async)
// ⚠️ v4.6: AIRich.build() sekarang async — wajib await
// ⚠️ v4.6: send() mendukung parameter notification baru
const { AIRich } = await import('./Library/MessageBuilder.js?v=' + Date.now());
const airich = new AIRich(conn)
  .setTitle('🤖 Bot Notification')
  .addText('Pesan dengan session transparency metadata')
  .addSuggest('Tanya lagi');

// Build payload saja (tanpa kirim)
const payload = await airich.build({
  forwarded: true,              // tambah forwardedAiBotMessageInfo (default: true)
  notification: true,           // ⚠️ BARU v4.6: tambah sessionTransparencyMetadata
  includesUnifiedResponse: true,
  includesSubmessages: true,
  quoted: m,                    // reply ke pesan
  quotedParticipant: m.sender,
});

// Kirim manual dari payload
await conn.relayMessage(m.chat, payload, {});

// Atau langsung send() dengan semua opsi
await new AIRich(conn)
  .setTitle('🤖 Bot')
  .addText('Pesan langsung')
  .send(m.chat, {
    forwarded: false,
    notification: true,
    quoted: m,
  });

// 17. AIRICH — FULL SEMUA FITUR
// Gabungan semua fitur dalam satu pesan.
const { Button, ButtonV2, Carousel, AIRich, Toolkit } =
  await import('./Library/MessageBuilder.js?v=' + Date.now());
// --- Button ---
await new Button(conn)
  .setTitle('🚀 NIXCODE')
  .setSubtitle('Interactive Message')
  .setBody('Pilih menu di bawah')
  .setFooter('© Nixel')
  .setImage('https://cdn.ornzora.eu.cc/b57c0d1e-d7a6-4277-8739-8f6b1d9894e6-FIORA.jpg')
  .addReply('📦 Menu', '.menu', { icon: 'DEFAULT' })
  .addReply('👤 Profile', '.profile', { icon: 'REVIEW' })
  .addUrl('🌐 Website', 'https://wa.me/6285188349341', true, { icon: 'PROMOTION' })
  .addCopy('📋 Copy No', '6285188349341', { icon: 'DOCUMENT' })
  .addSelection('📚 Pilih Kategori')
    .makeSection('Main Menu')
      .makeRow('🔥 HOT', 'Downloader', 'Download social media', '.dl')
      .makeRow('⚡ FAST', 'AI Chat', 'Chat dengan AI', '.ai')
  .send(m.chat, { quoted: m });
// --- ButtonV2 ---
await new ButtonV2(conn)
  .setTitle('🚀 NIXCODE')
  .setSubtitle('Buttons Message')
  .setBody('Halo dunia')
  .setFooter('© Nixel')
  .setThumbnail('https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')
  .addRawButton({
    buttonText: { displayText: '📡 Menu' },
    buttonId: 'Nixel',
    type: 1,
    nativeFlowInfo: {
      name: 'single_select',
      paramsJson: JSON.stringify({
        title: 'Click Here!',
        sections: [{
          title: 'Fiora Sylvie', highlight_label: '',
          rows: [{ header: '', title: 'Nixel', description: '', id: '' }]
        }]
      })
    }
  })
  .addButton('👤 Profile', '.profile')
  .send(m.chat);
// --- Carousel ---
await new Carousel(conn)
  .setBody('🛍️ Product List')
  .setFooter('Swipe untuk lihat')
  .addCard(await new Button(conn)
    .setTitle('🍔 Burger')
    .setBody('Burger terenak')
    .setFooter('$5')
    .setImage('https://cdn.ornzora.eu.cc/36df8c36-c74e-4dc2-bc03-87893f373cb4-FIORA.jpg')
    .addReply('🛒 Buy', '.buy burger')
    .toCard()
  )
  .addCard(await new Button(conn)
    .setTitle('🍕 Pizza')
    .setBody('Pizza mozzarella')
    .setFooter('$7')
    .setImage('https://cdn.ornzora.eu.cc/36df8c36-c74e-4dc2-bc03-87893f373cb4-FIORA.jpg')
    .addReply('🛒 Buy', '.buy pizza')
    .toCard()
  )
  .send(m.chat, { quoted: m });
// --- AIRich (semua fitur v4.6) ---
await new AIRich(conn)
  .setTitle('🚀 NIXCODE')
  .setFooter('© Fiora Sylvie')
  // Suggest pills — v4.6: default HScroll untuk banyak item
  .addSuggest('MessageBuilderV4.6')
  .addSuggest(['Nixel', 'NIXCODE', 'Fiora Sylvie', 'AIRich'])
  .addTip('Ini adalah text tip (Metadata Text)')
  // Teks + hyperlink trusted/untrusted + citation + LaTeX
  .addText(`
# Halo Dunia
## NIXCODE

---

=={ Yellow Text }==

---

## TRUSTED LINK
[Google](https://google.com)
## UNTRUSTED LINK (baru v4.6)
[Google](!https://google.com)

Ini auto citation:
[](https://openai.com)

Ini LaTeX:
[Shiroko|1429|1897]<https://cdn.ornzora.eu.cc/5442e78b-fe26-4cb9-939d-e6df83acad6a-FIORA.png>
  `)
  // Product
  .addText('SingleLayout Product (Object Input):')
  .addProduct({
    title: 'Nixel Bot',
    brand: 'Nixel',
    price: 'Rp 1.000',
    sale_price: 'Rp 0',
    url: 'https://wa.me/6285188349341',
    image: 'https://cdn.ornzora.eu.cc/152f4f0b-02fb-4d60-aacc-fc4cfa87ccdb-FIORA.jpg',
  })
  .addText('HScroll Product (Array of Object Input):')
  .addProduct(Array(5).fill({
    title: 'Nixel Bot',
    brand: 'Nixel',
    price: 'Rp 1.000',
    sale_price: 'Rp 0',
    url: 'https://wa.me/6285188349341',
    image: 'https://cdn.ornzora.eu.cc/152f4f0b-02fb-4d60-aacc-fc4cfa87ccdb-FIORA.jpg',
  }))
  // Code dengan bahasa baru (TypeScript)
  .addCode('typescript',
`class Nixel {
  static hello(): string {
    return 'Hello World';
  }
}`
  )
  // Table dengan IE support per cell (v4.6)
  .addTable([
    ['Nama', 'Role'],
    ['[Nixel](https://wa.me/6285188349341)', 'Developer'],
    ['Fiora Sylvie', 'Assistant'],
  ])
  // Source (favicon bisa Buffer/base64 di v4.6)
  .addSource([
    ['https://cdn.ornzora.eu.cc/dc85c945-96f7-4d50-aaa4-1dff7249aaf4-FIORA.jpg', 'https://github.com/ValdazGT/', 'GitHub'],
    ['https://cdn.ornzora.eu.cc/dc85c945-96f7-4d50-aaa4-1dff7249aaf4-FIORA.jpg', 'https://fiora.nixel.my.id/', 'Fiora Sylvie'],
  ])
  // Image (Buffer supported di v4.6)
  .addImage('https://cdn.ornzora.eu.cc/d987ff9c-c16c-4f1e-a8d6-953e375f4aec-FIORA.jpg')
  // Video — ⚠️ FORMAT BARU v4.6 (bukan url|detik lagi)
  .addVideo('https://cdn.ornzora.eu.cc/5c3e1109-38d3-408e-926c-588694fd9581-FIORA.mp4')
  .addVideo({
    url: 'https://cdn.ornzora.eu.cc/5c3e1109-38d3-408e-926c-588694fd9581-FIORA.mp4',
    file_length: 100000000,
    duration: 120,
    thumbnail: 'https://cdn.ornzora.eu.cc/0800269d-8f1e-4c7e-b38e-8684db560345-FIORA.jpg',
  })
  // Reels (Buffer/base64 supported di v4.6)
  .addReels(Array(5).fill({
    username: 'Nixel',
    profile: 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg',
    thumbnail: 'https://cdn.ornzora.eu.cc/0800269d-8f1e-4c7e-b38e-8684db560345-FIORA.jpg',
    url: 'https://fiora.nixel.my.id/',
    title: 'Demo Reel',
    source: 'IG',
    verified: true,
  }))
  // Post (profile/thumbnail/icon bisa Buffer di v4.6)
  .addPost(Array(5).fill({
    profile: 'https://cdn.ornzora.eu.cc/2498bf66-6870-4f8a-8421-0a77f7baa95b-FIORA.jpg',
    username: 'Nixel',
    title: 'Demo Post',
    subtitle: 'NIXCODE',
    caption: 'hii~ im fiora sylvie, just quietly observing things around here.',
    verified: true,
    url: 'https://fiora.nixel.my.id/',
    thumbnail: 'https://cdn.ornzora.eu.cc/7048efb4-2abf-4081-bdd1-2f65972d793a-FIORA.jpg',
    source: 'INSTAGRAM',
    footer: 'Fiora Sylvie',
    deeplink: 'https://fiora.nixel.my.id/',
    icon: 'https://cdn.ornzora.eu.cc/2498bf66-6870-4f8a-8421-0a77f7baa95b-FIORA.jpg',
    like: 1, comment: 1, share: 1,
  }))
  .send(m.chat, { quoted: m });



// REFERENSI CEPAT

//
// ─── Toolkit (BARU v4.6) ───
//   Toolkit.resize(buf, w, h, fit?)            Resize gambar pakai sharp
//   Toolkit.fetchBuffer(url, opts?, {silent})  Fetch URL → Buffer (silent default true)
//   Toolkit.toUrl(client, path, mediaType)     Upload ke WA CDN → URL
//   Toolkit.resolveMedia(client, media, type, opts)  Resolve media multi-format
//     opts: { resolveUrl, resolveWAUrl, result, resize, width, height }
//     result: 'url' | 'buffer' | 'base64'
//   Toolkit.getMp4Duration(buffer)             Baca durasi MP4 (pure JS)
//   Toolkit.getMp4Preview(buffer, opts)        Extract frame video (ffmpeg)
//     opts: { time, result, resize, width, height, silent }
//   Toolkit.extractIE(text, opts)              Parse inline entities
//     opts: { extract, hyperlink, citation, latex }
//     returns: { text, ie, inline_entities }
//   Toolkit.waitAllPromises(input)             Resolve semua nested promise
//
//    Button 
//   .setImage(url|Buffer)                  Header gambar
//   .setVideo(url|Buffer)                  Header video
//   .setDocument(url|Buffer)               Header dokumen
//   .setTitle(str)                         Judul header
//   .setSubtitle(str)                      Sub-judul header
//   .setBody(str)                          Isi pesan
//   .setFooter(str)                        Footer pesan
//   .setContextInfo(obj)                   ContextInfo kustom
//   .addPayload(obj)                       Merge payload tambahan
//   .addReply(text, id, opts?)             Tombol reply (opts.icon: DEFAULT|REVIEW|PROMOTION|DOCUMENT)
//   .addUrl(text, url, webview, opts?)     Tombol buka URL
//   .addCopy(text, code, opts?)            Tombol salin teks
//   .addCall(text, phone)                  Tombol telepon
//   .addLocation()                         Tombol kirim lokasi
//   .addReminder(text, id)                 Tombol reminder
//   .addCancelReminder(text, id)           Tombol batalkan reminder
//   .addAddress(text, id)                  Tombol pilih alamat
//   .addSelection(title)                   Dropdown list
//     .makeSection(title)
//       .makeRow(header, title, desc, id)
//   .addButton(name, params)               Tombol native flow kustom
//   .addRawButton(obj)                     Inject tombol mentah
//   .setParams(obj)                        messageParamsJson kustom
//   .toCard()                              Konversi ke card (untuk Carousel)
//   .build(jid, opts) / .send(jid, opts)
//
//   ButtonV2 
//   .setThumbnail(url|Buffer)              Thumbnail (di-resize 300×300 via Toolkit)
//   .setMedia(obj)                         Media kustom
//   .setTitle / .setSubtitle               Tampil di location bubble
//   .setBody / .setFooter
//   .addButton(displayText, id)            Tombol legacy
//   .addRawButton(obj)                     Inject tombol mentah
//   .build(jid, opts) / .send(jid, opts)
//
//    Carousel
//   .setBody(str) / .setFooter(str)
//   .addCard(card | card[])               Tambah card dari .toCard()
//   .build(jid, opts) / .send(jid, opts)
//
//      AIRich 
//   .setTitle(str)                        Disclaimer text di header bot
//   .setFooter(str)                       Tampil sbg MetadataText di akhir pesan
//   .addText(str, opts?)                  Paragraf teks
//                                         opts: { hyperlink, citation, latex }
//                                         [teks](url)   → trusted hyperlink
//                                         [teks](!url)  → untrusted hyperlink (BARU v4.6)
//                                         [](url)       → citation
//                                         [teks|w|h]<url> → LaTeX
//   .addTip(str)                          Teks tip/metadata (GenAIMetadataTextPrimitive)
//   .addSuggest(str | str[], opts?)       Suggest pills
//                                         opts: { scroll, layout }
//                                         layout auto: Single (1), HScroll (banyak, default v4.6),
//                                                      ActionRow ({ scroll: false })
//   .addCode(lang, code)                  Code block (v4.6: +TypeScript/Python/Java/Go/C/C++/PHP/Rust/HTML/Bash/Markdown)
//   .addTable(arr2d, opts?)               Tabel 2D (opts: { hyperlink, citation, latex } — BARU v4.6)
//   .addImage(url|Buffer | arr)           Grid gambar (Buffer supported v4.6)
//   .addVideo(url|Buffer|obj, opts?)      Video inline (BARU v4.6: object & autoFill)
//                                         obj: { url, thumbnail, duration, file_length, mime_type }
//                                         opts: { autoFill } (default true)
//                                         ❌ format 'url|detik' sudah DIHAPUS
//   .addProduct(obj|obj[])               Single/HScroll product
//   .addPost(obj|obj[])                  Post cards (HScroll)
//   .addReels(obj|obj[])                 Reel cards (HScroll)
//   .addSource(sources[])                Source cards [[favicon, url, title], ...]
//   .addSubmessage(obj|obj[])            Raw submessage inject
//   .addSection(obj|obj[])              Raw unified section inject
//   .build(opts)                         ⚠️ ASYNC di v4.6 — wajib await
//     opts: { forwarded, notification (BARU v4.6), includesUnifiedResponse,
//             includesSubmessages, quoted, quotedParticipant }
//   .send(jid, opts)                     Build + relayMessage
//
//   Static Utilities AIRich 
//   AIRich.tokenizer(code, lang)          Tokenize kode → codeBlocks + unified_codeBlock
//   AIRich.toTableMetadata(arr, opts)     Array 2D → tableMetadata (opts: {hyperlink,citation,latex})
//   AIRich.newLayout(name, data, extra?)  Buat layout section (extra = BARU v4.6)
//
// ⚠️ DEPRECATED / DIHAPUS di v4.6:
//   BaseBuilder.resize()    → Toolkit.resize()
//   BaseBuilder.fetchBuffer() → Toolkit.fetchBuffer()
//   addVideo('url|detik')   → addVideo({ url, duration }) atau addVideo('url') autoFill
