import FormData from 'form-data'
import fetch    from 'node-fetch'
import axios    from 'axios'
import { fileTypeFromBuffer } from 'file-type'
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { buildFkontak, botName, CHANNEL_URL } from '../../Library/utils.js'
import { Toolkit } from '../../Library/MessageBuilder.js'

const IMGBB_KEY = global.apiKeys.imgbb

async function uploadLitterbox(buffer: Buffer, fileName: string) {
  const ft   = await fileTypeFromBuffer(buffer)
  const ext  = ft?.ext || 'bin'
  const form = new FormData()
  form.append('fileToUpload', buffer, `${fileName}.${ext}`)
  form.append('reqtype', 'fileupload')
  form.append('time', '72h')
  const res  = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
    method: 'POST', body: form, timeout: 30000
  })
  const text = await res.text()
  if (text.startsWith('https://')) return text.trim()
  throw new Error(text || 'Litterbox gagal')
}

async function uploadGofile(buffer: Buffer, fileName: string) {
  const ft   = await fileTypeFromBuffer(buffer)
  const ext  = ft?.ext || 'bin'
  const srvRes  = await fetch('https://api.gofile.io/servers', { timeout: 10000 })
  const srvData = await srvRes.json()
  if (!srvData?.data?.servers?.[0]?.name) throw new Error('Gofile server gagal')
  const server  = srvData.data.servers[0].name
  const form    = new FormData()
  form.append('file', buffer, `${fileName}.${ext}`)
  const res  = await fetch(`https://${server}.gofile.io/uploadFile`, {
    method: 'POST', body: form, timeout: 60000
  })
  const data = await res.json()
  if (!data?.data?.downloadPage) throw new Error('Gofile upload gagal')
  return data.data.downloadPage
}

async function uploadQuax(buffer: Buffer, fileName: string) {
  const ft   = await fileTypeFromBuffer(buffer)
  const ext  = ft?.ext || 'bin'
  const form = new FormData()
  form.append('file', buffer, `${fileName}.${ext}`)
  const res  = await fetch('https://qu.ax/upload.php', {
    method: 'POST', body: form, timeout: 60000
  })
  const data = await res.json()
  if (!data?.success || !data?.files?.[0]?.url) throw new Error('Qu.ax gagal')
  return data.files[0].url
}

async function uploadTmpFiles(buffer: Buffer, fileName: string) {
  const ft   = await fileTypeFromBuffer(buffer)
  const ext  = ft?.ext || 'bin'
  const form = new FormData()
  form.append('file', buffer, `${fileName}.${ext}`)
  const res  = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST', body: form, timeout: 30000
  })
  const data = await res.json()
  if (data.status === 'success' && data.data?.url) {
    const parts = data.data.url.split('/')
    return `https://tmpfiles.org/dl/${parts[parts.length - 2]}/${parts[parts.length - 1]}`
  }
  throw new Error('TmpFiles gagal')
}

