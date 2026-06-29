import axios from 'axios'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import { botName, CHANNEL_URL, CHANNEL_JID } from '../../Library/utils.js'

const COMMANDS = [
  'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo',
  'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive',
  'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'happy', 'wink', 'poke', 'dance',
  'cringe', 'trap', 'blowjob', 'hentai', 'boobs', 'ass', 'pussy', 'thighs', 'lesbian',
  'lewdneko', 'cum', 'waifu-nsfw', 'neko-nsfw'
]

const WAIFU_PICS_NSFW = new Set([
  'waifu', 'neko', 'trap', 'blowjob'
])
const WAIFU_PICS_SFW = new Set([
  'waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo',
  'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive',
  'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'happy', 'wink', 'poke', 'dance', 'cringe'
])

// FIX: pakai tag asli (sebelum remap) sebagai key, value = endpoint API
const NEKOBOT_TAGS: Record<string, string> = {
  hentai:        'hentai',
  boobs:         'hentai',
  ass:           'ass',
  pussy:         'pussy',
  lesbian:       'lesbian',
  lewdneko:      'lewdneko',
  cum:           'cum',
  thighs:        'hentai',
  trap:          'trap',
  blowjob:       'blowjob',
  'waifu-nsfw':  'hentai',   // FIX: key pakai nama command asli
  'neko-nsfw':   'lewdneko', // FIX: key pakai nama command asli
}

const NEKOSBEST_SFW: Record<string, string> = {
  hug: 'hug', kiss: 'kiss', pat: 'pat', slap: 'slap', cuddle: 'cuddle',
  wave: 'wave', smile: 'smile', wink: 'wink', poke: 'poke', dance: 'dance',
  blush: 'blush', happy: 'happy', cry: 'cry', nom: 'nom', bite: 'bite',
  glomp: 'glomp', bonk: 'bonk', yeet: 'yeet', kill: 'kill',
}

// FIX: tambah tag SFW ke RULE34_TAG_MAP agar shinobu/megumin/dll bisa fallback ke rule34
const RULE34_TAG_MAP: Record<string, string> = {
  hentai:        'hentai',
  lesbian:       'yuri',
  cum:           'cum_on_body',
  lewdneko:      'cat_girl',
  trap:          'trap',
  'waifu-nsfw':  'hentai',
  'neko-nsfw':   'cat_girl',
  boobs:         'large_breasts',
  ass:           'ass',
  pussy:         'pussy',
  thighs:        'thighhighs',
  blowjob:       'fellatio',
  // SFW tags
  shinobu:       'kochou_shinobu',
  megumin:       'megumin',
  awoo:          'kemonomimi_mode',
  lick:          'licking',
  smug:          'smug',
  highfive:      'high_five',
  handhold:      'holding_hands',
  glomp:         'glomp',
  kill:          'killing',
  cringe:        'embarrassed',
  bully:         'bullying',
  cuddle:        'cuddling',
  hug:           'hugging',
  kiss:          'kiss',
  pat:           'head_pat',
  bonk:          'bonk',
  yeet:          'throwing',
  nom:           'nom',
  bite:          'biting',
  slap:          'slapping',
  blush:         'blush',
  smile:         'smile',
  wave:          'waving',
  happy:         'happy',
  wink:          'wink',
  poke:          'poke',
  dance:         'dancing',
}

// Picsum fallback khusus SFW action (ketika semua API gagal, setidaknya ngirim sesuatu)
const NEKOS_LIFE_SFW: Record<string, string> = {
  awoo:      'awoo',
  bully:     'bully',
  cuddle:    'cuddle',
  cry:       'cry',
  hug:       'hug',
  kiss:      'kiss',
  lick:      'lizard',
  pat:       'pat',
  smug:      'smug',
  bonk:      'bonk',
  yeet:      'yeet',
  blush:     'blush',
  smile:     'smile',
  wave:      'wave',
  highfive:  'highfive',
  handhold:  'handhold',
  nom:       'nom',
  bite:      'bite',
  glomp:     'glomp',
  slap:      'slap',
  kill:      'kill',
  happy:     'happy',
  wink:      'wink',
  poke:      'poke',
  dance:     'dance',
  cringe:    'cringe',
}

