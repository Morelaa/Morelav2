import { botName } from '../../Library/utils.js'
import { getPhoneByLid } from '../../Database/db.js'

async function resolveLid(jid: string, Morela: any): Promise<string> {
  if (!jid.endsWith('@lid')) return jid

  const lidNum = jid.split('@')[0]

  const phone = getPhoneByLid(lidNum)
  if (phone) return phone + '@s.whatsapp.net'

  try {
    const result = await Morela.onWhatsApp(lidNum)
    if (result?.[0]?.jid) return result[0].jid
  } catch {}

  return jid 
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('Timeout')), ms)
    )
  ])
}

const handler = async (m: any, { Morela, reply, fkontak }: any) => {
  const _txt      = (m.text || '').trim().replace(/[^0-9]/g, '')
  const _inputJid = _txt.length > 5 ? _txt + '@s.whatsapp.net' : null
  const rawJid    = m.quoted?.sender || m.mentionedJid?.[0] || _inputJid || m.sender

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  try {

    const jid = await resolveLid(rawJid, Morela)

    let url: string | null = null
    try {
      url = await withTimeout(Morela.profilePictureUrl(jid, 'image'), 10_000)
    } catch {
      try {
        url = await withTimeout(Morela.profilePictureUrl(jid, 'preview'), 10_000)
      } catch {
        url = null
      }
    }

    if (!url) throw new Error('No URL')

    const rawNum = rawJid.split('@')[0]
    const num    = rawJid.endsWith('@lid')
      ? (getPhoneByLid(rawNum) || jid.split('@')[0])
      : rawNum

    await Morela.sendMessage(m.chat, {
      image: { url },
      caption:
        `╭╌「 🖼️ *Profile Picture* 」\n` +
        `┃ 📱 *Nomor:* +${num}\n` +
        `╰╌\n\n© ${botName}`
    }, { quoted: fkontak || m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply('❌ Foto profil tidak bisa diakses (private atau tidak ada)')
  }
}

handler.command = ['getpp', 'pp', 'profpic']
handler.tags    = ['tools']
handler.help    = ['getpp — reply/mention/ketik nomor']

export default handler
