import { createCanvas, loadImage, registerFont } from 'canvas'
import path   from 'path'
import fs     from 'fs'
import sharp  from 'sharp'
import { getPushName }                                             from '../../Database/db.js'
import { botName, uploadImage, buildFkontak, sendCard, menuBuf as defaultMenuBuf,
         getGreeting, imagePath, CHANNEL_URL }                                   from '../../Library/utils.js'
import {
  resolveTarget as resolveTargetUser,
  resolveDisplayName,
  findParticipant,
  normNum,
  isLidJid,
  resolveLidToPhone,
}                                                                                  from '../../Library/resolve.js'

const FONT_DIR = path.join(process.cwd(), 'data', 'font')
const FONT_FAM = 'Poppins'
let   _fontReg = false

function tryFont() {
  if (_fontReg) return
  try {
    registerFont(path.join(FONT_DIR, 'Poppins-Bold.ttf'),    { family: FONT_FAM, weight: 'bold'   })
    registerFont(path.join(FONT_DIR, 'Poppins-Regular.ttf'), { family: FONT_FAM, weight: 'normal' })
    _fontReg = true
  } catch {}
}

function wrapText(ctx: any, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur)
      cur = w
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function drawBubble(
  ctx: any,
  text: string,
  bx: number,   
  by: number,   
  maxW: number,
  tail: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right',
  opts: {
    bgColor?: string
    textColor?: string
    borderColor?: string
    fontSize?: number
    bold?: boolean
  } = {}
) {
  tryFont()
  const {
    bgColor     = 'rgba(255,255,255,0.96)',
    textColor   = '#1a1a1a',
    borderColor = '#333333',
    fontSize    = 18,
    bold        = false,
  } = opts

  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px "${FONT_FAM}"`

  const lines    = wrapText(ctx, text, maxW - 28)
  const lineH    = fontSize * 1.35
  const padX     = 14
  const padY     = 10
  const bw       = maxW
  const bh       = lines.length * lineH + padY * 2
  const rx       = bx - bw / 2
  const ry       = by - bh / 2
  const radius   = 12
  const tailLen  = 18
  const tailBase = 10

  function roundedRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  ctx.save()
  ctx.shadowColor   = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur    = 10
  ctx.shadowOffsetX = 3
  ctx.shadowOffsetY = 3
  roundedRect(rx, ry, bw, bh, radius)
  ctx.fillStyle = bgColor
  ctx.fill()
  ctx.restore()

  roundedRect(rx, ry, bw, bh, radius)
  ctx.strokeStyle = borderColor
  ctx.lineWidth   = 2
  ctx.stroke()
  ctx.fillStyle   = bgColor
  ctx.fill()

  ctx.beginPath()
  if (tail === 'bottom-left') {

    ctx.moveTo(rx + 20,          ry + bh)
    ctx.lineTo(rx + 20 + tailBase, ry + bh)
    ctx.lineTo(rx + 14,          ry + bh + tailLen)
  } else if (tail === 'bottom-right') {
    ctx.moveTo(rx + bw - 20 - tailBase, ry + bh)
    ctx.lineTo(rx + bw - 20,            ry + bh)
    ctx.lineTo(rx + bw - 14,            ry + bh + tailLen)
  } else if (tail === 'top-left') {
    ctx.moveTo(rx + 14,            ry - tailLen)
    ctx.lineTo(rx + 20,            ry)
    ctx.lineTo(rx + 20 + tailBase, ry)
  } else if (tail === 'top-right') {
    ctx.moveTo(rx + bw - 14,             ry - tailLen)
    ctx.lineTo(rx + bw - 20 - tailBase,  ry)
    ctx.lineTo(rx + bw - 20,             ry)
  }
  ctx.closePath()
  ctx.fillStyle   = bgColor
  ctx.fill()
  ctx.strokeStyle = borderColor
  ctx.lineWidth   = 2
  ctx.stroke()

  ctx.fillStyle = textColor
  ctx.textAlign = 'center'
  ctx.font      = `${bold ? 'bold ' : ''}${fontSize}px "${FONT_FAM}"`
  const textStartY = ry + padY + lineH * 0.75
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], bx, textStartY + i * lineH)
  }
}

const ACCOLADE_PATHS = [
  path.join(process.cwd(), 'media', 'accolade.jpg'),
  path.join(process.cwd(), 'data',  'accolade.jpg'),
  path.join(process.cwd(), 'data',  'promote.jpg'),
  path.join(process.cwd(), 'media', 'promote.jpg'),
]

const ACCOLADE_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Edmund_Blair_Leighton_-_The_Accolade.jpg/800px-Edmund_Blair_Leighton_-_The_Accolade.jpg'

async function loadAckoladeBuffer(): Promise<Buffer | null> {

  for (const p of ACCOLADE_PATHS) {
    if (fs.existsSync(p)) {
      console.log(`[PROMOTE] ✅ Gambar ditemukan: ${p}`)
      return fs.readFileSync(p)
    }
  }

  console.log('[PROMOTE] ⚠️ File lokal tidak ditemukan, download dari URL...')
  try {
    const axios    = (await import('axios')).default
    const res      = await axios.get(ACCOLADE_URL, {
      responseType: 'arraybuffer',
      timeout:      15_000,
    })
    const buf = Buffer.from(res.data)

    const cachePath = path.join(process.cwd(), 'media', 'accolade.jpg')
    try {
      if (!fs.existsSync(path.join(process.cwd(), 'media'))) {
        fs.mkdirSync(path.join(process.cwd(), 'media'), { recursive: true })
      }
      fs.writeFileSync(cachePath, buf)
      console.log(`[PROMOTE] 💾 Gambar di-cache ke ${cachePath}`)
    } catch {}

    return buf
  } catch (e: any) {
    console.error('[PROMOTE] ❌ Gagal download gambar:', e?.message)
    return null
  }
}

async function buildAckoladeCanvas(
  queenText: string,  
  knightText: string, 
  isPromote: boolean
): Promise<Buffer> {
  tryFont()

  const W = 520, H = 760

  const canvas = createCanvas(W, H)
  const ctx    = canvas.getContext('2d')

  const bgBuf = await loadAckoladeBuffer()

  if (bgBuf) {
    const resized = await sharp(bgBuf)
      .resize(W, H, { fit: 'cover', position: 'top' })  
      .jpeg({ quality: 92 })
      .toBuffer()
    const bg = await loadImage(resized)
    ctx.drawImage(bg, 0, 0, W, H)
  } else {

    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0,   '#2c1810')
    g.addColorStop(0.5, '#4a2c1a')
    g.addColorStop(1,   '#1a0f0a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  const topGrad = ctx.createLinearGradient(0, 0, 0, 200)
  topGrad.addColorStop(0,   'rgba(0,0,0,0.45)')
  topGrad.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = topGrad
  ctx.fillRect(0, 0, W, 200)

  const botGrad = ctx.createLinearGradient(0, H - 160, 0, H)
  botGrad.addColorStop(0,   'rgba(0,0,0,0)')
  botGrad.addColorStop(1,   'rgba(0,0,0,0.5)')
  ctx.fillStyle = botGrad
  ctx.fillRect(0, H - 160, W, 160)

  drawBubble(
    ctx,
    queenText,
     195,  105,
     280,
    'bottom-right',
    {
      bgColor:     isPromote ? 'rgba(255,252,235,0.96)' : 'rgba(255,235,235,0.96)',
      borderColor: isPromote ? '#c9a227'                : '#a02020',
      textColor:   '#1a1a1a',
      fontSize:    17,
      bold:        false,
    }
  )

  drawBubble(
    ctx,
    knightText,
     350,  540,
     260,
    'top-left',
    {
      bgColor:     'rgba(235,245,255,0.96)',
      borderColor: isPromote ? '#1e6fbf' : '#555555',
      textColor:   '#1a1a1a',
      fontSize:    16,
      bold:        false,
    }
  )

  ctx.font      = `13px "${FONT_FAM}"`
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.textAlign = 'right'
  ctx.fillText(`© ${botName}`, W - 12, H - 10)

  return canvas.toBuffer('image/jpeg', { quality: 0.92 })
}

const PROMOTE_QUEEN = [
  'Dengan pedang ini, ku angkat kamu sebagai Admin! ⚔️ Jagalah amanah ini dengan bijak.',
  'Rakyatku... mulai hari ini kamu ku percaya dengan gelar Admin! 🏰 Jangan kecewakan ku.',
  'Ksatriaku yang terpilih — Tahta Admin ku serahkan padamu! 👑 Gunakan dengan adil.',
  'Dari sekian banyak ksatria, hanya kamu yang layak. Terimalah mahkota Admin ini! ✨',
]

const PROMOTE_KNIGHT = [
  'Terima kasih, Yang Mulia! Akan ku jaga grup ini sepenuh jiwa! 🙏',
  'Mulia sekali kepercayaan ini... aku siap bertugas, my lady! 🛡️',
  'Aku bersumpah, kehormatan Admin ini takkan ku sia-siakan! ⚔️',
  'Yes! Finally! Aku berjanji tidak akan abuse power ini 👀✨',
]

const DEMOTE_QUEEN = [
  'Gelar Admin mu ku cabut hari ini... 😞 Kamu telah mengecewakan tahta.',
  'Dengan berat hati, pedang Admin ini ku ambil kembali darimu. Selamat tinggal! 🗡️',
  'Kamu sudah tidak layak memegang pedang ini... Admin dicabut! 😤',
  'Maaf ksatriaku, tapi tahta Admin ini bukan milikmu lagi. Kembali ke rakyat jelata! 👋',
]

const DEMOTE_KNIGHT = [
  'Ampun, Yang Mulia... \'Tis but a scratch... 😭',
  'Tidak... tidak bisa begini! Aku protes! ✊😤',
  'Baiklah... aku terima keputusan Yang Mulia. Tapi ini tidak adil! 😔',
  'Selamat tinggal, kursi Admin ku tercinta... 💔',
]

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

const handler = async (m: any, { Morela, command, args, reply, fkontak, participants, senderJid, isAdmin, botAdmin }: any) => {
  const from      = m.chat
  const isPromote = command === 'promote' || command === 'jadmin'

  if (!m.isGroup) {
    return reply(`❌ Perintah *.${command}* hanya bisa digunakan di dalam grup!`)
  }

  if (!botAdmin) {
    return reply(
      `❌ *Bot bukan admin!*\n\n` +
      `Jadikan bot sebagai admin grup terlebih dahulu agar bisa ${isPromote ? 'promote' : 'demote'} member. 🤖`
    )
  }

  if (!isAdmin) {
    return reply(`🚫 Hanya *admin grup* yang bisa menggunakan perintah ini!`)
  }

  const targetJid = resolveTargetUser(m, args).jid

  if (!targetJid) {
    return reply(
      `${isPromote ? '👑' : '🗡️'} *${isPromote ? 'Promote' : 'Demote'} Admin*\n\n` +
      `📌 *Cara pakai:*\n` +
      `╭─────────────────────\n` +
      `│ .${command} @mention\n` +
      `│ .${command} 628xxx\n` +
      `│ Reply pesan + .${command}\n` +
      `╰─────────────────────\n\n` +
      `_Gunakan mention, nomor HP, atau reply pesan target._`
    )
  }

  const _rawTargetNum = normNum(targetJid)
  const senderNum     = normNum(senderJid)
  if (_rawTargetNum && senderNum && _rawTargetNum === senderNum) {
    return reply(`😅 Kamu tidak bisa ${isPromote ? 'promote' : 'demote'} diri sendiri!`)
  }

  let liveParticipants: any[] = participants || []
  try {
    const meta       = await Morela.groupMetadata(from)
    liveParticipants = meta?.participants || liveParticipants
  } catch {}

  const targetParticipant = findParticipant(liveParticipants, targetJid)

  if (!targetParticipant) {
    return reply(
      `❌ *Target tidak ditemukan* di grup ini!\n\n` +
      `Pastikan user yang kamu tuju masih berada di grup. 👀`
    )
  }

  const actualJid      = targetParticipant.id
  const targetIsAdmin  = targetParticipant.admin === 'admin' || targetParticipant.admin === 'superadmin'
  const _isLid         = isLidJid(actualJid)
  const _rawLidNum     = actualJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')

  let _phone: string | null = _isLid ? resolveLidToPhone(actualJid) : null

  if (!_phone && _isLid && targetParticipant.phoneNumber) {
    _phone = String(targetParticipant.phoneNumber).replace(/[^0-9]/g, '') || null
  }

  if (!_phone && _isLid) {
    const freshP = findParticipant(liveParticipants, actualJid)
    if (freshP?.phoneNumber) {
      _phone = String(freshP.phoneNumber).replace(/[^0-9]/g, '') || null
    }
  }

  const targetNum  = _phone || (_isLid ? _rawLidNum : _rawTargetNum)
  const targetPhoneJid = _phone ? `${_phone}@s.whatsapp.net` : actualJid

  if (isPromote && targetIsAdmin) {
    return reply(`⚠️ *Sudah jadi Admin!*\n\n@${targetNum} sudah menjadi admin grup ini.`)
  }
  if (!isPromote && !targetIsAdmin) {
    return reply(`⚠️ *Bukan Admin!*\n\n@${targetNum} belum menjadi admin grup ini.`)
  }

  const targetName =
    (await resolveDisplayName(Morela, m, targetPhoneJid, { participants: liveParticipants, fallback: targetNum }))

  await Morela.sendMessage(from, { react: { text: '⏳', key: m.key } })

  let success = false
  try {
    await Morela.groupParticipantsUpdate(
      from,
      [actualJid],
      isPromote ? 'promote' : 'demote'
    )
    success = true
  } catch (err: any) {
    console.error(`[PROMOTE/DEMOTE] WA API error:`, err?.message)
  }

  if (!success) {
    await Morela.sendMessage(from, { react: { text: '❌', key: m.key } })
    return reply(
      `❌ *Gagal ${isPromote ? 'promote' : 'demote'}!*\n\n` +
      `WhatsApp menolak permintaan ini. Pastikan bot masih menjadi admin grup.`
    )
  }

  const queenText  = isPromote ? pick(PROMOTE_QUEEN) : pick(DEMOTE_QUEEN)
  const knightText = isPromote ? pick(PROMOTE_KNIGHT) : pick(DEMOTE_KNIGHT)

  let imgBuf: Buffer | null = null
  try {
    imgBuf = await buildAckoladeCanvas(queenText, knightText, isPromote)
  } catch (canvasErr: any) {
    console.error('[PROMOTE/DEMOTE] Canvas error:', canvasErr?.message)
  }

  const greeting = getGreeting()

  const footerCard = isPromote
    ? (
        `${greeting} ✨\n\n` +
        `👑 *SELAMAT, ADMIN BARU!*\n\n` +
        `Halo @${targetNum}! 🎉\n` +
        `Kamu telah *dipercaya* menjadi *Admin* grup ini!\n\n` +
        `╭──────────────────────\n` +
        `│ 👤 Nama   : *${targetName}*\n` +
        `│ 📱 Nomor  : +${targetNum}\n` +
        `│ 🏅 Status : *Admin* ✅\n` +
        `│ ⚔️  Oleh   : @${senderNum}\n` +
        `╰──────────────────────\n\n` +
        `_"Dengan kuasa datang tanggung jawab._\n` +
        `_Gunakan jabatan ini dengan bijak!"_ 🌟\n\n` +
        `꒰ © ${botName} ꒱`
      )
    : (
        `${greeting} ✨\n\n` +
        `🗡️ *GELAR ADMIN DICABUT*\n\n` +
        `Halo @${targetNum}... 😞\n` +
        `Gelar *Admin* kamu telah *dicabut* dari grup ini.\n\n` +
        `╭──────────────────────\n` +
        `│ 👤 Nama   : *${targetName}*\n` +
        `│ 📱 Nomor  : +${targetNum}\n` +
        `│ 🔻 Status : *Member* biasa\n` +
        `│ ⚔️  Oleh   : @${senderNum}\n` +
        `╰──────────────────────\n\n` +
        `_"Setiap jabatan ada masanya._\n` +
        `_Terima dengan lapang dada!"_ 💙\n\n` +
        `꒰ © ${botName} ꒱`
      )

  try {

    const cardImgBuf = imgBuf
      || (fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null)
      || defaultMenuBuf

    if (cardImgBuf) {

      await sendCard(
        Morela,
        from,
        footerCard,
        cardImgBuf,
        fkontak   
      )
    } else {

      await Morela.sendMessage(from, {
        text:     footerCard,
        mentions: [actualJid, senderJid].filter(Boolean),
      }, { quoted: fkontak || m })
    }

    await Morela.sendMessage(from, { react: { text: isPromote ? '👑' : '🗡️', key: m.key } })

  } catch (sendErr: any) {
    console.error('[PROMOTE/DEMOTE] Send error:', sendErr?.message)
    await Morela.sendMessage(from, { react: { text: '⚠️', key: m.key } })
  }
}

handler.command  = ['promote', 'demote', 'jadmin', 'unadmin']
handler.tags     = ['admin', 'group']
handler.help     = [
  'promote @mention / 628xxx / reply — jadikan admin',
  'demote @mention / 628xxx / reply  — cabut admin',
]
handler.group    = true
handler.admin    = true
handler.botAdmin = true
handler.owner    = false
handler.premium  = false
handler.private  = false
handler.noLimit  = true

export default handler
