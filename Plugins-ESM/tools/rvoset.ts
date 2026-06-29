import axios from 'axios'
import { getTgToken, getTgChatId } from '../../Library/tg_global.js'
import { kvGet, kvSet } from '../../Database/kvstore.js'

// ── Load state dari DB saat plugin dimuat ───────────────────────
function loadState() {
  try {
    const enabled = kvGet<boolean>('rvo_state', 'enabled', false)
    global.rvoEnabled = !!enabled
    console.log(`[RVO] State loaded: ${global.rvoEnabled ? 'ON' : 'OFF'}`)
  } catch {}
}

function saveState(enabled: boolean) {
  try {
    kvSet('rvo_state', 'enabled', enabled)
  } catch {}
}

loadState() // ← auto-load saat plugin pertama kali dimuat

// ── Handler ─────────────────────────────────────────────────────
const handler = async (m: any, { reply, args }: any) => {
  const sub = args[0]?.toLowerCase()

  if (!sub) {
    return reply(
      `╭──「 🔓 *RVO Spy* 」\n` +
      `│\n` +
      `│ Status  : ${global.rvoEnabled ? '✅ ON' : '❌ OFF'}\n` +
      `│ Token   : ${getTgToken() ? '✅ Set' : '❌ Belum (isi di config.ts)'}\n` +
      `│ Chat ID : ${getTgChatId() ? `✅ ${getTgChatId()}` : '❌ Belum (isi di config.ts)'}\n` +
      `│\n` +
      `│ .rvo on\n` +
      `│ .rvo off\n` +
      `│ .rvo test\n` +
      `╰─────────────────────`
    )
  }

  if (sub === 'on') {
    if (!getTgToken() || !getTgChatId()) {
      return reply(
        '❌ Token & Chat ID belum diset!\n\n' +
        'Isi dulu di *config.ts*:\n' +
        'global.tgBot = {\n  token: "TOKEN",\n  ownerId: "CHATID"\n}'
      )
    }
    global.rvoEnabled = true
    saveState(true) // ✅ Simpan ke file agar persistent
    return reply(
      '✅ *RVO Spy aktif!*\n\n' +
      'Setiap foto/video yang dikirim/di-reply\nakan dikirim ke Telegram.\n\n' +
      '_State tersimpan, tidak hilang saat restart._'
    )
  }

  if (sub === 'off') {
    global.rvoEnabled = false
    saveState(false) // ✅ Simpan ke file
    return reply('❌ RVO Spy *dimatikan.*\n\n_State tersimpan._')
  }

  if (sub === 'test') {
    if (!getTgToken() || !getTgChatId()) {
      return reply('❌ Token atau Chat ID belum diset di config.ts!')
    }
    await reply('⏳ Tes koneksi ke Telegram...')
    try {
      await axios.post(`https://api.telegram.org/bot${getTgToken()}/sendMessage`, {
        chat_id: getTgChatId(),
        text: `✅ *RVO Spy - Test Koneksi*\n\n🕐 ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
        parse_mode: 'Markdown'
      }, { timeout: 10000 })
      return reply('✅ Berhasil! Cek Telegram kamu.')
    } catch (e: any) {
      return reply(`❌ Gagal: ${e?.response?.data?.description || e.message}`)
    }
  }

  return reply('❌ Sub-command tidak dikenal.\nKetik *.rvo* untuk bantuan.')
}

handler.command = ['rvo']
handler.owner   = true
handler.noLimit = true
handler.tags    = ['owner']
handler.help    = ['rvo on/off/test']

export default handler