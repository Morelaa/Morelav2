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

  try {
    const plugins = pluginManager.listPlugins()
    if (!plugins.length) return rich()
      .setTitle('📦 Plugin List')
      .addText('❌ Tidak ada plugin yang terload.')
      .send(m.chat)

    const search   = args[0]?.toLowerCase()
    let   filtered = plugins

    if (search) {
      filtered = plugins.filter((p: any) =>
        p.file.toLowerCase().includes(search) ||
        p.tags?.some((t: any)     => t.toLowerCase().includes(search)) ||
        p.commands?.some((c: any) => c.toLowerCase().includes(search))
      )
      if (!filtered.length) return rich()
        .setTitle('🔍 Hasil Pencarian')
        .addTable([
          ['Field',   'Value'],
          ['Keyword', search],
          ['Hasil',   '0 plugin ditemukan ❌'],
        ])
        .addTip('💡 Ketik .listplugin untuk lihat semua plugin.')
        .send(m.chat)
    }

    const groups: Record<string, any[]> = {}
    for (const p of filtered) {
      const parts  = p.file.replace(/\\/g, '/').split('/')
      const folder = parts.length > 1 ? parts[0] : 'other'
      if (!groups[folder]) groups[folder] = []
      groups[folder].push(p)
    }

    const folderEmoji: Record<string, string> = {
      ai: '🤖', downloader: '📥', sticker: '✨',
      maker: '🎨', ephoto: '🖼️', tools: '🛠️',
      games: '🎮', game: '🎮', admin: '🔰',
      owner: '👑', info: 'ℹ️', system: '⚙️',
      other: '📦'
    }

    let totalCmd     = 0
    let totalPassive = 0
    for (const folder of Object.keys(groups)) {
      totalCmd     += groups[folder].filter((p: any) => p.type === 'command').length
      totalPassive += groups[folder].filter((p: any) => p.type === 'passive').length
    }

    const r = rich().setTitle(`📦 Plugin List${search ? ` · ${search}` : ''}`)

    r.addTable([
      ['Field',       'Value'],
      ['Bot',         botName],
      ['⚡ Command',  `${totalCmd} plugin`],
      ['🔄 Passive',  `${totalPassive} plugin`],
      ['📊 Total',    `${totalCmd + totalPassive} plugin`],
      ...(search ? [['🔍 Filter', search]] : []),
    ])

    const sortedFolders = Object.keys(groups).sort()
    for (const folder of sortedFolders) {
      const list    = groups[folder]
      const emoji   = folderEmoji[folder.toLowerCase()] || '📁'
      const cmdList = list.filter((p: any) => p.type === 'command').sort((a, b) => a.file.localeCompare(b.file))
      const pasList = list.filter((p: any) => p.type === 'passive')

      const rows: string[][] = [['Plugin', 'Type']]
      for (const p of cmdList) {
        rows.push([p.file.split('/').pop().replace(/\.(ts|js)$/, ''), '⚡ cmd'])
      }
      for (const p of pasList) {
        rows.push([p.file.split('/').pop().replace(/\.(ts|js)$/, ''), '🔄 auto'])
      }

      r.addCode('text', `${emoji} ${folder.toUpperCase()} (${list.length})`)
      r.addTable(rows)
    }

    r.addTip('💡 .listplugin <keyword> untuk filter plugin.')
    return r.send(m.chat)

  } catch (e) {
    return rich()
      .setTitle('❌ Error')
      .addTable([
        ['Field',   'Value'],
        ['Plugin',  'listplugin'],
        ['Error',   (e as Error).message],
      ])
      .send(m.chat)
  }
}

handler.command   = ['listplugin', 'listplug', 'plugins', 'pluginlist']
handler.mainOwner = true
handler.tags      = ['owner']
handler.help      = ['listplugin [search]']
handler.noLimit   = true

export default handler
