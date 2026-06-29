import axios from 'axios'
import unzipper from 'unzipper'

const handler = async (m: any, { Morela, text, usedPrefix, command }: any) => {
  const q    = m.quoted ? m.quoted : m
  const mime = (q.msg || q).mimetype || ''

  if (!text) {
    return m.reply(
      `Balas file ZIP lalu gunakan:\n\n` +
      `${usedPrefix + command} nama-repo|true/false\n\n` +
      `Contoh:\n` +
      `${usedPrefix + command} my-bot|true`
    )
  }

  const [repoName, isPrivateRaw] = text.split('|').map((v: string) => v.trim())

  if (!repoName)     return m.reply('Nama repo tidak boleh kosong!')
  if (!isPrivateRaw) return m.reply('Isi true/false untuk private repo')

  const isPrivate = isPrivateRaw.toLowerCase() === 'true'

  if (!/zip/i.test(mime) && !q.document) {
    return m.reply('Silakan reply file ZIP terlebih dahulu!')
  }

  const token = global.tokengh
  if (!token) return m.reply('Token GitHub tidak ditemukan di global.tokengh')

  try {
    await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${token}`, 'User-Agent': 'WhatsAppBot' }
    })
    const login = userRes.data.login

    let exists = true
    try {
      await axios.get(`https://api.github.com/repos/${login}/${repoName}`, {
        headers: { Authorization: `token ${token}`, 'User-Agent': 'WhatsAppBot' }
      })
    } catch (e: any) {
      if (e.response?.status === 404) exists = false
      else throw e
    }

    if (!exists) {
      await axios.post(
        'https://api.github.com/user/repos',
        { name: repoName, private: isPrivate, auto_init: true },
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'WhatsAppBot' } }
      )
    } else {
      await axios.patch(
        `https://api.github.com/repos/${login}/${repoName}`,
        { private: isPrivate },
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'WhatsAppBot' } }
      )
    }

    const zipBuffer = await q.download()
    if (!Buffer.isBuffer(zipBuffer)) throw new Error('File ZIP tidak valid')

    const directory = await unzipper.Open.buffer(zipBuffer)
    let total = 0

    const SKIP_FILES = /\.(db|db-shm|db-wal)$/i

    for (const file of directory.files) {
      if (
        file.type === 'Directory' ||
        file.path.includes('__MACOSX') ||
        file.path.endsWith('.DS_Store') ||
        SKIP_FILES.test(file.path)
      ) continue

      // deklarasi filePath dulu sebelum dipakai
      const filePath = file.path.replace(/^\/+/, '')
      const encoded  = encodeURIComponent(filePath).replace(/%2F/g, '/')

      // sensor nilai sensitif di config.ts sebelum upload
      let rawBuffer = await file.buffer()
      if (filePath === 'config.ts' || filePath.endsWith('/config.ts')) {
        let cfg = rawBuffer.toString('utf-8')

        cfg = cfg.replace(/(global\.mainOwner\s*=\s*['"`])\d+(['"`])/g,              '$1SENSOR_NO_HP$2')
        cfg = cfg.replace(/(global\.tokengh\s*=\s*['"`])[^'"`]+(['"`])/g,            '$1SENSOR_TOKEN_GH$2')
        cfg = cfg.replace(/(token\s*:\s*['"`])[^'"`]+(['"`])/g,                      '$1SENSOR_TG_TOKEN$2')
        cfg = cfg.replace(/(ownerId\s*:\s*['"`])[^'"`]+(['"`])/g,                    '$1SENSOR_TG_OWNERID$2')
        cfg = cfg.replace(/(neoxrSkiplink\s*:\s*['"`])[^'"`]+(['"`])/g,              '$1SENSOR_API_KEY$2')
        cfg = cfg.replace(/(neoxr\s*:\s*['"`])[^'"`]+(['"`])/g,                      '$1SENSOR_API_KEY$2')
        cfg = cfg.replace(/(imgbb\s*:\s*['"`])[^'"`]+(['"`])/g,                      '$1SENSOR_API_KEY$2')
        cfg = cfg.replace(/(openrouter\s*:\s*['"`])[^'"`]+(['"`])/g,                 '$1SENSOR_API_KEY$2')
        cfg = cfg.replace(/(theresavGenmart\s*:\s*['"`])[^'"`]+(['"`])/g,            '$1SENSOR_API_KEY$2')
        cfg = cfg.replace(/(theresav\s*:\s*['"`])[^'"`]+(['"`])/g,                   '$1SENSOR_API_KEY$2')
        cfg = cfg.replace(/(bypass\s*:\s*['"`])[^'"`]+(['"`])/g,                     '$1SENSOR_API_KEY$2')
        cfg = cfg.replace(/(cuki\s*:\s*['"`])[^'"`]+(['"`])/g,                       '$1SENSOR_API_KEY$2')
        cfg = cfg.replace(/(kazztzyy2\s*:\s*['"`])[^'"`]+(['"`])/g,                  '$1SENSOR_API_KEY$2')
        cfg = cfg.replace(/(kazztzyy\s*:\s*['"`])[^'"`]+(['"`])/g,                   '$1SENSOR_API_KEY$2')
        cfg = cfg.replace(/(evelyne\s*:\s*['"`])[^'"`]+(['"`])/g,                    '$1SENSOR_API_KEY$2')
        cfg = cfg.replace(/(termai\s*:\s*['"`])[^'"`]+(['"`])/g,                     '$1SENSOR_API_KEY$2')

        rawBuffer = Buffer.from(cfg, 'utf-8')
      }

      const content = rawBuffer.toString('base64')

      let sha: string | undefined
      try {
        const res = await axios.get(
          `https://api.github.com/repos/${login}/${repoName}/contents/${encoded}`,
          { headers: { Authorization: `token ${token}`, 'User-Agent': 'WhatsAppBot' } }
        )
        sha = res.data.sha
      } catch {}

      await axios.put(
        `https://api.github.com/repos/${login}/${repoName}/contents/${encoded}`,
        { message: 'Upload via WhatsApp Bot', content, ...(sha ? { sha } : {}) },
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'WhatsAppBot' } }
      )

      total++
    }

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
    await Morela.sendMessage(
      m.chat,
      {
        text:
          `「 PUSH GIT SUCCESS 」\n\n` +
          `📁 Repo  : ${login}/${repoName}\n` +
          `🔒 Private: ${isPrivate}\n` +
          `📦 Files : ${total}\n` +
          `🌐 https://github.com/${login}/${repoName}`
      },
      { quoted: m }
    )

  } catch (e: any) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    m.reply(`❌ Error:\n${e.response?.data?.message || e.message}`)
  }
}

handler.help    = ['pushgit']
handler.tags    = ['github']
handler.command = ['pushgit']
handler.owner   = true

export default handler