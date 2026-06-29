import { ButtonV2 } from '../../Library/MessageBuilder.js'

const botName = (globalThis as any).botname || 'Morela'
const KERANG_IMG = 'https://cdn.ornzora.eu.cc/92fb27b5-5ffd-4f5f-905a-9b8d0573a1af-upload-1780208822400.jpg'
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]

async function sendBtn(Morela, chat, {
  title   = 'Kerang Ajaib 🐚',
  body    = '',
  mentions = [],   
  thumb   = KERANG_IMG,  
} = {}) {
  try {
    const btn = new ButtonV2(Morela)
      .setTitle(title)
      .setSubtitle('')
      .setBody(body)
      .setFooter(`© ${botName}`)
      .setContextInfo({ mentionedJid: mentions })

    if (thumb) btn.setThumbnail(thumb)
    btn.addButton('📋 Menu', '.menu')

    const msg = await btn.build(chat, { userJid: Morela.user?.id })
    await Morela.relayMessage(chat, msg.message, { messageId: msg.key.id })
  } catch (e) {

    console.warn('[KERANG] ButtonV2 error, fallback:', e.message)
    await Morela.sendMessage(chat, { text: body, mentions })
  }
}

const handler = async (m, { Morela, text, command, reply }) => {

  let participants = []
  try {
    const meta = await Morela.groupMetadata(m.chat)
    participants = meta.participants || []
  } catch {
    return reply('❌ Gagal ambil data grup.')
  }

  const { getPushName, getPhoneByLid } = await import('../../Database/db.js')

  const botJid = Morela.user?.id || ''
  const botLid = Morela.user?.lid || ''
  const botNum = botJid.split('@')[0].split(':')[0]
  const isBot  = (v) => v === botJid || v === botLid || (botNum && v.startsWith(botNum))

  const getMention = (id) => {
    const isLid  = id.endsWith('@lid')
    const rawNum = id.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')

    let phoneNum = rawNum
    let phoneJid = id

    if (isLid) {
      const resolved = getPhoneByLid(rawNum)
      if (resolved) {
        phoneNum = resolved.replace(/[^0-9]/g, '')
        phoneJid = `${phoneNum}@s.whatsapp.net`
      }
    } else {
      phoneNum = id.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
      phoneJid = `${phoneNum}@s.whatsapp.net`
    }

    const name =
      getPushName(id) ||
      getPushName(rawNum) ||
      (phoneNum !== rawNum ? getPushName(`${phoneNum}@s.whatsapp.net`) : null) ||
      phoneNum

    return { id, phoneJid, phoneNum, display: name }
  }

  const rawMembers = participants.map(u => u.id).filter(v => !isBot(v))

  switch (command) {

    case 'bego': case 'goblok': case 'janda': case 'perawan': case 'babi':
    case 'tolol': case 'pekok': case 'jancok': case 'pinter': case 'pintar':
    case 'asu': case 'bodoh': case 'lesby': case 'bajingan': case 'anjing':
    case 'anjg': case 'anjj': case 'anj': case 'ngentod': case 'ngentot':
    case 'monyet': case 'mastah': case 'newbie': case 'bangsat': case 'bangke':
    case 'sange': case 'sangean': case 'dakjal': case 'horny': case 'wibu':
    case 'puki': case 'puqi': case 'peak': case 'pantex': case 'pantek':
    case 'setan': case 'iblis': case 'cacat': case 'yatim': case 'piatu': {
      if (!rawMembers.length) return reply('❌ Tidak ada member.')
      const { phoneJid, phoneNum } = getMention(pickRandom(rawMembers))
      await sendBtn(Morela, m.chat, {
        title:    'Kerang Ajaib 🐚',
        body:     `Anak ${command} di sini adalah @${phoneNum}`,
        mentions: [phoneJid],
      })
      break
    }

    case 'sangecek': case 'ceksange': case 'gaycek':
    case 'cekgay': case 'lesbicek': case 'ceklesbi': {
      if (!text) return reply(`Penggunaan: .${command} Nama\n\nContoh: .${command} Lisaa`)
      const sangeh = ['5','10','15','20','25','30','35','40','45','50','55','60','65','70','75','80','85','90','95','100']
      reply(`Nama : ${text}\nJawaban : *${pickRandom(sangeh)}%*`)
      break
    }

    case 'kapankah': {
      if (!text) return reply(`Penggunaan: .kapankah Pertanyaan\n\nContoh: .kapankah Saya Mati`)
      const kapan = [
        '5 Hari Lagi','10 Hari Lagi','15 Hari Lagi','20 Hari Lagi','25 Hari Lagi',
        '30 Hari Lagi','35 Hari Lagi','40 Hari Lagi','45 Hari Lagi','50 Hari Lagi',
        '1 Bulan Lagi','2 Bulan Lagi','3 Bulan Lagi','6 Bulan Lagi',
        '1 Tahun Lagi','2 Tahun Lagi','3 Tahun Lagi','5 Tahun Lagi',
        'Besok','Lusa',`Abis Command Ini Juga Lu ${text}`
      ]
      reply(`Pertanyaan : ${text}\nJawaban : *${pickRandom(kapan)}*`)
      break
    }

    case 'siapa': {
      if (!text) return reply(`Penggunaan: .siapa <pertanyaan>\n\nContoh: .siapa yang paling ganteng?`)
      if (!rawMembers.length) return reply('❌ Tidak ada member.')
      const { phoneJid, phoneNum } = getMention(pickRandom(rawMembers))
      await sendBtn(Morela, m.chat, {
        title:    'Kerang Ajaib 🐚',
        body:     `${text}?\nJawabnya adalah @${phoneNum}!`,
        mentions: [phoneJid],
      })
      break
    }

    case 'dimana': {
      if (!text) return reply(`Penggunaan: .dimana <pertanyaan>\n\nContoh: .dimana dia sekarang?`)
      const tempat = [
        'Di Rumah 🏠','Di Warung ☕','Di Mall 🛍️','Di Sekolah 📚','Di Kantor 💼',
        'Di Toilet 🚽','Di Kasur 🛏️','Di Dapur 🍳','Di Surga 😇','Di Neraka 😈',
        'Di Hati Kamu ❤️','Di Tempat Tersembunyi 🕵️','Di Planet Lain 🪐',
        'Entah Kemana 🤷','Di Bawah Bantal 😂'
      ]
      reply(`Pertanyaan: ${text}\nJawaban: *${pickRandom(tempat)}*`)
      break
    }

    case 'bagaimana': {
      if (!text) return reply(`Penggunaan: .bagaimana <pertanyaan>\n\nContoh: .bagaimana cara sukses?`)
      const cara = [
        'Dengan Sabar 🙏','Dengan Uang 💸','Dengan Doa 🤲','Dengan Usaha Keras 💪',
        'Dengan Nangis Dulu 😭','Dengan Tidur Aja 😴','Nggak Akan Bisa 💀',
        'Gampang Banget Kok 😎','Tanya Google Aja 🔍','Tanya Mama Lu 👩',
        'Minta Tolong Tetangga 🏘️','Beli Aja Di Shopee 🛒'
      ]
      reply(`Pertanyaan: ${text}\nJawaban: *${pickRandom(cara)}*`)
      break
    }

    case 'sulap': {
      if (!rawMembers.length) return reply('❌ Tidak ada member.')
      const { id: orgId, phoneJid: orgJid, phoneNum: orgNum } = getMention(pickRandom(rawMembers))
      await sendBtn(Morela, m.chat, {
        title:    '✨ Sulap Bot',
        body:     `🪄 Sim Salabim!\nYang Menghilang Adalah @${orgNum}! ✨`,
        mentions: [orgJid],
      })
      break
    }

    case 'top5': {
      if (rawMembers.length < 5) return reply('❌ Member kurang dari 5.')
      const shuffled = [...rawMembers].sort(() => 0.5 - Math.random()).slice(0, 5).map(getMention)
      const list     = shuffled.map((v, i) => `${i + 1}. @${v.phoneNum}`).join('\n')
      await sendBtn(Morela, m.chat, {
        title:    '🏆 Top 5 Pilihan Bot',
        body:     `🏆 Top 5 Member Pilihan Bot:\n\n${list}`,
        mentions: shuffled.map(v => v.phoneJid),
      })
      break
    }

    case 'bucin': {
      if (!rawMembers.length) return reply('❌ Tidak ada member.')
      const { id: orgId, phoneJid: orgJid, phoneNum: orgNum } = getMention(pickRandom(rawMembers))
      await sendBtn(Morela, m.chat, {
        title:    '💘 Bucin Detector',
        body:     `💘 Bucin paling parah di sini adalah @${orgNum}!\nSanggup ngorbanin segalanya demi doi 😭`,
        mentions: [orgJid],
      })
      break
    }

    case 'cekhodam': case 'khodam': {
      if (!text) return reply(`Penggunaan: .cekhodam <nama>\n\nContoh: .cekhodam Budi`)
      const hodam = [
        'Macan Putih 🐯','Ular Naga 🐉','Harimau Hitam 🐅','Buaya Putih 🐊',
        'Elang Sakti 🦅','Kuda Hitam 🐴','Kera Sakti 🐒','Singa Gaib 🦁',
        'Tidak Punya Khodam 💀','Khodam Kucing Garong 🐱','Jin Tomang 👻',
        'Khodam Tuyul 👶','Wewe Gombel 👩','Pocong VIP 👻','Genderuwo Jadul 🧌',
        'Khodam Batu Bata 🧱','Nyi Roro Kidul 🌊','Khodam Mie Ayam 🍜'
      ]
      reply(`Nama: *${text}*\nKhodam: *${pickRandom(hodam)}*\n\n_Hasil bersifat hiburan semata_ 😄`)
      break
    }

    case 'cp': case 'couple': {
      if (rawMembers.length < 2) return reply('❌ Member kurang dari 2.')
      const { id: orangId, phoneJid: orangJid, phoneNum: orangNum } = getMention(pickRandom(rawMembers))
      const { phoneJid: jodohJid, phoneNum: jodohNum }              = getMention(pickRandom(rawMembers.filter(v => v !== orangId)))
      await sendBtn(Morela, m.chat, {
        title:    '💞 Ship Alert!',
        body:     `@${orangNum} ❤️ @${jodohNum}\nCieeee, What's Going On❤️💖👀`,
        mentions: [orangJid, jodohJid],
      })
      break
    }

    case 'gay': {
      if (!rawMembers.length) return reply('❌ Tidak ada member.')
      const { id: orangId, phoneJid: orangJid, phoneNum: orangNum } = getMention(pickRandom(rawMembers))
      await sendBtn(Morela, m.chat, {
        title:    '🌈 Gay Detector',
        body:     `*@${orangNum} Adalah Orang Paling Gay Di Group Ini*`,
        mentions: [orangJid],
      })
      break
    }

    case 'jodoh': case 'jodohku': {
      if (rawMembers.length < 2) return reply('❌ Member kurang dari 2.')
      const meM                                        = getMention(m.sender)
      const { phoneJid: jodohJid, phoneNum: jodohNum } = getMention(pickRandom(rawMembers.filter(v => v !== m.sender)))
      await sendBtn(Morela, m.chat, {
        title:    '💕 Jodoh Detector',
        body:     `jodoh @${meM.phoneNum} adalah @${jodohNum}`,
        mentions: [meM.phoneJid, jodohJid],
      })
      break
    }

  }
}

