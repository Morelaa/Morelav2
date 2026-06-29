import pluginManager from '../_pluginmanager.js'
import fs from 'fs'
import { buildFkontak, CHANNEL_URL, imagePath, botName } from '../../Library/utils.js'
import { isMainOwner } from '../../Library/resolve.js'

const VALID_FOLDERS = ['admin', 'ai', 'downloader', 'games', 'info', 'maker', 'owner', 'sticker', 'tools']

const USAGE_MSG = () =>
  `╭╌╌⬡「 📝 *ᴘʟᴜɢɪɴ ᴄʀᴇᴀᴛᴏʀ* 」\n` +
  `┃ ❌ Format lu berantakan.\n` +
  `┃\n` +
  `┃ 📌 Tanpa folder:\n` +
  `┃ plugin + namafile\n` +
  `┃\n` +
  `┃ 📌 Dengan folder:\n` +
  `┃ plugin + tools/namafile\n` +
  `┃\n` +
  `┃ 📂 Folder:\n` +
  `┃ ${VALID_FOLDERS.map(f => `\`${f}\``).join(', ')}\n` +
  `┃\n` +
  `┃ Contoh bener tuh liat sendiri, jangan asal ngetik.\n` +
  `╰╌╌⬡\n\n© ${botName}`

const handler = async (m, { Morela, fkontak }) => {

  const raw = (m.body || m.text || '').trim()

  const send = async text => {
    return Morela.sendMessage(m.chat, { text }, { quoted: fkontak || m })
  }

  if (!isMainOwner(m)) return send('❌ Fitur ini hanya untuk Main Owner!')

  const newlineIdx = raw.indexOf('\n')
  if (newlineIdx === -1) return send(USAGE_MSG())

  const firstLine = raw.substring(0, newlineIdx).trim()
  const code      = raw.substring(newlineIdx + 1)

  const parts   = firstLine.split(/\s+/).filter(Boolean)
  const rawName = parts[parts.length - 1]

  if (!rawName) return send(USAGE_MSG())

  if (!/^[a-zA-Z0-9_\-\/]+$/.test(rawName)) {
    return send(
      `╭╌╌⬡「 📝 *PLUGIN* 」\n` +
      `┃ ❌ Nama aneh banget.\n` +
      `┃ Jangan ngasal ngetik simbol.\n` +
      `╰╌╌⬡`
    )
  }

  let folder   = 'tools'
  let filename = rawName

  if (rawName.includes('/')) {
    const splitParts = rawName.split('/')

    if (splitParts.length > 2) {
      return send(
        `╭╌╌⬡「 📝 *PLUGIN* 」\n` +
        `┃ ❌ Kebanyakan folder.\n` +
        `┃ 1 level aja, jangan rakus.\n` +
        `╰╌╌⬡`
      )
    }

    folder   = splitParts[0].toLowerCase()
    filename = splitParts[1]

    if (!VALID_FOLDERS.includes(folder)) {
      return send(
        `╭╌╌⬡「 📝 *PLUGIN* 」\n` +
        `┃ ❌ Folder *${folder}* ga ada.\n` +
        `┃ Ngadi-ngadi lu.\n` +
        `╰╌╌⬡`
      )
    }
  }

  if (!filename || filename.trim().length === 0) {
    return send(
      `╭╌╌⬡「 📝 *PLUGIN* 」\n` +
      `┃ ❌ Nama file kosong.\n` +
      `┃ Seriusan ini?\n` +
      `╰╌╌⬡`
    )
  }

  if (!code || code.trim().length < 10) {
    return send(
      `╭╌╌⬡「 📝 *PLUGIN* 」\n` +
      `┃ ❌ Kode terlalu pendek.\n` +
      `┃ Minimal niat dikit lah.\n` +
      `╰╌╌⬡`
    )
  }

  const pluginPath = `${folder}/${filename}`

  try {
    await pluginManager.addPlugin(pluginPath, code)
    return send(
      `╭╌╌⬡「 📝 *PLUGIN* 」\n` +
      `┃ ✅ Berhasil ditambahin.\n` +
      `┃\n` +
      `┃ 📄 ${pluginPath}.ts\n` +
      `┃ 📂 ${folder}\n` +
      `┃\n` +
      `┃ Ya akhirnya bener juga.\n` +
      `╰╌╌⬡`
    )
  } catch (e) {
    return send(
      `╭╌╌⬡「 📝 *PLUGIN* 」\n` +
      `┃ ❌ Gagal.\n` +
      `┃ ${e.message}\n` +
      `┃\n` +
      `┃ Toxic dikit ya:\n` +
      `┃ Kodingan lu emang bermasalah.\n` +
      `╰╌╌⬡`
    )
  }
}

handler.command = ['plugin']
handler.mainOwner = true
handler.noLimit = true
handler.tags    = ['owner']
handler.help    = ['addplugin <nama>']

export default handler