function gifToMp4(gifBuffer: Buffer): Buffer | null {
  const tmpDir  = os.tmpdir()
  const ts      = Date.now()
  const gifPath = path.join(tmpDir, `nsfw_${ts}.gif`)
  const mp4Path = path.join(tmpDir, `nsfw_${ts}.mp4`)
  try {
    fs.writeFileSync(gifPath, gifBuffer)
    execSync(
      `ffmpeg -y -i "${gifPath}" -movflags faststart -pix_fmt yuv420p ` +
      `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset ultrafast -crf 23 "${mp4Path}"`,
      { stdio: 'pipe', timeout: 30000 }
    )
    if (fs.existsSync(mp4Path)) {
      const buf = fs.readFileSync(mp4Path)
      try { fs.unlinkSync(mp4Path) } catch {}
      try { fs.unlinkSync(gifPath) } catch {}
      return buf
    }
  } catch (e) {
    console.error('[NSFW] FFmpeg failed:', (e as Error).message)
    try { if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath) } catch {}
    try { if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path) } catch {}
  }
  return null
}

// FIX: semua fetch pakai `tag` original (command asli), bukan setelah remap
async function fetchRule34(tag: string): Promise<string | null> {
  const mappedTag = RULE34_TAG_MAP[tag] || tag
  try {
    const { data } = await axios.get(
      `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&tags=${encodeURIComponent(mappedTag)}&limit=100&json=1`,
      { timeout: 10000 }
    )
    const posts = Array.isArray(data) ? data : (Array.isArray(data?.post) ? data.post : null)
    if (posts?.length > 0) {
      const post = posts[Math.floor(Math.random() * posts.length)]
      return post?.file_url || post?.sample_url || null
    }
  } catch (e) {
    console.log('[NSFW] rule34 error:', (e as Error).message)
  }
  return null
}

async function fetchGelbooru(tag: string): Promise<string | null> {
  const mappedTag = RULE34_TAG_MAP[tag] || tag
  try {
    const { data } = await axios.get(
      `https://gelbooru.com/index.php?page=dapi&s=post&q=index&tags=${encodeURIComponent(mappedTag)}&limit=100&json=1`,
      { timeout: 10000 }
    )
    const posts = data?.post
    if (Array.isArray(posts) && posts.length > 0) {
      const post = posts[Math.floor(Math.random() * posts.length)]
      return post?.file_url || null
    }
  } catch (e) {
    console.log('[NSFW] gelbooru error:', (e as Error).message)
  }
  return null
}

async function fetchWaifuPics(tag: string): Promise<string | null> {
  // FIX: map command asli ke endpoint waifu.pics yang benar
  const sfwTag   = tag === 'neko-nsfw'  ? 'neko'  : tag === 'waifu-nsfw' ? 'waifu' : tag
  const nsfwTag  = tag === 'neko-nsfw'  ? 'neko'  : tag === 'waifu-nsfw' ? 'waifu' : tag
  try {
    if (WAIFU_PICS_NSFW.has(nsfwTag)) {
      const { data } = await axios.get(`https://api.waifu.pics/nsfw/${nsfwTag}`, { timeout: 10000 })
      if (data?.url) return data.url
    }
    if (WAIFU_PICS_SFW.has(sfwTag)) {
      const { data } = await axios.get(`https://api.waifu.pics/sfw/${sfwTag}`, { timeout: 10000 })
      if (data?.url) return data.url
    }
  } catch (e) {
    console.log('[NSFW] waifu.pics error:', (e as Error).message)
  }
  return null
}

async function fetchNekobot(tag: string): Promise<string | null> {
  // FIX: lookup pakai tag asli (tidak perlu remap dulu)
  const mapped = NEKOBOT_TAGS[tag]
  if (!mapped) return null
  try {
    const { data } = await axios.get(`https://nekobot.xyz/api/image?type=${mapped}`, { timeout: 10000 })
    if (data?.success && data?.message) return data.message
  } catch (e) {
    console.log('[NSFW] nekobot error:', (e as Error).message)
  }
  return null
}

async function fetchNekosBest(tag: string): Promise<string | null> {
  const mapped = NEKOSBEST_SFW[tag]
  if (!mapped) return null
  try {
    const { data } = await axios.get(`https://nekos.best/api/v2/${mapped}`, { timeout: 10000 })
    const results = data?.results
    if (Array.isArray(results) && results.length > 0)
      return results[0]?.url || null
  } catch (e) {
    console.log('[NSFW] nekos.best error:', (e as Error).message)
  }
  return null
}

