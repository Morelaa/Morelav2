import { OWNER_WA, botName } from '../../Library/utils.js'
import { resolveLidToPhone, normNum, isLidJid } from '../../Library/resolve.js'
import { kvGet, kvSet } from '../../Database/kvstore.js'

const STORE = 'ownsalam'
const GREET_COOLDOWN = 3 * 60 * 60 * 1000

const GREETINGS = [
  '👑 *Owner Tercinta Telah Hadir!*\n\nSelamat datang kembali boss, semoga harimu menyenangkan 😄',
  '🔥 *Bosnya Dateng Gaes!*\n\nSambut kedatangan owner kita yang kece abis 👑',
  '✨ *The Owner Has Entered The Chat!*\n\nSelamat datang balik, boss! Grup langsung on fire 🔥',
  '🎉 *Halo Owner!*\n\nWelcome back, semua siap melayani 🫡',
  '👋 *Owner Aktif Nih!*\n\nSelamat datang boss, semoga mood bagus terus ya 😎',
]

export default {
  tags: ['passive', 'owner'],

  handler: async (m, { Morela }) => {

    if (m.key?.fromMe)                    return
    if (!m.isGroup)                       return
    if (m.chat === 'status@broadcast')    return

    const rawSender = m.sender || m.key?.participant || ''
    let senderNum   = normNum(rawSender)

    if (isLidJid(rawSender)) {
      const resolved = resolveLidToPhone(rawSender)
      if (resolved) senderNum = resolved
      else return
    }

    if (!senderNum || senderNum.length < 8) return

    const ownerList: string[] = Array.isArray(OWNER_WA) ? OWNER_WA : [OWNER_WA]
    const isOwner = ownerList.some(num =>
      num.replace(/[^0-9]/g, '').includes(senderNum) ||
      senderNum.includes(num.replace(/[^0-9]/g, ''))
    )
    if (!isOwner) return

    const now = Date.now()
    const key = `${m.chat}_${senderNum}`

    const lastGreet = kvGet<number>(STORE, key, 0)
    if (now - lastGreet < GREET_COOLDOWN) return

    kvSet(STORE, key, now)

    const msg = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]

    await Morela.sendMessage(m.chat, { text: msg }, { quoted: m })
  }
}
