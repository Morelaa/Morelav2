import axios from 'axios'
import sharp from 'sharp'

const handler = async (m: any, { Morela, args, reply, fkontak }: any) => {
  const input = args.join(' ').trim()

  if (!input) return reply('Contoh: .emojimix 😎 😭')

  const parts = input.split(/[\s+|]+/).filter(Boolean)
  if (parts.length < 2) return reply('❌ Masukkan 2 emoji\nContoh: .emojimix 😎 😭')

  const [emoji1, emoji2] = parts

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  try {
    const q = `${emoji1}_${emoji2}`
    const { data } = await axios.get('https://api.neoxr.eu/api/emoji', {
      params: { q, apikey: global.apiKeys.neoxr },
      timeout: 15000
    })

    if (!data?.status || !data?.data?.url) throw new Error(data?.message || 'Emoji mix tidak tersedia')

    const imgRes = await axios.get(data.data.url, { responseType: 'arraybuffer', timeout: 15000 })

    const webp = await sharp(Buffer.from(imgRes.data))
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp()
      .toBuffer()

    await Morela.sendMessage(m.chat, { sticker: webp }, { quoted: fkontak || m })
    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[EMOJIMIX]', e?.message || e)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Gagal emojimix: ${e?.message || 'Coba kombinasi emoji lain'}`)
  }
}

handler.command = ['emojimix', 'emix']
handler.tags    = ['sticker']
handler.help    = ['emojimix <emoji1> <emoji2>']

export default handler