async function fetchHmtai(tag: string): Promise<string | null> {
  const HMTAI_TAGS: Record<string, string> = {
    hentai:        'hentai',
    boobs:         'boobs',
    ass:           'ass',
    pussy:         'pussy',
    lesbian:       'lesbian',
    blowjob:       'blowjob',
    cum:           'cum',
    thighs:        'thighs',
    lewdneko:      'neko',
    trap:          'trap',
    'waifu-nsfw':  'hentai',   // FIX: key asli
    'neko-nsfw':   'neko',     // FIX: key asli
  }
  const mapped = HMTAI_TAGS[tag]
  if (!mapped) return null
  try {
    const { data } = await axios.get(`https://hmtai.hatsunia.cfd/v2/${mapped}`, { timeout: 10000 })
    if (data?.url) return data.url
  } catch (e) {
    console.log('[NSFW] hmtai error:', (e as Error).message)
  }
  return null
}

// FIX: tambah nekos.life sebagai fallback SFW
async function fetchNekosLife(tag: string): Promise<string | null> {
  const mapped = NEKOS_LIFE_SFW[tag]
  if (!mapped) return null
  try {
    const { data } = await axios.get(`https://nekos.life/api/v2/img/${mapped}`, { timeout: 10000 })
    if (data?.url) return data.url
  } catch (e) {
    console.log('[NSFW] nekos.life error:', (e as Error).message)
  }
  return null
}

// FIX: fetchImage sekarang menerima tag ASLI (belum diremap)
async function fetchImage(tag: string): Promise<string | null> {
  const results = await Promise.allSettled([
    fetchWaifuPics(tag),     // paling cepat untuk SFW
    fetchNekosBest(tag),     // SFW actions
    fetchNekosLife(tag),     // SFW fallback
    fetchNekobot(tag),       // NSFW
    fetchHmtai(tag),         // NSFW
    fetchRule34(tag),        // fallback umum
    fetchGelbooru(tag),      // fallback umum
  ])

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value
  }
  return null
}

const handler = async (m: any, { Morela, command, reply, fkontak }: any) => {
  // FIX: simpan command asli, JANGAN remap sebelum fetchImage
  const cmdOriginal = command.toLowerCase()

  // Nama display yang lebih cantik
  const displayName = cmdOriginal === 'neko-nsfw' ? 'NEKO (NSFW)'
    : cmdOriginal === 'waifu-nsfw' ? 'WAIFU (NSFW)'
    : cmdOriginal.toUpperCase()

  await Morela.sendMessage(m.chat, { react: { text: '🔁', key: m.key } })

  try {
    console.log('[NSFW] fetching tag:', cmdOriginal)
    // FIX: kirim tag ASLI ke fetchImage
    const imageUrl = await fetchImage(cmdOriginal)

    if (!imageUrl) {
      console.log('[NSFW] no result for tag:', cmdOriginal)
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`❌ Gambar tidak ditemukan untuk tag: *${cmdOriginal}*\n_Semua API tidak menemukan hasil_`)
    }

    console.log('[NSFW] got url:', imageUrl)
    const res         = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 })
    const buffer      = Buffer.from(res.data)
    const contentType = res.headers['content-type'] || ''
    const isGif       = contentType.includes('gif') || imageUrl.toLowerCase().endsWith('.gif')

    const ctxInfo = {
      forwardingScore: 9999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid:   CHANNEL_JID,
        newsletterName:  `© ${botName}`,
        serverMessageId: 127
      }
    }

    if (isGif) {
      const mp4 = gifToMp4(buffer)
      if (mp4) {
        await Morela.sendMessage(m.chat, {
          video: mp4, gifPlayback: true,
          caption: `🔞 *${displayName}*\n\n© ${botName}`,
          contextInfo: ctxInfo
        }, { quoted: fkontak || m })
      } else {
        await Morela.sendMessage(m.chat, {
          image: buffer, mimetype: 'image/gif',
          caption: `🔞 *${displayName}*\n\n© ${botName}`,
          contextInfo: ctxInfo
        }, { quoted: fkontak || m })
      }
    } else {
      await Morela.sendMessage(m.chat, {
        image: buffer,
        caption: `🔞 *${displayName}*\n\n© ${botName}`,
        contextInfo: ctxInfo
      }, { quoted: fkontak || m })
    }

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e) {
    console.error('[NSFW] error:', (e as Error).message)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply(`❌ Error: ${(e as Error).message}`)
  }
}

handler.command = COMMANDS
handler.owner   = true
handler.tags    = ['nsfw']
handler.help    = ['nsfw <command>']
handler.noLimit = true

export default handler