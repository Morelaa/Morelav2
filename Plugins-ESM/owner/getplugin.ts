import pluginManager from '../_pluginmanager.js'
import { botName }   from '../../Library/utils.js'
import { isMainOwner } from '../../Library/resolve.js'

const handler = async (m: any, { args, Morela, fkontak }: any) => {
  const { AIRich } = await import('../../Library/MessageBuilder.js?v=' + Date.now())

  const rich = () => new AIRich(Morela)

  if (!isMainOwner(m)) return rich()
    .setTitle('🔒 Akses Ditolak')
    .addText('Perintah ini hanya bisa digunakan oleh *Main Owner*.')
    .send(m.chat)

  if (!args[0]) return rich()
    .setTitle('📄 Plugin Viewer')
    .addTable([
      ['Field',   'Keterangan'],
      ['Format',  '.getplugin <nama-plugin>'],
      ['Contoh',  '.getplugin menu'],
      ['Contoh',  '.getplugin ping'],
      ['Contoh',  '.getplugin ocr'],
    ])
    .addTip('💡 Nama file tanpa .ts')
    .send(m.chat)

  const pluginName = args[0].toLowerCase()

  if (!/^[a-zA-Z0-9_-]+$/.test(pluginName)) return rich()
    .setTitle('❌ Nama Tidak Valid')
    .addText('Nama plugin hanya boleh huruf, angka, `-` dan `_`.')
    .send(m.chat)

  await Morela.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })

  try {
    const pluginData   = pluginManager.getPlugin(pluginName)
    const passiveMatch = !pluginData
      ? pluginManager.getPassiveHandlers().find((h: any) =>
          h.file.replace(/^.*\//, '').replace('.ts', '') === pluginName
        )
      : null

    const resolvedFile = pluginData?.file || passiveMatch?.file || null
    const parts        = resolvedFile ? resolvedFile.split('/') : []
    const folder       = parts.length > 1 ? parts[0] : 'root'
    const filePath     = resolvedFile || `${pluginName}.ts`
    const fileName     = `${pluginName}.ts`

    const code   = pluginManager.getPluginCode(resolvedFile || pluginName)
    const lines  = code.split('\n').length
    const chars  = code.length
    const sizeKB = (chars / 1024).toFixed(2)

    await rich()
      .setTitle('📄 Plugin Code Viewer')
      .addTable([
        ['Field',    'Value'],
        ['📁 Path',   filePath],
        ['📂 Folder', folder],
        ['📝 Nama',   fileName],
        ['📊 Lines',  String(lines)],
        ['💾 Size',   `${sizeKB} KB`],
        ['📦 Chars',  String(chars)],
        ['🔧 Status', 'LOADED ✅'],
      ])
      .addCode('typescript', code)
      .send(m.chat, { quoted: fkontak || m })

    return await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e: any) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return rich()
      .setTitle('❌ Plugin Tidak Ditemukan')
      .addTable([
        ['Field',   'Value'],
        ['Plugin',  pluginName],
        ['Error',   e?.message || 'Unknown'],
      ])
      .addTip('💡 Gunakan .listplugin untuk melihat daftar plugin.')
      .send(m.chat)
  }
}

handler.command   = ['getplugin', 'viewplugin', 'showplugin']
handler.mainOwner = true
handler.tags      = ['owner']
handler.help      = ['getplugin <nama>']
handler.noLimit   = true

export default handler
