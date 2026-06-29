import fetch      from 'node-fetch'
import FormData   from 'form-data'
import { fileTypeFromBuffer } from 'file-type'
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { botName, buildFkontak } from '../../Library/utils.js'
import { AIRich } from '../../Library/MessageBuilder.js'

const BASE_URL   = 'https://math-gpt.pro'
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36'

async function getCsrfToken() {
  const response = await fetch(BASE_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  })
  const html    = await response.text()
  const cookies = response.headers.raw()['set-cookie']
  const tokenMatch = html.match(/name="csrf-token" content="([^"]+)"/i) ||
    html.match(/csrf[_-]?token["']?\s:\s["']([^"']+)["']/i)
  if (!tokenMatch) throw new Error('CSRF token tidak ditemukan')
  let xsrf = '', session = ''
  if (cookies) {
    cookies.forEach((cookie: unknown) => {
      if (cookie.includes('XSRF-TOKEN='))     xsrf    = cookie.split('XSRF-TOKEN=')[1].split(';')[0]
      if (cookie.includes('laravel_session=')) session = cookie.split('laravel_session=')[1].split(';')[0]
    })
  }
  return { token: tokenMatch[1], cookie: `XSRF-TOKEN=${xsrf}; laravel_session=${session}` }
}

async function uploadImage(buffer: Buffer, csrf: unknown) {
  const fileType = await fileTypeFromBuffer(buffer)
  const form = new FormData()
  form.append('image', buffer, {
    filename:    `image.${fileType?.ext || 'jpg'}`,
    contentType: fileType?.mime || 'image/jpeg'
  })
  form.append('_token', csrf.token)
  const response = await fetch(`${BASE_URL}/upload-image`, {
    method:  'POST',
    headers: {
      'User-Agent':        USER_AGENT,
      'X-Requested-With':  'XMLHttpRequest',
      'Cookie':            csrf.cookie,
      ...form.getHeaders()
    },
    body: form
  })
  if (!response.ok) throw new Error(`Upload gagal: HTTP ${response.status}`)
  const result = await response.json()
  if (!result.file) throw new Error('Upload gagal: Tidak ada file')
  return result.file
}

async function chatAI(message: string, imageFile: unknown, csrf: unknown) {
  const body: any = { message, _token: csrf.token }
  if (imageFile) body.image = imageFile
  const response = await fetch(`${BASE_URL}/chat`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'User-Agent':    USER_AGENT,
      'X-CSRF-TOKEN':  csrf.token,
      'Cookie':        csrf.cookie
    },
    body: JSON.stringify(body)
  })
  if (!response.ok) throw new Error(`Chat gagal: HTTP ${response.status}`)
  const result = await response.json()
  if (!result.reply) throw new Error('Tidak ada respon dari AI')
  return result.reply
}

function latexToImgUrl(expr: string, isBlock = false): string {
  const dpi   = isBlock ? 150 : 120
  const clean = expr.trim()

  const encoded = encodeURIComponent(`\\dpi{${dpi}}\\bg{transparent}\\color{white}${clean}`)
  return `https://latex.codecogs.com/png.image?${encoded}`
}

function parseLatexToAIRich(text: string): string {
  let out = text

  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    const url = latexToImgUrl(expr.trim(), true)
    return `\n[${expr.trim().slice(0, 30)}|600|150]<${url}>\n`
  })

  out = out.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => {
    const url = latexToImgUrl(expr.trim(), true)
    return `\n[${expr.trim().slice(0, 30)}|600|150]<${url}>\n`
  })

  out = out.replace(/\\\((.+?)\\\)/g, (_, expr) => {
    const url = latexToImgUrl(expr.trim(), false)
    return `[${expr.trim().slice(0, 20)}|300|60]<${url}>`
  })

  out = out.replace(/(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)/g, (_, expr) => {
    if (!expr.trim()) return _
    const url = latexToImgUrl(expr.trim(), false)
    return `[${expr.trim().slice(0, 20)}|300|60]<${url}>`
  })

  return out
}

const handler = async (m: any, { Morela, text, usedPrefix, command, reply, downloadContentFromMessage: dlc }: any) => {
  const quoted = m.quoted || m
  const mime   = quoted.mimetype || quoted.message?.imageMessage?.mimetype || ''
  const hasImg = mime.startsWith('image/')

  if (!text && !hasImg) return reply(
    `╭╌「 🧮 *MathGPT Pro* 」\n` +
    `┃ Contoh:\n` +
    `┃ *.${command} integral x^2*\n` +
    `┃\n` +
    `┃ Atau reply gambar soal:\n` +
    `┃ *.${command}*\n` +
    `┃ *.${command} jelaskan ini*\n` +
    `╰╌\n\n© ${botName}`
  )

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  try {
    const csrf = await getCsrfToken()
    let imageFile = null

    if (hasImg) {
      const imgMsg = quoted.message?.imageMessage || quoted
      const stream = await (dlc || downloadContentFromMessage)(imgMsg, 'image')
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk)
      const buffer = Buffer.concat(chunks)
      imageFile = await uploadImage(buffer, csrf)
    }

    const prompt = text || 'Solve this problem'
    const answer = await chatAI(prompt, imageFile, csrf)

    const parsedAnswer = parseLatexToAIRich(answer.trim())

    const fk    = await buildFkontak(Morela)
    const ppUrl = await Morela.profilePictureUrl(Morela.user.id, 'image')
      .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')

    await new AIRich(Morela)
      .setTitle('🧮 MathGPT Pro')
      .addProduct({
        title:       'MathGPT Pro',
        brand:       botName,
        price:       hasImg ? '📷 Image Mode' : '✏️ Text Mode',
        sale_price:  '',
        product_url: 'https://wa.me/628999889149',
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })
      .addText(
        `## 📝 Soal\n${prompt}\n\n---\n\n## 🔍 Jawaban\n\n${parsedAnswer}`
      )
      .addSource([
        ['https://www.google.com/s2/favicons?domain=whatsapp.com&sz=16', 'https://wa.me/628999889149', botName],
        ['https://www.google.com/s2/favicons?domain=math-gpt.pro&sz=16', 'https://math-gpt.pro', 'MathGPT Pro'],
        ['https://www.google.com/s2/favicons?domain=codecogs.com&sz=16', 'https://latex.codecogs.com', 'CodeCoGS LaTeX'],
      ])
      .send(m.chat, { quoted: fk || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[MATHGPT]', e.message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply('❌ Error: ' + e.message)
  }
}

handler.help    = ['mathgpt <teks/reply gambar soal>']
handler.tags    = ['ai']
handler.command = ['mathgpt', 'math', 'mathgptpro']

export default handler
