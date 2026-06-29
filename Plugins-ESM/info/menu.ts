import fs   from 'fs'
import axios from 'axios'
import os    from 'os'
import path  from 'path'
import { fileURLToPath } from 'url'
import { runtime } from '../../System/message.js'
import * as baileys from '@itsliaaa/baileys'
import { isSelfMode } from '../../System/selfmode.js'
import { AIRich } from '../../Library/MessageBuilder.js'

const {
  generateWAMessageContent,
  generateWAMessageFromContent,
  proto
} = baileys

const __filename = fileURLToPath(import.meta.url as string)
const __dirname  = path.dirname(__filename)

const imagePath = path.join(process.cwd(), 'media/menu.jpg')

function getMenuBuf(): Buffer {
  if (fs.existsSync(imagePath)) return fs.readFileSync(imagePath)
  return Buffer.alloc(0)
}

function getFkontakBuf(): Buffer {
  const fkontakPath = path.join(process.cwd(), 'media', 'fkontak.jpg')
  if (fs.existsSync(fkontakPath)) return fs.readFileSync(fkontakPath)
  if (fs.existsSync(imagePath))   return fs.readFileSync(imagePath)
  return Buffer.alloc(0)
}

const BOT_JID     = '13135550002@s.whatsapp.net'
const CHANNEL_JID = '120363420704282055@newsletter'
const CHANNEL_URL = 'https://whatsapp.com/channel/0029VbC6GY50VycJQ7nFgo3v'
const OWNER_WA    = 'https://wa.me/628999889149'
const botName     = global.botName    || 'Morela'
const botVersion  = global.botVersion || 'v2.0.0'
const ownerName   = global.ownerName  || 'putraa'

interface MenuCategory {
  emoji:    string
  title:    string
  commands: string[]
}

interface MorelaSock {
  waUploadToServer:           (...args: unknown[]) => unknown
  relayMessage:               (jid: string, message: unknown, opts: unknown) => Promise<unknown>
  sendMessage:                (jid: string, content: unknown, opts?: unknown) => Promise<unknown>
  groupFetchAllParticipating: () => Promise<Record<string, { participants?: unknown[] }>>
  generateMessageTag:         () => string
  [key: string]:              unknown
}

