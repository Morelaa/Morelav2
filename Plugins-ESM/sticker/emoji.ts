import axios from 'axios'
import sharp from 'sharp'

// Noto: pakai semua codepoint termasuk fe0f
const toNotoCode = (e: string) =>
  [...e].map((c: any) => c.codePointAt(0).toString(16)).join('-')

// Twemoji: buang variation selector fe0f
const toTwemojiCode = (e: string) =>
  [...e].map((c: any) => c.codePointAt(0).toString(16)).filter((cp: string) => cp !== 'fe0f').join('-')

// Emoji wajah/kepala = range unicode face/person
const FACE_RANGES = [
  [0x1F600, 0x1F64F], // 😀–🙏 Emoticons
  [0x1F910, 0x1F92F], // 🤐–🤯 Supplemental faces
  [0x1F970, 0x1F97A], // 🥰–🥺
  [0x1F9D0, 0x1F9D0], // 🧐
  [0x1FAE0, 0x1FAE8], // 🫠–🫨 newest faces
  [0x263A, 0x263A],   // ☺️
  [0x1F62D, 0x1F62D], // 😭
]

function isFaceEmoji(emoji: string): boolean {
  const cp = [...emoji][0]?.codePointAt(0) ?? 0
  return FACE_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 })
    if (res.status === 200 && res.data?.byteLength > 100) return Buffer.from(res.data)
    return null
  } catch {
    return null
  }
}

async function toStickerWebp(buf: Buffer): Promise<Buffer> {
  // Cek apakah sudah webp (animasi atau static)
  const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46

  if (isWebp) {
    // Langsung resize tanpa konversi format — jaga kualitas & animasi
    return sharp(buf, { animated: true })
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 100, lossless: true })
      .toBuffer()
  }

  // PNG/JPG: resize dengan kualitas tinggi, background transparan
  return sharp(buf)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3, // upscale berkualitas tinggi
    })
    .webp({ quality: 100, lossless: true })
    .toBuffer()
}

const handler = async (m: any, { Morela, args, reply, fkontak }: any) => {
  const emoji = args.join('').trim()

  if (!emoji) {
    return reply(
      '🎭 *EMOJI STICKER*\n\n' +
      'Kirim emoji, bot jadikan stiker!\n\n' +
      '╭──「 📌 Cara Pakai 」\n' +
      '│ .emoji <emoji>\n' +
      '╰─────────────────\n\n' +
      '*Contoh:*\n' +
      '> .emoji 😀\n' +
      '> .emoji ❤️\n' +
      '> .emoji 💀\n' +
      '> .emoji 🔥'
    )
  }

  const isFace   = isFaceEmoji(emoji)
  const notoCode = toNotoCode(emoji)
  const twCode   = toTwemojiCode(emoji)

  // Urutan sumber: prioritaskan yang paling tinggi resolusi & kualitas
  const sources = isFace
    ? [
        // Face: Noto animasi 512 webp → Noto static 512 png → Twemoji SVG render → fallback
        'https://fonts.gstatic.com/s/e/notoemoji/latest/' + notoCode + '/512.webp',
        'https://fonts.gstatic.com/s/e/notoemoji/latest/' + notoCode + '/512.gif',
        'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u' + notoCode.replace(/-/g, '_') + '.png',
        'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/' + twCode + '.svg',
        'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/' + twCode + '.png',
      ]
    : [
        // Non-face (hati, api, dll): Noto 512px PNG dulu (resolusi tinggi), baru Twemoji
        'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u' + notoCode.replace(/-/g, '_') + '.png',
        'https://fonts.gstatic.com/s/e/notoemoji/latest/' + notoCode + '/512.webp',
        'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/' + twCode + '.svg',
        'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/' + twCode + '.png',
        'https://emojicdn.elk.sh/' + encodeURIComponent(emoji) + '?style=google',
      ]

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  let buf: Buffer | null = null
  for (const url of sources) {
    buf = await fetchBuffer(url)
    if (buf) break
  }

  if (!buf) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply('❌ Emoji tidak ditemukan: ' + emoji + '\n\nPastikan input adalah emoji yang valid.')
  }

  const sticker = await toStickerWebp(buf)

  await Morela.sendMessage(
    m.chat,
    { sticker },
    { quoted: fkontak || m }
  )
  await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
}

handler.help    = ['emoji <emoji>']
handler.tags    = ['sticker']
handler.command = ['emoji', 'emojisticker', 'es']

export default handler