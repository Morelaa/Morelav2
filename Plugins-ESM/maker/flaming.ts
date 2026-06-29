const STYLES: Record<number, { id: number; slug: string; name: string }> = {
  1: { id: 1147, slug: 'create-3d-thunder-text-effects-online-1147.html',          name: '⚡ Thunder'  },
  2: { id: 1157, slug: 'create-online-reflected-neon-text-effect-1157.html',       name: '💜 Neon'     },
  3: { id: 1125, slug: 'create-naruto-logo-style-text-effect-online-1125.html',    name: '🍥 Naruto'   },
  4: { id: 1134, slug: 'create-pokemon-logo-style-text-effect-online-1134.html',   name: '🎮 Pokemon'  },
  5: { id: 1159, slug: 'create-deadpool-logo-style-text-effect-online-1159.html',  name: '💀 Deadpool' },
  6: { id: 884,  slug: 'matrix-style-text-effect-online-884.html',                 name: '🟢 Matrix'   },
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function getTextPro(text: string, style: number): Promise<Buffer> {
  const { chromium } = await import('playwright')
  const { slug } = STYLES[style] || STYLES[1]

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'en-US',
  })
  const page = await context.newPage()

  let resultUrl: string | null = null

  try {
    page.on('response', async (res) => {
      if (res.url().includes('effect/create-image')) {
        try {
          const json = await res.json()
          if (json?.success && json?.image) {
            resultUrl = 'https://textpro.me' + json.image
          }
        } catch {}
      }
    })

    await page.goto(`https://textpro.me/${slug}`, {
      waitUntil: 'networkidle',
      timeout:   60000,
    })
    await page.waitForTimeout(2000)
    await page.fill('#text-0', text)
    await page.click('#create_effect')
    await page.waitForTimeout(10000)

    if (!resultUrl) throw new Error('Tidak dapat URL gambar dari server')

    const imgRes = await page.request.get(resultUrl, {
      headers: {
        'Referer':    `https://textpro.me/${slug}`,
        'User-Agent': UA,
      },
      timeout: 20000,
    })

    if (!imgRes.ok()) throw new Error(`Gagal download gambar: HTTP ${imgRes.status()}`)

    const buf = Buffer.from(await imgRes.body())
    if (buf.length < 500) throw new Error('Gambar kosong dari server')
    return buf

  } finally {
    await browser.close()
  }
}

const handler = async (m: any, { Morela, text, reply, usedPrefix, command }: any) => {
  if (!text) return reply(
    `Contoh: *${usedPrefix}${command} 1|namakamu*\n\n` +
    `Style:\n1=⚡Thunder 2=💜Neon 3=🍥Naruto\n4=🎮Pokemon 5=💀Deadpool 6=🟢Matrix`
  )

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  let type  = 1
  let input = text

  if (text.includes('|')) {
    const [num, ...rest] = text.split('|')
    const n = parseInt(num.trim())
    if (!isNaN(n) && n >= 1 && n <= 6) {
      type  = n
      input = rest.join('|').trim()
    }
  }

  if (!input)               return reply('❌ Teks tidak boleh kosong!')
  if (type < 1 || type > 6) return reply('❌ Pilihan style hanya 1 sampai 6!')

  try {
    const buffer = await getTextPro(input, type)

    await Morela.sendMessage(m.chat, {
      image:   buffer,
      caption: `${STYLES[type].name} *${input}*`,
    }, { quoted: m })

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
  } catch (e: any) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Gagal: ${e?.message || 'Coba lagi'}`)
  }
}

handler.help     = ['flaming <1-6>|<teks>']
handler.tags     = ['maker']
handler.command  = ['flaming']
handler.limit    = false
handler.register = false

export default handler