export const MENU_LISTS: Record<string, MenuCategory> = {
  ai:         { emoji: '🤖', title: 'AI MENU',    commands: ['img','image','genmyart','mathgpt','aion/off','ai2on/off','removebg','to4k','omni edit','omni gen'] },
  downloader: { emoji: '📥', title: 'DOWNLOADER', commands: ['yts','tt','tt2','alldownload','ttslide','play','ig','pin','ptv','upload','mediafire','spotify','soundcloud','sad'] },
  sticker:    { emoji: '✨', title: 'STICKER',     commands: ['attp','emoji','emojimix','qc','brat','bratvid','bratruromiya','brattren','bratgura','stickerpack','smeme','bratspongebob','ttp','stiker','stikerbrat','swm','linesticker'] },
  maker:      { emoji: '🎨', title: 'MAKER',       commands: ['fakedev','fakeff','fakeffduo','discord','fakestory','faketweet','iqc','musiccard','carbon','fakeml','toimage','tofigurav3','tofigurav2','tofigura','tosad','tosatan','tosdmtinggi','toreal','tomoai','tomaya','tolego','tokamboja','tokacamata','tojepang','toghibli','todubai','todpr','tochibi','tobrewok','toblonde','tobotak','tohijab','tomekah','tomirror','tovintage','tomaid','tomangu','topeci','topiramida','topolaroid','topunk','toroh','tostreetwear','totato','totrain','totua','toturky','toanime','tomonyet','toroblox','tobabi','toputih','tobersama','putihkan','hitamkan'] },
  ephoto:     { emoji: '🖼️', title: 'EPHOTO',     commands: ['glitchtext','writetext','advancedglow','typographytext','pixelglitch','neonglitch','flagtext','flag3dtext','deletingtext','blackpinkstyle','glowingtext','underwatertext','logomaker','cartoonstyle','papercutstyle','watercolortext','effectclouds','blackpinklogo','gradienttext','summerbeach','luxurygold','multicoloyellowneon','sandsummer','galaxywallpaper','1917style','makingneon','royaltext','freecreate','galaxystyle','lighteffects','flaming'] },
  tools:      { emoji: '🛠️', title: 'TOOLS',      commands: ['hd','hdv1','hdvid','hdv2','tempmail','rvo on/off','rvo2','skipsfl','tri','ttf','ping','test','removewm','daftar','listuser','getpp','getppgrup','inspect','tovideo','toimage','tomp3','tgspy','facedetector','deploy','bypass','userinfo'] },
  game:       { emoji: '🎮', title: 'GAME & RPG',  commands: ['truthordare','susunkata','tebaksurah','tebakkata','tebakkimia','tebakbendera','tebakgambar','asahotak','family100','quran','quote','guildwar','buildml','profil','me','mining','tambang','listmining','truth','dare','bucin','gombal','cekkhodam','khodam','akankah','apakah','bagaimana','berapa','bisakah','coba','dimana','haruskah','kapan','kapankah','mengapa','rate','mimpi','soulmatch','tembak','terima','tolak','putus','cekpacar','jodoh','cp','couple','jodohku','gay','siapa','bego','goblok','janda','perawan','babi','tolol','pekok','jancok','pintar','asu','bodoh','lesby','bajingan','anjing','ngentod','monyet','mastah','newbie','bangsat','bangke','sange','sangean','dakjal','horny','wibu','peak','pantek','setan','iblis','cacat','yatim','piatu','gaycek','cekgay','sangecek','ceksange','lesbicek','ceklesbi','top','top5','sulap'] },
  info:       { emoji: 'ℹ️', title: 'INFO',       commands: ['tm','transfermarkt','jadwalbola'] },
  nsfw:       { emoji: '🔞', title: '18+ / NSFW',  commands: ['shinobu','megumin','bully','cuddle','cry','hug','awoo','kiss','lick','pat','smug','bonk','yeet','blush','smile','wave','highfive','handhold','nom','bite','glomp','slap','kill','happy','wink','poke','dance','cringe','trap','blowjob','hentai','boobs','ass','pussy','thighs','lesbian','lewdneko','cum','waifu-nsfw','neko-nsfw'] },
  admin:      { emoji: '🔰', title: 'ADMIN',       commands: ['open','close','opengc','closegc','resetlink','welcome on/off','goodbye on/off','intro on/off','reactionkick','antilink on/off','on antibot','on antivideo','on antifoto','on antiaudio','on antidokumen','on antisticker','on antimention','off antibot (contoh)','antistatus','listwarn','delwarn','delwarn @user','mute','unmute','htprem'] },
  owner:      { emoji: '👑', title: 'OWNER',       commands: ['owner','addowner','delowner','listowner','addprem','delprem','plugin','delplugin','getplugin','listplugin','reloadplugin','backup','backupdb','clearcache','self','public','stikercmd','sc','sewa','deldaftar','undress','pay','ceklimit','listlimit','resetlimitall','resetdb','cekdb','topchat','setmenu v1','setmenu v2','setmenu v3','setmenu v4','jadibot','stopbot','listbot','d','nsfw','privatemode on/off','healthcheck','stats','resetstats','tgbot token','tgbot id','tgbot test','tgbot on','tgbot off','tgbot reset','tgspy','=>','>','$','sewabot','listsewa','ceksewa','delsewa','agenton/off','outgc','joingc','swgc','antiswgc'] }
}

function buildMenuBody(withFooter = false): string {
  const body = Object.values(MENU_LISTS).map(d => `🔖 ⌞ ${d.title.toLowerCase()} ⌝`).join('\n')
  return withFooter ? body + `\n\nPowered by ${botName} ✨` : body
}

