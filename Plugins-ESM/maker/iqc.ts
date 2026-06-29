import axios from "axios"
import FormData from "form-data"
import { buildFkontak, botName } from '../../Library/utils.js'
import { AIRich, Toolkit } from '../../Library/MessageBuilder.js'

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

function randomTime() {
  const h = Math.floor(Math.random() * 24).toString().padStart(2, "0")
  const m = Math.floor(Math.random() * 60).toString().padStart(2, "0")
  return `${h}:${m}`
}

const handler = async (m: any, { Morela, reply, text }: any) => {
  const input = text?.trim()
  if (!input) return reply("Contoh: .iqc teks lu, jangan kosong gitu doang")

  await Morela.sendMessage(m.chat, { react: { text: "⏳", key: m.key } })

  try {
    const res = await axios.get("https://api.deline.web.id/maker/iqc", {
      params: {
        text:          input,
        chatTime:      randomTime(),
        statusBarTime: randomTime()
      },
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: "image/*"
      },
      timeout: 30000
    })

    const type = res.headers["content-type"] || ""
    if (!type.startsWith("image/")) throw new Error("Bukan gambar")

    const imgBuf = Buffer.from(res.data)
    const imgUrl = await uploadImage(imgBuf, Morela)
    if (!imgUrl) throw new Error("Gagal upload gambar ke hosting")

    const fk    = await buildFkontak(Morela)
    const ppUrl = await Morela.profilePictureUrl(Morela.user.id, 'image')
      .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')

    await new AIRich(Morela)
      .setTitle(`📱 Ai Assistant`)
      .addProduct({
        title:       '',
        brand:       botName,
        price:       'iPhone Quoted Chat',
        sale_price:  '',
        product_url: 'https://wa.me/628999889149',
        icon_url:    ppUrl,
        image_url:   ppUrl,
      })
      .addTip(' ')
      .addImage(imgUrl, { mimeType: 'image/jpeg' })
      .addSource([
        ['https://www.google.com/s2/favicons?domain=whatsapp.com&sz=16', 'https://wa.me/628999889149', botName],
        ['https://www.google.com/s2/favicons?domain=github.com&sz=16', 'https://github.com', 'GitHub Morela'],
      ])
      .send(m.chat, { quoted: fk })

    await Morela.sendMessage(m.chat, { react: { text: "✅", key: m.key } })

  } catch (e) {
    console.error("[IQC ERROR]", (e as Error).message)
    await Morela.sendMessage(m.chat, { react: { text: "❌", key: m.key } })
    reply("❌ Gagal. mungkin request lo juga ga jelas.\nError: " + (e as Error).message)
  }
}

handler.command = ["iqc"]
handler.tags    = ["tools"]
handler.help    = ["iqc <teks>"]

export default handler