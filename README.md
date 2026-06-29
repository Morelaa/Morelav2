<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=26&pause=1000&color=A855F7&center=true&vCenter=true&width=500&lines=Morela+v2+%E2%9C%A8;WhatsApp+Bot+TypeScript;Hot-Reload+%C2%B7+AIRich+%C2%B7+Multi-Device" />

<br/>

![visitors](https://api.visitorbadge.io/api/VisitorHit?user=MorelaXz&repo=Morela-v2&countColor=%23A855F7)
![stars](https://img.shields.io/github/stars/MorelaXz/Morela-v2?style=flat&color=A855F7&labelColor=0d1117)
![forks](https://img.shields.io/github/forks/MorelaXz/Morela-v2?style=flat&color=A855F7&labelColor=0d1117)
![Node](https://img.shields.io/badge/Node.js-≥18-339933?style=flat&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-A855F7?style=flat)

<img src="https://capsule-render.vercel.app/api?type=waving&color=A855F7&height=120&section=header&text=Morela%20v2&fontSize=38&fontColor=ffffff&animation=fadeIn" />

<img src="media/menu.jpg" width="480" style="border-radius:12px" />

</div>

**WhatsApp Bot** berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) yang ditulis TypeScript. Plugin system modular, hot-reload tanpa restart, dan support format pesan AIRich native WhatsApp.

## Instalasi

```bash
git clone https://github.com/MorelaXz/Morela-v2.git
cd Morela-v2
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
```

## Struktur File

```
Morela-v2/
├── utama.ts                  # entry point, koneksi WA
├── Morela.ts                 # message router & handler utama
├── config.ts                 # prefix, owner, thumbnail
├── System/
│   ├── message.ts            # preprocessing pesan
│   ├── mainowner.ts          # identitas main owner
│   ├── privatemode.ts        # toggle private mode
│   └── selfmode.ts           # toggle self mode
├── Library/
│   ├── MessageBuilder.ts     # AIRich, Button, Carousel builder
│   ├── utils.ts              # utilities & constants
│   └── antiabuse.ts          # rate limiter
├── Database/
│   ├── db.ts                 # users, groups, lidmap
│   ├── usagelimit.ts         # limit harian
│   └── sewagrub.ts           # manajemen sewa grup
├── Plugins-ESM/
│   ├── _pluginmanager.ts     # core plugin lifecycle
│   ├── admin/                # manajemen grup
│   ├── ai/                   # AI & image generation
│   ├── downloader/           # YouTube, TikTok, IG, dll
│   ├── games/                # games interaktif
│   ├── info/                 # menu, jadwal, info
│   ├── maker/                # fake chat, card, canvas
│   ├── owner/                # devops & admin tools
│   └── tools/                # utilities
└── data/
    ├── mainowner.json
    ├── Own.json
    ├── users.json
    ├── lidmap.json
    └── disabled_plugins.json
```

## Cara Jalankan

**Panel biasa (Pterodactyl / deline.cloud)**

```
npm start
```

**Panel PM2 Egg**

```bash
npm run dev      # startup command di panel

pm2 save         # jalankan sekali di console setelah pertama start
pm2 logs morela-dev
pm2 restart morela-dev
pm2 stop morela-dev
```

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
```

```json
// data/mainowner.json
["628xxxxxxxxxx"]

// data/Own.json
["628xxxxxxxxxx", "628yyyyyyyyy"]
```

## Stats

<div align="center">

[![stats](https://github-readme-stats.vercel.app/api?username=MorelaXz&show_icons=true&theme=tokyonight&title_color=A855F7&icon_color=A855F7&border_color=A855F7&bg_color=0d1117&hide_border=false)](https://github.com/MorelaXz)

[![langs](https://github-readme-stats.vercel.app/api/top-langs/?username=MorelaXz&layout=compact&theme=tokyonight&title_color=A855F7&border_color=A855F7&bg_color=0d1117)](https://github.com/MorelaXz)

[![streak](https://streak-stats.demolab.com?user=MorelaXz&theme=tokyonight&ring=A855F7&fire=A855F7&currStreakLabel=A855F7&border=A855F7)](https://github.com/MorelaXz)

</div>

## Kontak

<div align="center">

[![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/628999889149)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/MorelaXz)

</div>

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=A855F7&height=100&section=footer" />

© 2025 Morela · MIT License · by putraa
</div>
