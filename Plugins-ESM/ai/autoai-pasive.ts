import axios from 'axios'
import { AIRich } from '../../Library/MessageBuilder.js'

if (!(globalThis).__aiStatus__)   (globalThis).__aiStatus__   = {}
if (!(globalThis).__aiHistory__)  (globalThis).__aiHistory__  = {}

const delay       = ms => new Promise(res => setTimeout(res, ms))
const MAX_HISTORY = 10

const API_URL = 'https://api-faa.my.id/faa/gpt-promt'

const SYSTEM_PROMPT = `Lo Morela. Cowok yang gampang ilfil, cuek, dan males ngeladenin orang.
Tiap ada yang ngomong, lo dengerin tapi respons lo singkat, kering, kadang nyelekit.
Nada lo kayak orang yang udah capek duluan sebelum ngobrol.
Kalo ada yang lebay atau drama, lo langsung jutek atau sindir pelan-pelan.
Kalo ada yang nanya hal gampang, lo jawab dengan nada "masa gitu aja nanya".
Kalo diajak bercanda, lo ikutan tapi tetep nggak antusias — kayak "yaudah lucu, terus?".
Kalo ada yang curhat, lo dengerin tapi respons lo datar, nggak lebay empati.
Pakai bahasa gaul Indonesia yang natural. Sesekali boleh anjg/jir tapi jangan maksa.
JANGAN panjang-panjang. JANGAN nanya balik mulu. JANGAN pakai emoji lebay.
JANGAN sebut lo AI atau Morela di awal kalimat. Langsung jawab aja.
Lo bukan asisten. Lo males. Lo cuek. Tapi lo tetep tau jawabannya.`

function getHistory(userId, chatId) {
  const key = `${chatId}:${userId}`
  if (!(globalThis).__aiHistory__[key])
    (globalThis).__aiHistory__[key] = []
  return (globalThis).__aiHistory__[key]
}

function pushHistory(userId, chatId, role, text) {
  const key     = `${chatId}:${userId}`
  const history = (globalThis).__aiHistory__[key] || []
  history.push({ role, text })
  if (history.length > MAX_HISTORY * 2) history.splice(0, 2)
  ;(globalThis).__aiHistory__[key] = history
}

function clearHistory(userId, chatId) {
  const key = `${chatId}:${userId}`
  ;(globalThis).__aiHistory__[key] = []
}

function buildMessage(history, newText) {
  if (history.length === 0) return newText
  let ctx = 'Konteks percakapan sebelumnya:\n'
  for (const h of history) {
    ctx += h.role === 'user' ? `User: ${h.text}\n` : `Morela: ${h.text}\n`
  }
  return ctx + `\nUser: ${newText}`
}

function cleanResponse(text) {
  if (!text) return text
  return text.replace(/^[\w\s]{1,30}:\s*/i, '').trim()
}

async function callAI(history, text) {
  const message  = buildMessage(history, text)
  const fullText = `[SYSTEM: ${SYSTEM_PROMPT}]\n\n${message}`
  const { data } = await axios.get(API_URL, {
    params: {
      prompt: SYSTEM_PROMPT,
      text:   fullText
    },
    timeout: 20000
  })
  if (!data?.status || !data?.result) return null
  return cleanResponse(data.result.trim())
}

function hasCodeBlock(text) {
  return /```[\s\S]*?```/.test(text)
}

function stripMarkdown(text) {
  if (!text) return text
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g)
  return parts.map((part, i) => {
    if (i % 2 === 1) return part
    return part
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
      .replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, '$1')
      .replace(/__([\s\S]*?)__/g, '$1')
      .replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '$1')
      .replace(/^[ \t]*[*\-]\s+/gm, '🔹 ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*+/g, '')
  }).join('').trim()
}

async function sendAsAIRich(Morela, jid, rawText, quoted) {
  try {
    const ppUrl = await Morela.profilePictureUrl(Morela.user.id, 'image')
      .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')

    const segments = rawText.split(/(```[a-zA-Z]*\n[\s\S]*?```)/gi)

    const builder = new AIRich(Morela).setTitle('AI')
    builder.addProduct({
      title: '', brand: 'Morela', price: '', sale_price: '',
      product_url: 'https://wa.me/628999889149',
      icon_url: ppUrl, image_url: ppUrl,
    })
    builder.addTip(' ')

    let hasContent = false
    for (const seg of segments) {
      const trimmed = seg.trim()
      if (!trimmed) continue
      const codeMatch = trimmed.match(/^```([a-zA-Z]*)\n([\s\S]*?)```$/i)
      if (codeMatch) {
        const lang = codeMatch[1]?.trim() || 'javascript'
        const code = codeMatch[2] || ''
        if (code.trim()) { builder.addCode(lang, code); hasContent = true }
      } else {
        const plainText = stripMarkdown(trimmed)
        if (plainText.trim()) { builder.addTip(plainText); hasContent = true }
      }
    }

    if (!hasContent) throw new Error('no content')
    await builder.send(jid, { quoted })
    return true
  } catch {
    return false
  }
}

const handler = {
  tags: ['passive', 'ai'],

  handler: async (m, { Morela, fkontak }) => {
    try {
      if (!m.message)                                return
      if (m.message?.reactionMessage)               return
      if (m.message?.protocolMessage)               return
      if (m.message?.senderKeyDistributionMessage)  return
      if (m.chat === 'status@broadcast')            return
      if (m.key?.fromMe)                            return
      if (!m.isGroup)                               return
      if (!(globalThis).__aiStatus__[m.chat])       return

      const text = m.body || m.text || ''
      if (!text) return
      if (/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/i.test(text)) return

      const userId = m.sender || m.key?.participant || ''

      if (/^(reset|lupa|forget|clear)$/i.test(text.trim())) {
        clearHistory(userId, m.chat)
        return Morela.sendMessage(m.chat, {
          text: 'oke, gue udah lupa semua.'
        }, { quoted: fkontak || m })
      }

      const history = getHistory(userId, m.chat)
      const answer  = await callAI(history, text)
      if (!answer) return

      pushHistory(userId, m.chat, 'user', text)
      pushHistory(userId, m.chat, 'ai', answer)

      await Morela.sendPresenceUpdate('composing', m.chat)
      await delay(Math.min(2000, 500 + answer.length * 10))
      await Morela.sendPresenceUpdate('paused', m.chat)

      if (hasCodeBlock(answer)) {

        const sent = await sendAsAIRich(Morela, m.chat, answer, fkontak || m)
        if (!sent) await Morela.sendMessage(m.chat, { text: stripMarkdown(answer) }, { quoted: fkontak || m })
      } else {

        try {
          const ppUrl = await Morela.profilePictureUrl(Morela.user.id, 'image')
            .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')
          const stripped = stripMarkdown(answer)
          const builder  = new AIRich(Morela).setTitle('AI')
          builder.addProduct({
            title: '', brand: 'Morela', price: 'Rp 0', sale_price: '',
            product_url: 'https://wa.me/628999889149',
            icon_url: ppUrl, image_url: ppUrl,
          })
          for (const line of stripped.split('\n').filter(Boolean)) {
            builder.addTip(line)
          }
          await builder.send(m.chat, { quoted: fkontak || m })
        } catch {
          await Morela.sendMessage(m.chat, { text: answer }, { quoted: fkontak || m })
        }
      }

    } catch {

    }
  }
}

export default handler