function buildFullMenuBody(pushname: string, groupJid = '', senderJid = '', isOwn = false, isPrem = false, withFooter = false, withGreeting = true, useMd = true): string {
  const uptime = runtime(process.uptime())
  const mode   = isSelfMode(groupJid) ? 'Self' : 'Public'
  let totalCommands = 0
  Object.values(MENU_LISTS).forEach(d => totalCommands += d.commands.length)

  let akses = '👤 User', limit = '-', level = '-', exp = '-', rank = '-', saldo = '-', daftar = '❌ Belum', status = '🟡 Unknown'
  try {
    const { getUser, isRegistered } = require('../../Database/db.js')
    const { getUsage, getUserDailyLimit } = require('../../Database/usagelimit.js')
    const ud = getUser(senderJid)
    const isReg = isRegistered(senderJid)
    if (isOwn) {
      akses = '👑 Owner'; limit = '9.000.000.000.000'; level = '9.000.000.000.000'
      exp = '9.000.000.000.000'; rank = '👑 Legend'; saldo = 'Rp 9.000.000.000.000'
      daftar = isReg ? '✅ Sudah' : '❌ Belum'; status = '🟢 Good'
    } else if (isReg && ud) {
      akses = isPrem ? '💎 Premium' : '👤 User'
      const maxLimit = getUserDailyLimit(ud.level || 0)
      const usage = getUsage(senderJid, maxLimit)
      limit = `${usage.sisa}/${maxLimit}`
      level = String(ud.level || 0); exp = String(ud.exp || 0)
      const lv = ud.level || 0
      rank = lv >= 100 ? '👑 Legend' : lv >= 50 ? '💎 Diamond' : lv >= 30 ? '🥇 Gold' : lv >= 20 ? '🥈 Silver' : lv >= 10 ? '🥉 Bronze' : '🪨 Iron'
      saldo = `Rp ${(ud.balance || 0).toLocaleString('id-ID')}`
      daftar = '✅ Sudah'
      status = usage.sisa > maxLimit * 0.5 ? '🟢 Good' : usage.sisa > 0 ? '🟡 Low' : '🔴 Habis'
    }
  } catch {}

  const nameDisplay = useMd ? `*${pushname}!*` : `${pushname}!`
  let txt = withGreeting ? `${getGreeting()}, ${nameDisplay} ✨\n\n` : ''

  txt += `🔖 ⌞ INFO BOT ⌝\n`
  txt += `🔖 ⌞ Name     : ${botName} ⌝\n`
  txt += `🔖 ⌞ Version  : ${botVersion} ⌝\n`
  txt += `🔖 ⌞ Uptime   : ${uptime} ⌝\n`
  txt += `🔖 ⌞ Owner    : ${ownerName} ⌝\n`
  txt += `🔖 ⌞ Mode     : ${mode} ⌝\n`
  txt += `🔖 ⌞ Commands : ${totalCommands} ⌝\n\n`

  txt += `🔖 ⌞ INFO USER ⌝\n`
  txt += `🔖 ⌞ Nama   : ${pushname} ⌝\n`
  txt += `🔖 ⌞ Akses  : ${akses} ⌝\n`
  txt += `🔖 ⌞ Limit  : ${limit} ⌝\n`
  txt += `🔖 ⌞ Level  : ${level} ⌝\n`
  txt += `🔖 ⌞ EXP    : ${exp} ⌝\n`
  txt += `🔖 ⌞ Rank   : ${rank} ⌝\n`
  txt += `🔖 ⌞ Saldo  : ${saldo} ⌝\n`
  txt += `🔖 ⌞ Daftar : ${daftar} ⌝\n`
  txt += `🔖 ⌞ Status : ${status} ⌝\n\n`

  txt += `🔖 ⌞ TELEGRAM BOT ⌝\n`
  ;['/start','/status','/restart','/cc','/on','/off','/listbot','/stopbot','/broadcast','/resetlink','/resetlink all','/kirim','/exec','/eval','/shell'].forEach(c => {
    txt += `🔖 ⌞ ${c} ⌝\n`
  })
  txt += '\n'

  for (const [, data] of Object.entries(MENU_LISTS)) {
    txt += `🔖 ⌞ ${data.emoji} ${data.title} ⌝\n`
    data.commands.forEach(cmd => { txt += `🔖 ⌞ ${cmd} ⌝\n` })
    txt += '\n'
  }

  if (withFooter) txt += `Powered by ${botName} ✨`
  return txt.trim()
}

function buildCategoryBody(data: MenuCategory, withFooter = false): string {
  let txt = `🔖 ⌞ ${data.emoji} ${data.title} ⌝\n\n`
  data.commands.forEach(cmd => { txt += `🔖 ⌞ ${cmd} ⌝\n` })
  if (withFooter) txt += `\nPowered by ${botName} ✨`
  return txt
}

async function uploadImage(Morela: MorelaSock, buffer: Buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('uploadImage (menu): buffer tidak valid atau kosong')
  }
  const { imageMessage } = await generateWAMessageContent(
    { image: buffer },
    { upload: Morela.waUploadToServer as Parameters<typeof generateWAMessageContent>[1]['upload'] }
  )
  return imageMessage
}

