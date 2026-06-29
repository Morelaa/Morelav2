import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { botName } from '../../Library/utils.js'
import { kvGet, kvSet } from '../../Database/kvstore.js'

const __dirname   = path.dirname(fileURLToPath(import.meta.url as string))
const imagePath   = path.join(process.cwd(), 'media/menu.jpg')

function setMenuStyle(jid: string, style: string) {
  kvSet('menuconfig', jid, style)
}

function getMenuStyle(jid: string) {
  const style = kvGet<string | null>('menuconfig', jid, null)
  if (style) return style
  const def = kvGet<string | null>('menuconfig', 'default', null)
  return def || 'v1'
}

const STYLES = ['v1', 'v2', 'v3', 'v4']

const handler = async (m: any, { Morela, args, fkontak }: any) => {
  const style   = args[0]?.toLowerCase()
  const current = getMenuStyle(m.chat)
  const menuBuf = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null

  const send = async (text: string) => {
    if (menuBuf) {
      await Morela.sendMessage(m.chat, { image: menuBuf, caption: text }, { quoted: fkontak || m })
    } else {
      await reply(text)
    }
  }

  if (!style) {
    return send(
      `🎨 *Menu Style*\n\n` +
      `◦ Aktif: *${current.toUpperCase()}*\n` +
      `◦ Opsi : ${STYLES.map(v => v.toUpperCase()).join(', ')}\n\n` +
      `Gunakan: *.setmenu v1/v2/v3/v4*`
    )
  }

  if (!STYLES.includes(style)) return send(`❌ Style *${style}* tidak tersedia!`)
  if (current === style) return send(`⚠️ Style *${style.toUpperCase()}* sudah aktif.`)

  setMenuStyle(m.chat, style)
  return send(`✅ Style *${style.toUpperCase()}* berhasil diaktifkan!\n\n© ${botName}`)
}

handler.command = ['setmenu', 'menustyle']
handler.tags    = ['owner']
handler.help    = ['setmenu v1/v2/v3/v4']
handler.owner   = true

export default handler
