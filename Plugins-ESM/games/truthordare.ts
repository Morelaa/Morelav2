const TRUTHS = [
  "Pernah nggak pura-pura cuek padahal sebenarnya kamu sayang banget sama dia? Ceritain dikit alasannya.",
  "Siapa orang yang paling sering kepikiran sebelum tidur akhir-akhir ini? Jawab dengan jujur tanpa inisial.",
  "Kalau disuruh jujur, kamu sekarang lagi suka sama siapa? (boleh sebut nama atau ciri-cirinya).",
  "Pernah nangis diam-diam karena seseorang? Kalau pernah, siapa dan kenapa waktu itu?",
  "Apa hal paling bucin yang pernah kamu lakukan buat seseorang tanpa dia tahu?",
  "Kalau dia lagi offline lama, apa yang biasanya kamu pikirkan? Cemburu, overthinking, atau biasa aja?",
  "Pernah nggak kepikiran buat ninggalin dia, tapi ujung-ujungnya tetap stay karena nggak sanggup?",
  "Kalimat apa yang paling pengen kamu ucapin ke orang yang kamu suka, tapi belum pernah kamu kirim?",
  "Pilih jujur: kamu lebih sering chatting duluan atau nunggu dia chat duluan? Kenapa?",
  "Pernah stalking WhatsApp/story dia sampai berulang-ulang? Ceritain kapan terakhir kali.",
  "Kalau sekarang dikasih kesempatan call dia 10 menit, hal pertama yang ingin kamu bicarakan apa?",
  "Apa ketakutan terbesar kamu soal hubungan/bucin?",
  "Siapa orang yang dulu kamu sia-siakan dan sekarang diam-diam kamu rindukan?",
  "Pernah nggak pura-pura kuat di chat, padahal habis baca chat dia kamu langsung down?",
  "Kalau dia baca semua isi hati kamu sekarang, kira-kira dia bakal tetap tinggal atau pergi?"
]

const DARES = [
  'Chat orang yang lagi kamu suka sekarang dan kirim kalimat: "aku lagi kangen kamu, tau nggak?"',
  'Ganti nama profil WhatsApp kamu selama 10 menit jadi: "Budak Cintanya Seseorang".',
  'Kirim voice note 10 detik ke orang yang kamu kepikiran sekarang, isinya cuma: "aku kangen".',
  "Kirim emot hati ke orang yang bikin kamu overthinking akhir-akhir ini, tanpa kata-kata lain.",
  'Chat dia dan tanya: "Menurut kamu aku itu orangnya gimana?" lalu tunggu jawabannya.',
  'Kirim chat ke dia: "Jujur, kalau aku tiba-tiba ngilang kamu bakal nyariin nggak?".',
  'Ganti status WhatsApp kamu jadi: "lagi sayang banget sama seseorang tapi dia nggak sadar" selama 15 menit.',
  'Kirim chat ke sahabat terdekat kamu: "Menurut kamu aku cocoknya sama siapa sih?".',
  'Chat orang yang pernah kamu suka dan bilang: "makasih ya, pernah jadi alasan aku senyum tiap hari".',
  "Kirim stiker/emoji paling bucin yang kamu punya ke chat terakhir (selain keluarga).",
  'Kirim kalimat ini ke dia: "Kalau suatu saat aku hilang, kamu bakal nyari aku atau biasa aja?".',
  "Mute semua chat kecuali orang yang kamu paling tunggu chat-nya, selama 30 menit.",
  "Balas salah satu chat lama dia yang belum sempat kamu balas, seolah kamu baru baca sekarang.",
  'Kirim chat ke dia: "Random sih, tapi aku bersyukur pernah kenal kamu." tanpa emoji.',
  'Kirim chat ke dia: "Jangan pergi dulu dari hidup aku, belum siap kehilangan kamu.".'
]

const pick = arr => arr[Math.floor(Math.random() * arr.length)]

const handler = async (m: any, { command, reply, fkontak }: any) => {
  const name = m.pushName || "Player"

  if (command === "truthordare") {
    return reply(
`╭─❖ 〔 ᴛʀᴜᴛʜ ᴏʀ ᴅᴀʀᴇ 〕
│ Halo, *${name}*
│ Pilih mau jujur atau tantangan
╰───────────────────────❏

╭─❖ Pilihan:
│ • .truth
│ • .dare
╰───────────────────────❏`
    )
  }

  if (command === "truth") {
    return reply(
`╭─❖ 〔 ᴛʀᴜᴛʜ 〕
│ Hai, *${name}*
│ Jawab sejujur-jujurnya ya
╰───────────────────────❏

${pick(TRUTHS)}`
    )
  }

  if (command === "dare") {
    return reply(
`╭─❖ 〔 ᴅᴀʀᴇ 〕
│ Hai, *${name}*
│ Berani jalani tantangan ini?
╰───────────────────────❏

${pick(DARES)}`
    )
  }
}

handler.command = ["truthordare", "truth", "dare"]
handler.tags = ["game", "fun"]
handler.help = [
  "truthordare",
  "truth",
  "dare"
]

export default handler
