import axios from "axios"
import FormData from "form-data"
import { downloadContentFromMessage } from "@itsliaaa/baileys"
import { ButtonV2, AIRich, Toolkit } from '../../Library/MessageBuilder.js'
import { botName, buildFkontak } from '../../Library/utils.js'

const THUMB_URL = 'https://cdn.ornzora.eu.cc/92fb27b5-5ffd-4f5f-905a-9b8d0573a1af-upload-1780208822400.jpg'

const sessions = new Map()

async function uploadImage(buffer: Buffer, morela: any): Promise<string> {
  try {
    const url = await Toolkit.toUrl(morela, buffer, 'image')
    if (url) return url
    throw new Error('CDN WA tidak mengembalikan URL')
  } catch {
    const form = new FormData()
    form.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' })
    const res = await axios.post('https://cdn.ornzora.eu.cc/upload', form, {
      headers: { ...form.getHeaders() },
      timeout: 30000, maxBodyLength: Infinity, maxContentLength: Infinity,
    })
    const data = res.data
    const url  = data?.url || data?.data?.url || data?.link || data?.data?.link ||
      (typeof data === 'string' && data.startsWith('https://') ? data.trim() : null)
    if (url) return url as string
    throw new Error('Upload gagal (CDN WA & Ornzora)')
  }
}

async function imageUpscaler(buffer: Buffer, filename: string, multiplier: number = 2): Promise<Buffer> {
  const pageRes = await fetch("https://www.iloveimg.com/id/tingkatkan-gambar", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
  })
  const html   = await pageRes.text()
  const token  = html.match(/"token":"([^"]+)"/)?.[1]
  const taskId = html.match(/ilovepdfConfig\.taskId\s*=\s*'([^']+)'/)?.[1]
  if (!token || !taskId) throw new Error("Gagal ambil token/taskId")

  const uploadForm = new FormData()
  uploadForm.append("name", filename)
  uploadForm.append("chunk", "0")
  uploadForm.append("chunks", "1")
  uploadForm.append("task", taskId)
  uploadForm.append("preview", "1")
  uploadForm.append("pdfinfo", "0")
  uploadForm.append("pdfforms", "0")
  uploadForm.append("pdfresetforms", "0")
  uploadForm.append("v", "web.0")
  uploadForm.append("file", buffer, { filename, contentType: "image/jpeg" })

  const uploadRes = await axios.post(
    "https://api1g.iloveimg.com/v1/upload",
    uploadForm,
    {
      headers: {
        ...uploadForm.getHeaders(),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Authorization": `Bearer ${token}`
      }
    }
  )
  const serverFilename = uploadRes.data?.server_filename
  if (!serverFilename) throw new Error("Upload gagal")

  const processForm = new FormData()
  processForm.append("packaged_filename", "iloveimg-upscaled")
  processForm.append("multiplier", String(multiplier))
  processForm.append("task", taskId)
  processForm.append("tool", "upscaleimage")
  processForm.append("files[0][server_filename]", serverFilename)
  processForm.append("files[0][filename]", filename)

  const processRes = await axios.post(
    "https://api1g.iloveimg.com/v1/process",
    processForm,
    {
      headers: {
        ...processForm.getHeaders(),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Authorization": `Bearer ${token}`,
        "Origin": "https://www.iloveimg.com"
      }
    }
  )
  if (processRes.data?.status !== "TaskSuccess")
    throw new Error("Processing gagal: " + JSON.stringify(processRes.data))

  const downloadRes = await axios.get(
    `https://api1g.iloveimg.com/v1/download/${taskId}`,
    {
      responseType: "arraybuffer",
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    }
  )
  return Buffer.from(downloadRes.data)
}

