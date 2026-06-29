import { botName } from '../../Library/utils.js'
import { kvGet, kvSet } from '../../Database/kvstore.js'

const VARIANTS: Record<number, { name: string; desc: string }> = {
  1: { name: 'Classic Button',   desc: 'Tombol cta_url per owner (default)' },
  2: { name: 'Carousel Cards',   desc: 'Kartu carousel dengan foto owner' },
  3: { name: 'Multiple Contact', desc: 'Kirim contact card semua owner' },
}

function getOwnerType(): number {
  return kvGet<number>('ownertype', 'type', 1)
}

async function setOwnerType(type: number): Promise<void> {
  kvSet('ownertype', 'type', type)
  global.ownerType = type
}

const handler = async (m: any, { Morela, args, fkontak }: any) => {

  const current = getOwnerType()
  const arg     = (args[0] ?? '').toLowerCase().replace('v', '')
  const picked  = parseInt(arg)

  if (VARIANTS[picked]) {
    await setOwnerType(picked)
    return Morela.sendMessage(
      m.chat,
      {
        text:
          `╭╌╌⬡「 👑 *sᴇᴛ ᴏᴡɴᴇʀ ᴛʏᴘᴇ* 」\n` +
          `┃ ✅ Owner type diubah ke *V${picked}*\n` +
          `┃\n` +
          `┃ ◦ Variant : *${VARIANTS[picked].name}*\n` +
          `┃ ◦ Desc    : _${VARIANTS[picked].desc}_\n` +
          `╰╌╌⬡\n\n© ${botName}`,
      },
      { quoted: fkontak || m }
    )
  }

  const buttons = Object.entries(VARIANTS).map(([id, val]) => {
    const mark = parseInt(id) === current ? ' ✓' : ''
    return {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: `V${id}${mark} — ${val.name}`,
        id: `.setownertype v${id}`,
      }),
    }
  })

  await Morela.sendMessage(
    m.chat,
    {
      text:
        `╭╌╌⬡「 🎨 *sᴇᴛ ᴏᴡɴᴇʀ ᴛʏᴘᴇ* 」\n` +
        `┃\n` +
        `┃ ◦ Type saat ini : *V${current}*\n` +
        `┃ ◦ Nama          : _${VARIANTS[current].name}_\n` +
        `┃\n` +
        `┃ Pilih variant owner:\n` +
        `╰╌╌⬡\n\n© ${botName}`,
      interactiveButtons: buttons,
      hasMediaAttachment: false,
    },
    { quoted: fkontak || m }
  )
}

handler.command  = ['setownertype', 'ownertype', 'ownervariant', 'ownerstyle']
handler.help     = ['setownertype', 'setownertype v1']
handler.tags     = ['owner']
handler.noLimit  = true
handler.owner    = true
handler.premium  = false
handler.group    = false
handler.private  = false
handler.admin    = false
handler.botAdmin = false

export { getOwnerType }
export default handler
