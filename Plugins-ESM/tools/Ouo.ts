import axios from 'axios'
import { botName } from '../../Library/utils.js'

const API_KEY = global.apiKeys.bypass
const API_URL = 'https://api.theresav.biz.id/bypass/ouo'

const handler = async (m: any, { Morela, reply, text, usedPrefix, command, fkontak }: any) => {
  if (!text) return reply(
    `╭╌╌⬡「 🔓 *ʙʏᴘᴀꜱꜱ ᴏᴜᴏ.ɪᴏ* 」\n` +
    `┃\n` +
    `┃ 📌 *Format:*\n` +
    `┃ \`${usedPrefix}${command} <url>\`\n` +
    `┃\n` +
    `┃ 📝 *Contoh:*\n` +
    `┃ \`${usedPrefix}${command} https://ouo.io/xxxxxxxx\`\n` +
    `┃\n` +
    `╰╌╌⬡\n\n© ${botName}`
  )

  const url = text.trim()
  if (!url.startsWith('http')) return reply('❌ URL tidak valid, harus diawali *https://*')

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  try {
    const res = await axios.get(API_URL, {
      params: { url, apikey: API_KEY },
      timeout: 30000
    })

    const data = res.data
    if (!data?.status || !data?.result) {
      throw new Error(data?.message || 'Gagal bypass, coba link lain')
    }

    await Morela.sendMessage(m.chat, {
      text:
        `╭╌╌⬡「 🔓 *ʙʏᴘᴀꜱꜱ ᴏᴜᴏ.ɪᴏ* 」\n` +
        `┃\n` +
        `┃ 🔗 *Input  :*\n` +
        `┃ ${data.input}\n` +
        `┃\n` +
        `┃ ✅ *Result :*\n` +
        `┃ ${data.result}\n` +
        `┃\n` +
        `╰╌╌⬡\n\n© ${botName}`
    }, { quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Bypass gagal\n\n${(e as Error).message}`)
  }
}

handler.command  = ['bypassouo']
handler.tags     = ['tools']
handler.help     = ['bypassouo <url>']
handler.noLimit  = false
handler.owner    = false
handler.premium  = false
handler.group    = false
handler.private  = false
handler.admin    = false
handler.botAdmin = false

export default handler