const handler = async (m: any, { Morela, reply, command }: any) => {

  if (command === "hdv2_2x" || command === "hdv2_4x") {
    const multiplier = command === "hdv2_4x" ? 4 : 2
    const emoji      = multiplier === 2 ? "⚡" : "🚀"

    const sessionData = sessions.get(m.sender)
    if (!sessionData) return reply(
      `╭──「 ❌ *Session Expired* 」\n` +
      `│\n` +
      `│  Kirim ulang gambar dengan *.hdv2*\n` +
      `╰─────────────────────`
    )

    sessions.delete(m.sender)
    await Morela.sendMessage(m.chat, { react: { text: "⏳", key: m.key } })
    await reply(`🔄 Sedang upscale ${multiplier}x...\n_Harap tunggu sebentar_`)

    try {

      const resultBuffer = await imageUpscaler(sessionData.buffer, sessionData.filename, multiplier)
      const sizeBefore   = (sessionData.buffer.length / 1024).toFixed(1)
      const sizeAfter    = (resultBuffer.length / 1024).toFixed(1)

      const hdUrl = await uploadImage(resultBuffer, Morela)
      if (!hdUrl) throw new Error("Gagal upload hasil upscale")

      const fk    = await buildFkontak(Morela)
      const ppUrl = await Morela.profilePictureUrl(Morela.user.id, 'image')
        .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')

      await new AIRich(Morela)
        .setTitle(`${emoji} Upscale ${multiplier}x Selesai | ${sizeBefore} KB → ${sizeAfter} KB`)
        .addProduct({
          title:       '',
          brand:       botName,
          price:       `HD Upscaler v2 ${multiplier}x`,
          sale_price:  '',
          product_url: 'https://wa.me/628999889149',
          icon_url:    ppUrl,
          image_url:   ppUrl,
        })
        .addTip(' ')
        .addImage(hdUrl, { mimeType: 'image/jpeg' })
        .addSource([
          ['https://www.google.com/s2/favicons?domain=whatsapp.com&sz=16', 'https://wa.me/628999889149', botName],
          ['https://www.google.com/s2/favicons?domain=github.com&sz=16', 'https://github.com', 'GitHub Morela'],
        ])
        .send(m.chat, { quoted: fk })

      await Morela.sendMessage(m.chat, { react: { text: "✅", key: m.key } })

    } catch (e) {
      await Morela.sendMessage(m.chat, { react: { text: "❌", key: m.key } })
      reply(
        `╭──「 ❌ *Upscale Gagal* 」\n` +
        `│\n` +
        `│  ${(e as Error)?.message || e}\n` +
        `╰─────────────────────`
      )
    }
    return
  }

  const msg = m.message
  const img = msg?.imageMessage ||
    msg?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

  if (!img) return reply(
    `╭──「 🖼️ *Image Upscaler* 」\n` +
    `│\n` +
    `│  Kirim atau reply foto dengan\n` +
    `│  caption *.hdv2*\n` +
    `│\n` +
    `╰─────────────────────`
  )

  await Morela.sendMessage(m.chat, { react: { text: "⏳", key: m.key } })

  let buffer: Buffer
  try {
    const stream = await downloadContentFromMessage(img, "image")
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk)
    buffer = Buffer.concat(chunks)

    if (!buffer || buffer.length === 0) throw new Error("Buffer kosong")
    if (buffer.length < 1000)           throw new Error("Gambar terlalu kecil / corrupt")
    if (buffer.length > 5 * 1024 * 1024) {
      await Morela.sendMessage(m.chat, { react: { text: "❌", key: m.key } })
      return reply("❌ Gambar terlalu besar! Maks *5MB*")
    }
  } catch (err) {
    await Morela.sendMessage(m.chat, { react: { text: "❌", key: m.key } })
    return reply("❌ Gagal download gambar: " + (err as Error).message)
  }

  sessions.set(m.sender, {
    buffer,
    filename: `image_${Date.now()}.jpg`
  })

  let menuBuf: Buffer | null = null
  try {
    const thumbRes = await axios.get(THUMB_URL, { responseType: 'arraybuffer', timeout: 10000 })
    menuBuf = Buffer.from(thumbRes.data)
  } catch {
    menuBuf = null 
  }

  try {
    const btn = new ButtonV2(Morela)
      .setTitle('🖼️ Image Upscaler')
      .setSubtitle(`📁 ${(buffer.length / 1024).toFixed(1)} KB`)
      .setBody(`Pilih level upscale:`)
      .setFooter(`© ${botName} • ⚡ 2x Cepat & ringan | 🚀 4x Kualitas maksimal`)

    if (menuBuf) btn.setThumbnail(menuBuf)

    btn.addButton('⚡ 2x', '.hdv2_2x')
    btn.addButton('🚀 4x', '.hdv2_4x')

    const builtMsg = await btn.build(m.chat, { quoted: m })
    await Morela.relayMessage(m.chat, builtMsg.message, { messageId: builtMsg.key.id })
    await Morela.sendMessage(m.chat, { react: { text: "✅", key: m.key } })

  } catch (e) {
    console.error('[HDV2] ButtonV2 error:', (e as Error).message)
    reply('❌ Gagal tampilkan pilihan: ' + (e as Error).message)
  }
}

handler.help    = ["hdv2 <reply foto>"]
handler.tags    = ["tools"]
handler.command = ["hdv2", "hdv2_2x", "hdv2_4x"]

export default handler