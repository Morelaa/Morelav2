import axios from 'axios'
import { botName } from '../../Library/utils.js'

const MODELS = ['flux', 'flux-realism', 'flux-anime', 'flux-3d', 'turbo']

async function generateImage(prompt: string, model = 'flux'): Promise<Buffer> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?model=${model}&width=1024&height=1024&nologo=true&seed=${Date.now()}&enhance=true`

  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })
  const buf = Buffer.from(res.data)
  if (buf.byteLength < 5000) throw new Error('Gambar tidak valid atau terlalu kecil')
  return buf
}

const handler = async (m: any, { Morela, text, usedPrefix, command, reply, fkontak }: any) => {
  if (!text) return reply(
    `╭──「 🎨 *AI Image Generator* 」\n` +
    `│\n` +
    `│  Masukkan deskripsi gambar!\n` +
    `│\n` +
    `│  📌 *Contoh:*\n` +
    `│  ${usedPrefix}${command} anime girl with sword\n` +
    `│  ${usedPrefix}${command} anime:realistic city at night\n` +
    `│  ${usedPrefix}${command} 3d:cute robot\n` +
    `│\n` +
    `│  🎭 *Model (prefix):*\n` +
    `│  anime: flux-anime\n` +
    `│  real:  flux-realism\n` +
    `│  3d:    flux-3d\n` +
    `│  fast:  turbo\n` +
    `│  (default: flux)\n` +
    `╰─────────────────────`
  )

  let model   = 'flux'
  let prompt  = text

  if (text.startsWith('anime:'))  { model = 'flux-anime';    prompt = text.slice(6).trim() }
  else if (text.startsWith('real:'))   { model = 'flux-realism'; prompt = text.slice(5).trim() }
  else if (text.startsWith('3d:'))     { model = 'flux-3d';      prompt = text.slice(3).trim() }
  else if (text.startsWith('fast:'))   { model = 'turbo';        prompt = text.slice(5).trim() }

  await Morela.sendMessage(m.chat, { react: { text: '🎨', key: m.key } })
  await Morela.sendMessage(m.chat,
    { text: `⏳ Mohon tunggu...` },
    { quoted: fkontak || m }
  )

  try {
    const imgBuf = await generateImage(prompt, model)

    await Morela.sendMessage(m.chat, {
      image:   imgBuf,
      caption: `© ${botName}`
    }, { quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply('❌ Gagal generate gambar: ' + (e as Error).message)
    console.error('[IMG GEN ERROR]', (e as Error).message)
  }
}

handler.command  = ['image', 'img', 'imagine', 'gen']
handler.tags     = ['ai']
handler.help     = ['image <prompt>']
handler.noLimit  = false
handler.owner    = false
handler.premium  = false
handler.group    = false
handler.private  = false
handler.admin    = false
handler.botAdmin = false

export default handler
