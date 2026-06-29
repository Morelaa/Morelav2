import axios from 'axios'

const handler = async (m: any, { Morela, text, reply, fkontak }: any) => {
  if (!text) return reply(
    `╭──「 🎮 *Fake Free Fire* 」\n` +
    `│\n` +
    `│  📌 *Cara pakai:*\n` +
    `│  .fakeff <nama>\n` +
    `│\n` +
    `│  *Contoh:*\n` +
    `│  .fakeff Being Rizky\n` +
    `│\n` +
    `╰─────────────────────`
  )

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  try {
    const { data } = await axios.get('https://api.neoxr.eu/api/fflobby', {
      params: { text: text.trim(), apikey: global.apiKeys.neoxr },
      timeout: 20000
    })

    if (!data?.status || !data?.data?.url) throw new Error(data?.message || 'Gagal generate gambar')

    const imgRes = await axios.get(data.data.url, { responseType: 'arraybuffer', timeout: 20000 })

    await Morela.sendMessage(m.chat, {
      image:   Buffer.from(imgRes.data),
      caption: `🎮 *Fake Free Fire*\n\n👤 Nama: *${text.trim()}*`
    }, { quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    console.error('[FAKEFF]', e?.message || e)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Gagal buat Fake FF: ${e?.message}`)
  }
}

handler.command = ['fakeff']
handler.tags    = ['maker']
handler.help    = ['fakeff <nama>']

export default handler
