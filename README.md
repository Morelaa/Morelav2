<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=26&pause=1000&color=A855F7&center=true&vCenter=true&width=500&lines=Morela+v2+%E2%9C%A8;WhatsApp+Bot+TypeScript;Hot-Reload+%C2%B7+AIRich+%C2%B7+Multi-Device" />

<br/>

![visitors](https://api.visitorbadge.io/api/VisitorHit?user=Morelaa&repo=Morelav2&countColor=%23A855F7)
![stars](https://img.shields.io/github/stars/Morelaa/Morelav2?style=flat&color=A855F7&labelColor=0d1117)
![forks](https://img.shields.io/github/forks/Morelaa/Morelav2?style=flat&color=A855F7&labelColor=0d1117)
![Node](https://img.shields.io/badge/Node.js-≥18-339933?style=flat&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-A855F7?style=flat)

<img src="https://capsule-render.vercel.app/api?type=waving&color=A855F7&height=120&section=header&text=Morela%20v2&fontSize=38&fontColor=ffffff&animation=fadeIn" />

<img src="media/menu.jpg" width="480" style="border-radius:12px" />

</div>

**WhatsApp Bot** berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) yang ditulis TypeScript. Plugin system modular, hot-reload tanpa restart, dan support format pesan AIRich native WhatsApp.

## Instalasi

```bash
git clone https://github.com/Morelaa/Morelav2.git
cd Morelav2
npm install
npm start
```

Pertama kali jalan bot akan minta nomor HP → masukkan nomor WA bot → scan pairing code di WA.

## Fitur Unggulan

### AIRich
Format pesan kaya ala WhatsApp AI — bukan plain text biasa.

```typescript
import { AIRich } from '../Library/MessageBuilder.js'

const msg = new AIRich(Morela)
msg.addText('Halo! Ini hasil AI kamu:')
msg.addCode('javascript', 'console.log("Hello World")')
msg.addTable([['Nama', 'Nilai'], ['Akurasi', '98%']])
msg.addImage('https://example.com/result.jpg')
msg.addSuggest(['Ulangi', 'Simpan hasil', 'Bagikan'])
await msg.send(m.chat, { quoted: fkontak })
```

| Method | Fungsi |
|---|---|
| `.addText(text)` | Teks dengan hyperlink, citation, LaTeX otomatis |
| `.addCode(lang, code)` | Code block dengan syntax highlight |
| `.addTable(data)` | Tabel dari 2D array |
| `.addImage(url)` | Gambar inline |
| `.addProduct(data)` | Product card carousel |
| `.addSuggest(chips)` | Suggestion chips / quick reply |

### Hot-Reload Plugin
Edit dan reload plugin tanpa restart bot, tanpa disconnect WA.

```
.plugin tools/myplugin   → tulis plugin baru dari chat
.getplugin menu          → baca source code plugin
.reloadplugin menu       → reload plugin (~300ms)
.delplugin tools/old     → hapus plugin
```

### Live Server Control
```
.healthcheck   → cek status semua API endpoint
.cekdb users   → inspeksi database langsung dari chat
.backupdb      → backup data/ ke ZIP
.clearcache    → bersihkan temp files
.pushgit       → push bot ke GitHub (auto sensor data sensitif)
```

## Struktur File

```
Morelav2/
├── launcher.ts                    # supervisor proses — spawn utama.ts, auto-restart bersih kalau exit code 69
├── utama.ts                       # entry point WA, koneksi Baileys
├── Morela.ts                      # message router & handler utama (WA)
├── tgbot.ts                       # entry point bot Telegram (start/stop, dipanggil dari utama.ts)
├── config.ts                      # prefix, owner, api keys, token
├── tsconfig.json                  # konfigurasi TypeScript
├── RESOLVENAMEGUIDE.MD             # panduan resolve nama/LID WhatsApp
│
├── Core/
│   ├── cache.ts                  # caching system
│   ├── events.ts                 # event emitter (messages, groups, dll — bukan koneksi)
│   ├── logutil.ts                # log utilities (writeLog, patchConsoleError)
│   ├── permissions.ts            # permission checker
│   ├── sewa.ts                   # sewa grup core
│   ├── sockext.ts                # socket extension
│   └── store.ts                  # in-memory store
│
├── types/
│   ├── global.d.ts                # deklarasi tipe global (ExtSocket, dll)
│   ├── modules.d.ts                # deklarasi modul tanpa tipe bawaan
│   └── node-globals.d.ts           # deklarasi global Node.js tambahan
│
├── System/
│   ├── logger.ts                 # logger
│   ├── mainowner.ts              # identitas main owner
│   ├── message.ts                # preprocessing pesan
│   ├── privatemode.ts            # toggle private mode
│   └── selfmode.ts               # toggle self mode
│
├── Library/
│   ├── MessageBuilder.ts         # AIRich, Button, Carousel builder
│   ├── utils.ts                  # utilities & constants
│   ├── antiabuse.ts              # rate limiter
│   ├── handle.ts                 # message handler helper
│   ├── resolve.ts                # media resolver
│   ├── sticker.ts                # sticker helper
│   ├── stickerPackHelper.ts      # sticker pack helper
│   ├── meme.ts                   # meme generator
│   ├── messagequeue.ts           # message queue
│   ├── system.ts                 # system utilities
│   ├── tg_global.ts              # telegram global helper
│   ├── jadibotdb.ts              # jadibot database
│   ├── canvas-quran.ts           # canvas quran renderer
│   ├── canvas-rpg.ts             # canvas RPG renderer
│   ├── canvas-soundcloud.ts      # canvas soundcloud card
│   ├── canvas-spotify.ts         # canvas spotify card
│   └── canvas-yts.ts             # canvas youtube search card
│
├── Database/
│   ├── sqlite.ts                 # SQLite connection & schema
│   ├── db.ts                     # users, groups, lidmap
│   ├── usagelimit.ts             # limit harian
│   ├── sewagrub.ts               # manajemen sewa grup
│   ├── kvstore.ts                # key-value store
│   ├── chatcount.ts              # chat counter
│   └── stats.ts                  # statistik bot
│
├── Plugins-tgbot/                 # bot Telegram terpisah (jalan bareng WA di proses yang sama)
│   ├── _pluginmanager.ts          # plugin lifecycle khusus tgbot
│   │
│   ├── core/
│   │   ├── api.ts                # wrapper Telegram Bot API (sendMsg, sendPhoto, dll)
│   │   ├── helpers.ts             # helper (pending photo, format uptime/bytes, dll)
│   │   └── types.ts               # tipe TgPlugin
│   │
│   ├── menu/
│   │   ├── menu.ts                # /menu — daftar command
│   │   └── start.ts               # /start — welcome + tombol
│   │
│   ├── image/                     # kirim foto → proses via tombol
│   │   ├── aiedit.ts              # /aiedit <prompt> — edit foto pakai AI
│   │   ├── hd.ts / hdv1.ts / hdv2.ts  # upscale/Super HD (3 engine berbeda)
│   │   ├── removebg.ts            # hapus background
│   │   └── removewm.ts            # hapus watermark
│   │
│   ├── downloader/
│   │   ├── ig.ts                  # /ig /instagram — download Instagram
│   │   └── tiktok.ts              # /tiktok /tt — download TikTok
│   │
│   └── owner/                     # command khusus owner
│       ├── broadcast.ts
│       ├── clearcache.ts
│       ├── exec.ts                # /exec /eval /shell — eksekusi kode/perintah
│       ├── listbot.ts
│       ├── off.ts / on.ts
│       ├── resetlink.ts
│       ├── restart.ts             # restart bot WA (exit code 69 → launcher.ts)
│       ├── status.ts
│       └── stopbot.ts
│
├── Plugins-ESM/                    # plugin bot WhatsApp
│   ├── _pluginmanager.ts         # core plugin lifecycle
│   │
│   ├── admin/                    # manajemen grup
│   │   ├── anticatalog.ts / anticatalog-cmd.ts
│   │   ├── antigrup.ts / antigrup-cmd.ts
│   │   ├── antilink.ts / antilink-cmd.ts
│   │   ├── antiswgc-cmd.ts / antiswgc-pasive.ts
│   │   ├── antivirtex.ts / antivirtex-cmd.ts
│   │   ├── ban.ts
│   │   ├── goodbye.ts
│   │   ├── hidetag.ts
│   │   ├── htprem.ts
│   │   ├── infogc.ts
│   │   ├── mute.ts / mute-pasive.ts
│   │   ├── openclose.ts / openclose-schedule.ts
│   │   ├── promote.ts
│   │   ├── reactionkick.ts
│   │   ├── resetlink.ts
│   │   ├── votekick.ts
│   │   └── welcome.ts
│   │
│   ├── ai/                       # AI & image generation
│   │   ├── aiagent.ts / aiagent-pasive.ts
│   │   ├── aiedit.ts
│   │   ├── autoai.ts / autoai-pasive.ts
│   │   ├── autoai2.ts / autoai2-pasive.ts
│   │   ├── deepai.ts
│   │   ├── genmart.ts
│   │   ├── image.ts
│   │   ├── img.ts / img2img.ts
│   │   ├── mathgpt.ts
│   │   ├── to-ai.ts
│   │   └── zai.ts
│   │
│   ├── downloader/               # downloader media
│   │   ├── alldownload.ts
│   │   ├── fb.ts
│   │   ├── ig.ts
│   │   ├── mediafire.ts
│   │   ├── pin.ts / pinvid.ts
│   │   ├── play.ts
│   │   ├── ptv.ts
│   │   ├── soundcloud.ts
│   │   ├── spotify.ts
│   │   ├── tiktok.ts / tiktok-pasive.ts / tiktokslide.ts / tt2.ts
│   │   ├── webtoon.ts
│   │   └── ytmp3.ts / ytmp4.ts / yts.ts
│   │
│   ├── games/                    # games interaktif
│   │   ├── asahotak.ts / asahotak_cek.ts
│   │   ├── buildml.ts
│   │   ├── chess.ts
│   │   ├── family100.ts / family100_cek.ts
│   │   ├── guildwar.ts
│   │   ├── kerangajaib.ts
│   │   ├── mining.ts / listmining.ts
│   │   ├── quote.ts
│   │   ├── rpg-profil.ts
│   │   ├── susunkata.ts / susunkata_cek.ts
│   │   ├── tebakbendera.ts / tebakbendera_cek.ts
│   │   ├── tebakgambar.ts / tebakgambar_cek.ts
│   │   ├── tebakkata.ts / tebakkata_cek.ts
│   │   ├── tebakkimia.ts / tebakkimia_cek.ts
│   │   ├── tebaksurah.ts / tebaksurah_cek.ts
│   │   └── truthordare.ts
│   │
│   ├── info/                     # informasi
│   │   ├── artinama.ts
│   │   ├── jadwalbola.ts
│   │   ├── listsewa.ts
│   │   ├── menu.ts
│   │   ├── mpl.ts
│   │   ├── quran.ts
│   │   ├── tm.ts
│   │   └── totalfitur.ts
│   │
│   ├── maker/                    # maker & card generator
│   │   ├── carbon.ts
│   │   ├── discord.ts
│   │   ├── ephoto.ts
│   │   ├── fakedev.ts
│   │   ├── fakeff.ts / fakeffduo.ts
│   │   ├── fakeml.ts
│   │   ├── fakestory.ts
│   │   ├── faketweet.ts
│   │   ├── flaming.ts
│   │   ├── iqc.ts
│   │   ├── musikcard.ts
│   │   └── toimg.ts
│   │
│   ├── owner/                    # devops & admin tools
│   │   ├── addpkg.ts
│   │   ├── airich.ts
│   │   ├── backup-panel.ts
│   │   ├── backupdb.ts
│   │   ├── casetools.ts
│   │   ├── cekdb.ts
│   │   ├── ceklimit.ts
│   │   ├── clearcache.ts
│   │   ├── crm.ts
│   │   ├── deletesmg.ts
│   │   ├── delplugin.ts / getplugin.ts / listplugin.ts / reloadplugin.ts / saveplugin.ts
│   │   ├── disable.ts
│   │   ├── get.ts
│   │   ├── healthcheck.ts
│   │   ├── jadibot.ts / listbot.ts
│   │   ├── nsfw.ts
│   │   ├── owner.ts / ownergreet-pasive.ts
│   │   ├── pay.ts
│   │   ├── plugin.ts
│   │   ├── premium.ts
│   │   ├── privatemode.ts / selfmode.ts
│   │   ├── pushgit.ts            # push bot ke GitHub
│   │   ├── remgrup.ts
│   │   ├── resetdb.ts
│   │   ├── sc.ts
│   │   ├── setmenu.ts
│   │   ├── setownertype.ts
│   │   ├── setpp.ts / setppwa.ts
│   │   ├── sewagrub.ts
│   │   ├── stats.ts
│   │   ├── stopbot.ts
│   │   ├── swgc.ts
│   │   ├── tgbotset.ts
│   │   └── topchat.ts / topchat-cmd.ts
│   │
│   ├── sticker/                  # sticker & brat
│   │   ├── attp.ts / ttp.ts
│   │   ├── brat.ts / bratgura.ts / bratoriginal.ts / bratruromiya.ts
│   │   ├── bratspongebob.ts / brattren.ts / bratvid.ts
│   │   ├── emoji.ts / emojimix.ts
│   │   ├── qc.ts
│   │   ├── smeme.ts
│   │   ├── stickergen.ts / stickerpack.ts
│   │   ├── stiker.ts / stikerbrat.ts / stikerline.ts
│   │   └── telestiker.ts
│   │
│   └── tools/                    # utilities
│       ├── Ouo.ts
│       ├── bratv2.ts
│       ├── bypass.ts
│       ├── didyoumen.ts
│       ├── getpp.ts / getppgrub.ts
│       ├── hd.ts / hdv1.ts / hdv2.ts / hdvid.ts
│       ├── inspect.ts
│       ├── jadwal.ts
│       ├── mathgpt.ts
│       ├── ocr.ts
│       ├── ping.ts
│       ├── q.ts / qwa.ts
│       ├── rch.ts
│       ├── register.ts / register-pasive.ts
│       ├── removebg.ts / removewm.ts
│       ├── report.ts
│       ├── rvo.ts / rvo2.ts / rvoset.ts / rvoreset.ts
│       ├── skiplink.ts
│       ├── stikercmd.ts / stikertiger.ts
│       ├── tempmail-enhanced.ts
│       ├── test.ts
│       ├── to4k.ts
│       ├── tomp3.ts / tovideo.ts / tovidio.ts
│       ├── topchat-pasive.ts
│       ├── tourl.ts
│       ├── translate.ts
│       ├── tri.ts
│       ├── userinfo.ts
│       └── whois.ts
│
└── data/
    ├── morela.db                 # SQLite database utama
    ├── font/                     # font buat canvas renderer (quran, rpg, dll)
    │   ├── Poppins-Bold.ttf
    │   ├── Poppins-Light.ttf
    │   ├── Poppins-Medium.ttf
    │   └── Poppins-Regular.ttf
    ├── asahotak.json
    ├── family100.json
    ├── susunkata.json
    ├── tebakbendera.json
    ├── tebakgambar.json
    ├── tebakkata.json
    ├── tebakkimia.json
    └── tebaksurah.json
```

## Cara Jalankan

Morela sekarang punya **supervisor sendiri** (`launcher.ts`) — jadi **nggak butuh PM2 lagi**. `npm start` otomatis jalan lewat launcher, yang bakal auto-restart proses bot dari nol kalau ada restart yang disengaja (misal command `.restart` atau abis logout & perlu pairing ulang).

```bash
npm start
```

Itu aja. Launcher yang pegang kendali proses `utama.ts` di baliknya — nggak perlu setup process manager tambahan buat basic auto-restart.

**Kalau mau jalanin langsung tanpa supervisor** (misal lagi debug cepat di lokal, dan gak butuh auto-restart):

```bash
npm run start:direct
```

**Kalau tetap mau ada lapisan proteksi ekstra di panel/VPS** (misal biar bot auto-nyala lagi kalau server reboot, bukan cuma auto-restart internal), tinggal suruh process manager pilihan kamu (systemd, atau apapun yang disediakan panel-nya) manggil:

```bash
npm start
```
sebagai startup command-nya — **bukan** `npm run dev` atau langsung `tsx utama.ts` lagi, karena itu bakal skip lapisan launcher-nya.

## Buat Plugin Baru

```typescript
// Plugins-ESM/tools/contoh.ts

const handler = async (m: any, { reply, args }: any) => {
  reply(`Halo ${m.pushName}! Args: ${args.join(', ')}`)
}

handler.command = ['contoh', 'test']
handler.tags    = ['tools']
handler.help    = ['contoh <teks>']

export default handler
```

Simpan file → bot auto-detect dan load tanpa restart.

## Konfigurasi

```typescript
// config.ts
global.mainOwner    = '628xxxxxxxxxx'
global.prefa        = ['', '.', '!', ',']
global.prefix       = '.'
global.thumbnailUrl = 'https://...'
global.tokengh      = 'github_token_kamu'

global.tgBot = {
  token:   'telegram_bot_token',
  ownerId: 'telegram_chat_id'
}
```

## Stats

<div align="center">

[![stats](https://github-readme-stats.vercel.app/api?username=Morelaa&show_icons=true&theme=tokyonight&title_color=A855F7&icon_color=A855F7&border_color=A855F7&bg_color=0d1117&hide_border=false)](https://github.com/Morelaa)

[![langs](https://github-readme-stats.vercel.app/api/top-langs/?username=Morelaa&layout=compact&theme=tokyonight&title_color=A855F7&border_color=A855F7&bg_color=0d1117)](https://github.com/Morelaa)

[![streak](https://streak-stats.demolab.com?user=Morelaa&theme=tokyonight&ring=A855F7&fire=A855F7&currStreakLabel=A855F7&border=A855F7)](https://github.com/Morelaa)

</div>

## Kontak

<div align="center">

[![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/628999889149)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Morelaa)

</div>

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=A855F7&height=100&section=footer" />

© 2025 Morela · MIT License · by putraa
</div>