async function uploadImgBB(buffer: Buffer, _fileName: string) {
  const base64 = buffer.toString('base64')
  const res = await axios.post(
    `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
    new URLSearchParams({ image: base64 }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 }
  )
  const url = res.data?.data?.url
  if (!url) throw new Error('ImgBB gagal')
  return url
}

async function uploadPutIcu(buffer: Buffer, fileName: string) {
  const ft  = await fileTypeFromBuffer(buffer)
  const ext = ft?.ext || 'bin'
  const res = await fetch('https://put.icu/upload/', {
    method: 'PUT',
    body: buffer,
    headers: {
      Accept: 'application/json',
      'Content-Type': ft?.mime || 'application/octet-stream',
    },
    timeout: 60000,
  })
  if (!res.ok) throw new Error('Put.icu gagal')
  const data = await res.json()
  if (data?.direct_url) return data.direct_url
  if (data?.url)        return data.url
  throw new Error('Put.icu: Invalid response')
}

async function uploadOrnzora(buffer: Buffer, fileName: string) {
  const ft   = await fileTypeFromBuffer(buffer)
  const ext  = ft?.ext || 'bin'
  const mime = ft?.mime || 'application/octet-stream'
  const form = new FormData()
  form.append('file', buffer, { filename: `${fileName}.${ext}`, contentType: mime })
  const res = await axios.post('https://cdn.ornzora.eu.cc/upload', form, {
    headers: {
      ...form.getHeaders(),
    },
    timeout:          60000,
    maxBodyLength:    Infinity,
    maxContentLength: Infinity,
  })
  const data = res.data
  const url  =
    data?.url        ||
    data?.data?.url  ||
    data?.link       ||
    data?.data?.link ||
    (typeof data === 'string' && data.startsWith('https://') ? data.trim() : null)
  if (!url) throw new Error('Ornzora tidak mengembalikan URL')
  return url as string
}

let _MorelaSock: any = null
async function uploadCdnWA(buffer: Buffer, _fileName: string) {
  if (!_MorelaSock) throw new Error('Koneksi bot tidak tersedia')
  const ft       = await fileTypeFromBuffer(buffer)
  const mime     = ft?.mime || 'application/octet-stream'
  const mediaType = mime.startsWith('video') ? 'video'
                  : mime.startsWith('audio') ? 'audio'
                  : mime.startsWith('image') ? 'image'
                  : 'document'
  const url = await Toolkit.toUrl(_MorelaSock, buffer, mediaType)
  if (!url) throw new Error('CDN WA tidak mengembalikan URL')
  return url
}

const SERVICES = [
  { name: 'CDN WA',   emoji: '💬', fn: uploadCdnWA,     note: 'WhatsApp CDN' },
  { name: 'Ornzora',   emoji: '🌐', fn: uploadOrnzora,   note: 'CDN Publik Permanen' },
  { name: 'Litterbox', emoji: '🗃️', fn: uploadLitterbox, note: 'Expires 72 jam' },
  { name: 'Gofile',   emoji: '🗂️', fn: uploadGofile,    note: 'Permanen' },
  { name: 'Qu.ax',    emoji: '🔗', fn: uploadQuax,       note: 'Permanen' },
  { name: 'TmpFiles', emoji: '⏳', fn: uploadTmpFiles,   note: 'Expires 24 jam' },
  { name: 'ImgBB',    emoji: '🌅', fn: uploadImgBB,      note: 'Khusus gambar' },
  { name: 'Put.icu',  emoji: '📡', fn: uploadPutIcu,     note: 'Expires 1 hari' },
]

function unwrapMsg(msg: any) {
  let m = msg || {}
  for (let i = 0; i < 10; i++) {
    if (m?.ephemeralMessage?.message)           { m = m.ephemeralMessage.message;           continue }
    if (m?.viewOnceMessage?.message)            { m = m.viewOnceMessage.message;            continue }
    if (m?.viewOnceMessageV2?.message)          { m = m.viewOnceMessageV2.message;          continue }
    if (m?.viewOnceMessageV2Extension?.message) { m = m.viewOnceMessageV2Extension.message; continue }
    if (m?.documentWithCaptionMessage?.message) { m = m.documentWithCaptionMessage.message; continue }
    break
  }
  return m
}

const MEDIA_MTYPES = ['imageMessage','videoMessage','audioMessage','stickerMessage','documentMessage']

function pickMediaNode(m: any) {
  const q = m.quoted
  if (!q) return null

  const mtype: string = q.mtype || q.type || ''
  if (MEDIA_MTYPES.includes(mtype) && typeof q.download === 'function') {
    return {
      node:     q,
      type:     mtype.replace('Message', ''),
      download: (q.download as () => Promise<Buffer>).bind(q)
    }
  }

  if (q.url && q.mediaKey && typeof q.download === 'function') {
    const mime: string = q.mimetype || ''
    const type = mime.startsWith('video') ? 'video'
               : mime.startsWith('audio') ? 'audio'
               : mime.startsWith('image') ? 'image'
               : 'document'
    return { node: q, type, download: q.download.bind(q) }
  }

  return null
}

const handler = async (m: any, { Morela, reply, usedPrefix, fkontak }: any) => {
  _MorelaSock = Morela
  const media = pickMediaNode(m)

  if (!media) {
    await Morela.relayMessage(m.chat, {
      interactiveMessage: {
        header: { hasMediaAttachment: false },
        body: {
          text:
            `╭──「 📤 *Upload File* 」\n│\n` +
            `│  Reply file/foto/video lalu ketik:\n` +
            `│  *${usedPrefix}tourl*\n│\n` +
            `│  📌 *Layanan tersedia:*\n` +
            `│  💬 CDN WA    — WhatsApp CDN\n` +
            `│  🌐 Ornzora   — CDN Publik Permanen\n` +
            `│  🗃️ Litterbox — 72 jam\n` +
            `│  🗂️ Gofile    — Permanen\n` +
            `│  🔗 Qu.ax     — Permanen\n` +
            `│  ⏳ TmpFiles  — 24 jam\n` +
            `│  🌅 ImgBB     — Khusus gambar\n` +
            `│  📡 Put.icu   — 1 hari\n│\n` +
            `│  Semua diupload sekaligus!\n│\n` +
            `╰─────────────────────`
        },
        footer: { text: `© ${botName}` },
        contextInfo: { forwardingScore: 1, isForwarded: true, quotedMessage: (fkontak || m)?.message },
        nativeFlowMessage: {
          buttons: [{
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({ display_text: 'Channel', url: CHANNEL_URL, merchant_url: CHANNEL_URL })
          }]
        }
      }
    }, { messageId: Morela.generateMessageTag() })
    return
  }

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  let buffer: Buffer
  try {
    if (typeof (media as any).download === 'function') {

      const buf = await (media as any).download()
      if (!buf || !buf.length) throw new Error('Buffer kosong')
      buffer = buf
    } else {

      const stream = await downloadContentFromMessage(media.node, media.type)
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk)
      buffer = Buffer.concat(chunks)
      if (!buffer.length) throw new Error('Buffer kosong')
    }
  } catch (e) {
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return reply(`❌ Gagal download media\n\n${(e as Error).message}`)
  }

  const ft       = await fileTypeFromBuffer(buffer)
  const ext      = ft?.ext || 'bin'
  const fileName = `upload-${Date.now()}`
  const size     = buffer.length >= 1024 * 1024
    ? (buffer.length / 1024 / 1024).toFixed(2) + ' MB'
    : (buffer.length / 1024).toFixed(1) + ' KB'

  await Morela.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })

  const results = await Promise.allSettled(
    SERVICES.map(svc => svc.fn(buffer, fileName))
  )

  const lines: string[]  = [
    `╭──「 📤 *Upload Result* 」`,
    `│  📁 \`${fileName}.${ext}\` • ${size}`,
    `│`,
  ]
  const buttons: any[] = []
  let anySuccess = false

  for (let i = 0; i < SERVICES.length; i++) {
    const svc = SERVICES[i]
    const res = results[i]

    if (res.status === 'fulfilled') {
      anySuccess = true
      const url = res.value as string
      lines.push(`│  ${svc.emoji} *${svc.name}* ✅ — ${svc.note}`)
      lines.push(`│`)
      buttons.push({
        name: 'cta_copy',
        buttonParamsJson: JSON.stringify({
          display_text: `Salin ${svc.name}`,
          copy_code:    url,
        })
      })
    } else {
      lines.push(`│  ${svc.emoji} *${svc.name}* ❌ — ${(res as PromiseRejectedResult).reason?.message || 'gagal'}`)
      lines.push(`│`)
    }
  }

  lines.push(`╰─────────────────────`)
  lines.push(`© ${botName}`)

  buttons.push({
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({ display_text: 'Channel', url: CHANNEL_URL, merchant_url: CHANNEL_URL })
  })

  await Morela.relayMessage(m.chat, {
    interactiveMessage: {
      header: { hasMediaAttachment: false },
      body:   { text: lines.join('\n') },
      footer: { text: `© ${botName}` },
      contextInfo: { forwardingScore: 1, isForwarded: true, quotedMessage: (fkontak || m)?.message },
      nativeFlowMessage: { buttons }
    }
  }, { messageId: Morela.generateMessageTag() })

  await Morela.sendMessage(m.chat, { react: { text: anySuccess ? '✅' : '❌', key: m.key } })
}

handler.help    = ['tourl (reply file/foto/video)']
handler.tags    = ['tools']
handler.command = ['tourl']
handler.noLimit = false

export default handler