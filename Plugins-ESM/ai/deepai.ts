import crypto from 'crypto'
import { basename, extname } from 'path'
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { AIRich } from '../../Library/MessageBuilder.js'
import { botName, OWNER_WA, buildFkontak } from '../../Library/utils.js'

const AGENT = 'Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36'
const SALT  = 'hackers_become_a_little_stinkier_every_time_they_hack'
const md5     = (s: string) => crypto.createHash('md5').update(s).digest('hex')
const rev     = (s: string) => s.split('').reverse().join('')
const randIP  = () => Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 254)).join('.')
const mimeExt = (ext: string): string =>
  ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[ext.toLowerCase()] ?? 'application/octet-stream')

function genKey(): string {
  const r  = String(Math.floor(Math.random() * 1e11))
  const h1 = rev(md5(AGENT + r + SALT))
  const h2 = rev(md5(AGENT + h1))
  const h3 = rev(md5(AGENT + h2))
  return `tryit-${r}-${h3}`
}

async function deepaiEdit(buf: Buffer, prompt: string, filename = 'image.jpg'): Promise<string> {
  const ext = extname(filename) || '.jpg'
  let last  = 'request failed'

  for (let i = 0; i < 6; i++) {
    const form = new FormData()
    form.append('image', new Blob([buf], { type: mimeExt(ext) }), basename(filename))
    form.append('text',  prompt)
    form.append('image_generator_version', 'standard')

    try {
      const res  = await fetch('https://api.deepai.org/api/image-editor', {
        method:  'POST',
        headers: {
          accept:              '*/*',
          origin:              'https://deepai.org',
          referer:             'https://deepai.org/',
          'user-agent':        AGENT,
          'api-key':           genKey(),
          'x-forwarded-for':   randIP(),
        },
        body: form,
      })

      const json: any = await res.json().catch(() => null)
      if (json?.output_url) return json.output_url as string
      last = json?.status || `http ${res.status}`
    } catch (e: any) {
      last = e.message
    }
  }

  throw new Error(last)
}

async function getImageBuffer(m: any): Promise<Buffer | null> {
  const msg = m.message
  const imageMsg =
    msg?.imageMessage ||
    msg?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
    msg?.viewOnceMessage?.message?.imageMessage ||
    null

  if (!imageMsg) return null
  const stream = await downloadContentFromMessage(imageMsg, 'image')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

const handler = async (m: any, { Morela, text, reply, usedPrefix, command }: any) => {
  if (!text) {
    return reply(
      `🎨 *DEEPAI IMAGE EDIT*\n\n` +
      `> Edit gambar dengan AI menggunakan prompt teks!\n\n` +
      `╭──「 📌 Cara Pakai 」\n` +
      `│ (kirim/reply gambar)\n` +
      `│ ${usedPrefix}${command} <prompt>\n` +
      `╰─────────────────\n\n` +
      `*Contoh:*\n` +
      `> ${usedPrefix}${command} make it cinematic\n` +
      `> ${usedPrefix}${command} to anime style\n` +
      `> ${usedPrefix}${command} add snow effect\n` +
      `> ${usedPrefix}${command} make it look like night`
    )
  }

  const imgBuf = await getImageBuffer(m)
  if (!imgBuf) {
    return reply(`❌ Kirim atau reply gambar dulu!\n\n_Contoh: (reply foto) ${usedPrefix}${command} to anime_`)
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
  await reply(`🎨 Mengedit gambar...\n📝 Prompt: *${text}*`)

  try {
    const [resultUrl, ppUrl, fk] = await Promise.all([
      deepaiEdit(imgBuf, text),
      Morela.profilePictureUrl(Morela.user.id, 'image')
        .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg'),
      buildFkontak(Morela),
    ])

    await new AIRich(Morela)
      .setTitle('Ai Assistant')
      .addProduct({
        title:       '',
        brand:       botName,
        price:       '🎨 DeepAI Image Edit',
        sale_price:  '',
        product_url: OWNER_WA,
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })
      .addTip(' ')
      .addImage(resultUrl, { mimeType: 'image/jpeg' })
      .addSource([
        [
          'https://www.google.com/s2/favicons?domain=deepai.org&sz=16',
          'https://deepai.org',
          'DeepAI',
        ],
        [
          'https://www.google.com/s2/favicons?domain=whatsapp.com&sz=16',
          OWNER_WA,
          botName,
        ],
      ])
      .send(m.chat, { quoted: fk })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[DEEPAIEDIT]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Gagal edit gambar: ${e.message}`)
  }
}

handler.help    = ['deepaiedit <prompt> (reply gambar)']
handler.tags    = ['ai']
handler.command = ['deepaiedit', 'daedit', 'aiedit2']
handler.limit   = true

export default handler