handler.command = [
  'bego', 'goblok', 'janda', 'perawan', 'babi', 'tolol', 'pekok', 'jancok',
  'pinter', 'pintar', 'asu', 'bodoh', 'lesby', 'bajingan', 'anjing',
  'anjg', 'anjj', 'anj', 'ngentod', 'ngentot', 'monyet', 'mastah', 'newbie',
  'bangsat', 'bangke', 'sange', 'sangean', 'dakjal', 'horny', 'wibu', 'puki',
  'puqi', 'peak', 'pantex', 'pantek', 'setan', 'iblis', 'cacat', 'yatim', 'piatu',
  'sangecek', 'ceksange', 'gaycek', 'cekgay', 'lesbicek', 'ceklesbi',
  'kapankah',
  'siapa', 'dimana', 'bagaimana',
  'sulap', 'top5', 'bucin',
  'cekhodam', 'khodam',
  'cp', 'couple', 'gay',
  'jodoh', 'jodohku'
]

handler.tags    = ['fun']
handler.help    = [
  'kapankah <tanya>', 'siapa <tanya>', 'dimana <tanya>', 'bagaimana <tanya>',
  'jodoh', 'couple', 'cekgay <nama>', 'wibu',
  'sulap', 'top5', 'bucin', 'cekhodam <nama>'
]
handler.group   = true
handler.noLimit = false

export default handler