import { getGreeting, buildFkontak, buildCtx } from '../../Library/utils.js'
import { getUser, isRegistered } from '../../Database/db.js'
import { getUsage, getUserDailyLimit } from '../../Database/usagelimit.js'
import { kvGet } from '../../Database/kvstore.js'

export function getMenuStyle(jid: string): string {
  try {
    const style = kvGet<string | null>('menuconfig', jid, null)
    if (style) return style
    const def = kvGet<string | null>('menuconfig', 'default', null)
    return def || 'v1'
  } catch { return 'v1' }
}

const IM = proto.Message.InteractiveMessage as unknown as {
  fromObject:        (o: Record<string, unknown>) => unknown
  Body:              { fromObject: (o: Record<string, unknown>) => unknown }
  Footer:            { fromObject: (o: Record<string, unknown>) => unknown }
  Header:            { fromObject: (o: Record<string, unknown>) => unknown }
  NativeFlowMessage: { fromObject: (o: Record<string, unknown>) => unknown }
}

async function buildFkontak_v1() {
  const BOT_NUMBER = BOT_JID.split('@')[0]
  const Mekik = getFkontakBuf()
  return {
    key: { participant: '0@s.whatsapp.net', fromMe: false, id: 'StatusBiz', remoteJid: 'status@broadcast' },
    message: { contactMessage: {
      displayName: botName,
      vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${botName}\nFN:${botName}\nORG:${botName};\nTEL;type=CELL;type=VOICE;waid=${BOT_NUMBER}:${BOT_NUMBER}\nEND:VCARD`,
      jpegThumbnail: Mekik
    } }
  }
}

async function sendMenu_v1(Morela: MorelaSock, jid: string, bodyText: string, imgBuf: Buffer, quoted: unknown): Promise<void> {
  const imageMessage = await uploadImage(Morela, imgBuf)
  const msg = generateWAMessageFromContent(jid, {
    viewOnceMessage: { message: {
      messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
      interactiveMessage: IM.fromObject({
        body:   IM.Body.fromObject({ text: bodyText }),
        footer: IM.Footer.fromObject({ text: `Powered by ${botName} ✨` }),
        header: IM.Header.fromObject({ title: `🔰 ${botName} Bot`, hasMediaAttachment: true, imageMessage }),
        nativeFlowMessage: IM.NativeFlowMessage.fromObject({
          buttons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Chat Owner', url: OWNER_WA, merchant_url: OWNER_WA }) }],
          messageParamsJson: JSON.stringify({
            bottom_sheet: { in_thread_buttons_limit: 999, divider_indices: [1, 999], list_title: `🔰 ${botName} Bot`, button_title: `${botName} Bot` }
          })
        })
      })
    } }
  }, { quoted })
  await Morela.relayMessage(jid, msg.message, { messageId: msg.key.id })
}

async function sendMenu_v2(Morela: MorelaSock, jid: string, bodyText: string): Promise<void> {
  const fk    = await buildFkontak(Morela)
  const ppUrl = await (Morela as any).profilePictureUrl((Morela as any).user.id, 'image')
    .catch(() => 'https://cdn.ornzora.eu.cc/4d2905ce-3707-4ec0-998a-68a3d851629f-FIORA.jpg')

  const builder = new AIRich(Morela as any)
    .setTitle(`AI Asisten`)
    .addProduct({
      title:       '',
      brand:       ownerName,
      price:       botVersion,
      sale_price:  '',
      product_url: OWNER_WA,
      icon_url:    ppUrl,
      image_url:   ppUrl,
    })
    .addTip(' ')

    .addImage('https://i.ibb.co/Nnm1Ntbs/3c2e0948d5b0.jpg', { mimeType: 'image/jpeg' })

    .addReels(Array(3).fill({
      username:    botName,
      profile_url: 'https://cdn.ornzora.eu.cc/ebef2c37-f97c-472e-a2f6-2a330d993f7a-upload-1780298222944.jpg',
      thumbnail:   'https://cdn.ornzora.eu.cc/aadbadda-ea38-4843-a18a-a3bb86bbb5cb-upload-1780296618011.jpg',
      url:         OWNER_WA,
      title:       botName,
      like:        0,
      share:       0,
      view:        0,
      source:      'IG',
      verified:    true,
    }))
    .addTip(' ')

  for (const line of bodyText.split('\n').filter(Boolean)) {
    builder.addTip(line)
  }

  await builder
    .addSource([
      ['https://www.google.com/s2/favicons?domain=whatsapp.com&sz=16', OWNER_WA, botName],
      ['https://www.google.com/s2/favicons?domain=github.com&sz=16', 'https://github.com/MorelaXz', 'GitHub Morela'],
    ])
    .send(jid, { quoted: fk })
}

function buildSections_v3() {
  return [{
    title: 'KATEGORI UTAMA',
    rows: Object.entries(MENU_LISTS).map(([key, data]) => ({
      title: `${data.emoji} ${data.title}`,
      id: `.menu_${key}`
    }))
  }]
}

async function sendMenu_v3(Morela: MorelaSock, jid: string, imgBuf: Buffer, bodyText: string, fkontak: any, ctx: any): Promise<void> {
  const uploaded = await Morela.sendMessage('867051314767696@bot', { image: imgBuf, caption: '' }) as any
  const imgMsg   = uploaded?.message?.imageMessage

  await Morela.relayMessage(jid, {
    interactiveMessage: {
      header: { hasMediaAttachment: true, imageMessage: imgMsg },
      body:   { text: bodyText },
      footer: { text: `Powered by ${botName} ✨` },
      contextInfo: {
        forwardingScore: 1, isForwarded: true,
        forwardedNewsletterMessageInfo: ctx?.forwardedNewsletterMessageInfo,
        forwardedAiBotMessageInfo: { botName: 'Meta AI', botJid: '13135550002@bot' },
        participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast',
        quotedMessage: fkontak?.message
      },
      nativeFlowMessage: {
        buttons: [
          { name: 'single_select', buttonParamsJson: JSON.stringify({ title: 'PILIH MENU', sections: buildSections_v3() }) },
          { name: 'quick_reply',   buttonParamsJson: JSON.stringify({ display_text: 'Beli Sekarang', id: '.sc' }) },
          { name: 'cta_call',      buttonParamsJson: JSON.stringify({ display_text: 'Telepon Sekarang', phone_number: '+6282184455955' }) },
          { name: 'cta_url',       buttonParamsJson: JSON.stringify({ display_text: 'Owner', url: OWNER_WA, merchant_url: OWNER_WA }) }
        ]
      }
    }
  }, { messageId: Morela.generateMessageTag() })
}

async function sendMenu_v4(Morela: MorelaSock, jid: string, bodyText: string, fkontak: any, ctx: any): Promise<void> {
  await Morela.relayMessage(jid, {
    extendedTextMessage: {
      endCardTiles: [],
      text: `https://github.com/MorelaXz\n\n${bodyText}`,
      matchedText: 'https://github.com/MorelaXz',
      description: 'Morela VVIP - Secure Connection Established',
      title: `${getGreeting()} ✨`,
      previewType: 0,
      jpegThumbnail: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAQAAAAnOwc2AAAADElEQVR4nGNgGG4AAADSAAFQmYCvAAAAAElFTkSuQmCC', 'base64'),
      thumbnailDirectPath: '/o1/v/t24/f2/m269/AQMi78E2ZFHwQDRdDPZ2KAtJRTe8e8WNLDXQVUkzkmkdN0T11j1woMwTcBDz8ZrykhQYUiY2UXA4K0FU0-U5f3kSfS5H9lel7BqVP7mj4A?ccb=9-4&oh=01_Q5Aa4QH0yTM5tf2PC-Xx43VG4-O_fTlCjYh72UICG0VlWpq-HQ&oe=6A0CA254&_nc_sid=e6ed6c',
      thumbnailSha256: '49Ow+9+GIIiMpn1LJNndvJLSRLhtKuGCTrPd5coaCFI=',
      thumbnailEncSha256: 'yxptVo9btlH8sbCBOo0hTMSidKZF9GYIQBBu/2LGKPM=',
      mediaKey: '9I+ccccOt7bKwuDbXhD9Sl5sGZr9A13efRSVguYe0k8=',
      mediaKeyTimestamp: 1776649043,
      thumbnailHeight: 1200,
      thumbnailWidth: 937,
      inviteLinkGroupTypeV2: 0,
      faviconMMSMetadata: {
        thumbnailDirectPath: '/o1/v/t24/f2/m231/AQMWkHj9KfjGaa3_3e6snBz54MSi68TSGCmko1WvJQda_EA-6KfK6HE_ctZLXsFG73DlY9C1Yvcb_P3_SZq7lNS3kzHhywWjYgKitT4NhA?ccb=9-4&oh=01_Q5Aa4QHLsslJDjEjz41hOPMwrDfBUko9D3yuC8GdVds4zl2P1g&oe=6A0CFEFD&_nc_sid=e6ed6c',
        thumbnailSha256: 'v1MS1Rq/oHiQaMDfZnZo+V2R1KLgIDbNA9F48Q5G6MU=',
        thumbnailEncSha256: 'XD3GtO4I637ZMYjkI0y898wkZEcb9r6SNlmiLxeELVI=',
        mediaKey: 'vD1AUzi3/47Es0iQHM2xG9yMtw1XAschVoSPKmXttcU=',
        thumbnailHeight: 32,
        thumbnailWidth: 32
      },
      contextInfo: {
        forwardingScore: 1, isForwarded: true,
        forwardedNewsletterMessageInfo: ctx?.forwardedNewsletterMessageInfo,
        forwardedAiBotMessageInfo: { botName: 'Meta AI', botJid: '13135550002@bot' },
        participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast',
        quotedMessage: fkontak?.message
      }
    }
  }, { messageId: 'MORELA-' + Date.now() })
}

const handler = async (m: any, { Morela, reply, command, isOwn, isPrem, senderJid }: any) => {
  try {
    const style = getMenuStyle(m.chat)

    if (command.startsWith('menu_')) {
      const cat  = command.replace('menu_', '')
      const data = MENU_LISTS[cat]
      if (!data) return reply('❌ Kategori tidak ditemukan')

      if (style === 'v4') {
        const body    = buildCategoryBody(data, true)
        const fkontak = await buildFkontak(Morela)
        const ctx     = buildCtx()
        return sendMenu_v4(Morela, m.chat, body, fkontak, ctx)
      } else if (style === 'v3') {
        const body    = buildCategoryBody(data, false)
        const imgBuf  = getMenuBuf()
        const fkontak = await buildFkontak(Morela)
        const ctx     = buildCtx()
        return sendMenu_v3(Morela, m.chat, imgBuf, body, fkontak, ctx)
      } else if (style === 'v2') {
        const body    = buildCategoryBody(data, true)
        return sendMenu_v2(Morela, m.chat, body)
      } else {
        const body    = buildCategoryBody(data, false)
        const menuBuf = getMenuBuf()
        const fkontak = await buildFkontak_v1()
        return sendMenu_v1(Morela, m.chat, body, menuBuf, fkontak)
      }
    }

    const pushname = String(m.pushName || 'User')
    const ujid     = String(senderJid || m.sender || m.key.remoteJid)

    if (style === 'v4') {
      const body    = buildFullMenuBody(pushname, m.chat, ujid, isOwn, isPrem, true, false)
      const fkontak = await buildFkontak(Morela)
      const ctx     = buildCtx()
      await sendMenu_v4(Morela, m.chat, body, fkontak, ctx)

    } else if (style === 'v3') {
      const body    = buildMenuBody(false)
      const imgBuf  = getMenuBuf()
      const fkontak = await buildFkontak(Morela)
      const ctx     = buildCtx()
      await sendMenu_v3(Morela, m.chat, imgBuf, body, fkontak, ctx)

    } else if (style === 'v2') {

      const body    = buildFullMenuBody(pushname, m.chat, ujid, isOwn, isPrem, true, true, false)
      await sendMenu_v2(Morela, m.chat, body)

    } else {
      const body    = buildFullMenuBody(pushname, m.chat, ujid, isOwn, isPrem, false, true)
      const menuBuf = getMenuBuf()
      const fkontak = await buildFkontak_v1()
      await sendMenu_v1(Morela, m.chat, body, menuBuf, fkontak)
    }

  } catch (e) {
    console.error('[MENU ERROR]', e)
    reply(`❌ Error: ${(e as Error).message}`)
  }
}

handler.help    = ['menu', 'help']
handler.tags    = ['info']
handler.noLimit = true
handler.command = [
  'menu', 'help',
  'menu_ai', 'menu_downloader', 'menu_sticker',
  'menu_maker', 'menu_ephoto', 'menu_tools',
  'menu_game', 'menu_info', 'menu_admin', 'menu_owner', 'menu_nsfw'
]

export default handler
