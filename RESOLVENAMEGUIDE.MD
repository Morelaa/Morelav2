# ResolveName & MentionName Guide

## Dua Mekanisme Berbeda

**Mention hijau** — bot kirim `@628xxx` + `mentionedJid`. WA di HP penerima yang render jadi nama hijau dari kontak mereka sendiri.

**Resolve nama** — bot cari nama dari database lalu tulis sebagai plain text. Hasilnya sama untuk semua orang yang lihat.

---

## Mention Hijau

```ts
await Morela.sendMessage(chat, {
  text: `Halo @${phoneNum} 👋`,
  mentions: [phoneJid]
})
```

Syarat wajib: `mentions` harus berisi `@s.whatsapp.net`, bukan `@lid`. Kalau `@lid` masuk ke `mentions`, mention tidak akan jadi hijau.

Kalau target JID adalah `@lid`, convert dulu:

```ts
const mentionJid = targetP.id.endsWith('@lid')
  ? (getPhoneByLid(targetP.id.split('@')[0])?.replace(/[^0-9]/g, '') + '@s.whatsapp.net') || targetP.id
  : targetP.id
```

---

## Normalisasi JID

Selalu normalisasi sebelum compare supaya LID dan phone bisa dibandingkan:

```ts
const num = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
```

---

## Resolve LID ke Phone

```ts
const phone = getPhoneByLid(lidNumber)   // '628xxx' atau null
const lid   = getLidByPhone(phoneNumber) // '151xxx@lid' atau null
```

Database auto-update tiap pesan masuk via Morela.ts.

---

## Cari Participant dari Input User

Masalah paling umum: `mentionedJid[0]` bisa return `@lid`. Jangan normalize dulu sebelum cari participant, karena normalisasi akan merusak LID jadi angka sampah.

```ts
// SALAH — jangan normalize mentionedJid dulu
const target = normNum(m.mentionedJid[0]) + '@s.whatsapp.net'

// BENAR — biarkan as-is, serahkan ke findParticipant
const rawTarget = m.mentionedJid[0]
```

Fungsi cari participant yang benar, dengan urutan fallback:

```ts
function findParticipant(participants: any[], rawTarget: string): any | null {
  // 1. Exact match p.id
  let found = participants.find(p => p.id === rawTarget)
  if (found) return found

  if (rawTarget.endsWith('@lid')) {
    const lidNum = rawTarget.split('@')[0]

    // 2. Match via p.lid atau p.id yang juga @lid
    found = participants.find(p => {
      if (p.lid && p.lid.split(':')[0].split('@')[0] === lidNum) return true
      if (p.id?.endsWith('@lid') && p.id.split(':')[0].split('@')[0] === lidNum) return true
      return false
    })
    if (found) return found

    // 3. Lookup via getPhoneByLid lalu match nomor
    const phone = getPhoneByLid(lidNum)
    if (phone) {
      const phoneClean = phone.replace(/[^0-9]/g, '')
      found = participants.find(p => {
        const pNum = p.id.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
        return pNum === phoneClean && pNum.length > 4
      })
      if (found) return found
    }
  } else {
    // 4. Normalisasi phone num biasa + cek LID fallback
    const targetNum = rawTarget.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
    found = participants.find(p => {
      const pNum = p.id.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
      if (pNum === targetNum && pNum.length > 4) return true
      if (p.id.endsWith('@lid')) {
        const resolved = getPhoneByLid(p.id.split('@')[0])
        if (resolved?.replace(/[^0-9]/g, '') === targetNum) return true
      }
      return false
    })
    if (found) return found
  }

  return null
}
```

---

## Kick Participant

Pakai `targetP.id` asli dari metadata, bukan JID yang di-construct sendiri. Kalau di-construct sendiri dan participant masuk sebagai `@lid`, kick akan silent fail tanpa error.

```ts
// SALAH — construct sendiri, silent fail kalau participant @lid di grup
await Morela.groupParticipantsUpdate(groupJid, ['628xxx@s.whatsapp.net'], 'remove')

// BENAR — pakai p.id asli dari hasil findParticipant
const targetP = findParticipant(participants, rawTarget)
await Morela.groupParticipantsUpdate(groupJid, [targetP.id], 'remove')
```

---

## Cek Bot Admin

Jangan compute manual. `botAdmin` sudah tersedia dari context handler, sudah LID-safe, sudah handle semua edge case di Morela.ts.

```ts
// BENAR — tinggal destructure dari context
const handler = async (m, { Morela, botAdmin }) => {
  if (!botAdmin) return reply('Bot bukan admin grup')
}
```

Kalau benar-benar perlu compute manual (misal di passive handler yang tidak dapat context), gunakan:

```ts
const botNum = Morela.user.id.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
const botMember = participants.find((p: any) => {
  const pNum = p.id.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
  return pNum === botNum ||
    p.phoneNumber?.includes(botNum) ||
    getPhoneByLid(pNum)?.replace(/[^0-9]/g, '') === botNum
})
const botAdmin = !!(botMember?.admin === 'admin' || botMember?.admin === 'superadmin')
```

---

## Delete Pesan di Grup LID

Kalau `participant` masih `@lid` saat delete, WA silent fail dan pesan tidak terhapus.

```ts
let participant = senderJid
if (senderJid.endsWith('@lid')) {
  const phone = getPhoneByLid(senderJid.split('@')[0])
  if (phone) participant = phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
}
await Morela.sendMessage(from, {
  delete: { remoteJid: from, fromMe: false, id: msgId, participant }
})
```

---

## Resolve Nama dari Database

Urutan prioritas dari yang paling akurat:

```
1. store.groupMetadata[chat].participants[].notify   terbaik kalau di grup
2. store.contacts[jid].notify / .name / .verifiedName
3. getPushName(lidNum) / getPushName(phoneNum)       dari pushname.json
4. m.pushName                                        HANYA kalau target = sender
5. Morela.groupMetadata(chat) live fetch             last resort, lambat
```

```ts
const store = (globalThis as any).__botStore__

async function resolveName(targetJid: string, num: string, m: any) {
  // 1. store.groupMetadata
  if (store?.groupMetadata && m.isGroup) {
    const p = store.groupMetadata[m.chat]?.participants
      ?.find((p: any) => p.id.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') === num)
    const n = p?.notify || p?.name || p?.verifiedName
    if (n?.trim()) return n.trim()
  }

  // 2. store.contacts
  if (store?.contacts) {
    for (const c of [targetJid, num + '@s.whatsapp.net', num + '@c.us']) {
      const n = store.contacts[c]?.notify || store.contacts[c]?.name
      if (n?.trim()) return n.trim()
    }
  }

  // 3. pushname.json
  const lidNum = getLidByPhone(num)?.split('@')[0] ?? null
  const dbName =
    (lidNum ? getPushName(lidNum) : null) ||
    getPushName(num) || getPushName(targetJid) || getPushName(num + '@s.whatsapp.net')
  if (dbName?.trim()) return dbName.trim()

  // 4. m.pushName hanya kalau target = sender
  if (m.pushName?.trim()) {
    const senderNum = (m.sender || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
    if (senderNum === num) return m.pushName.trim()
  }

  // 5. live fetch
  if (m.isGroup) {
    try {
      const meta = await Morela.groupMetadata(m.chat)
      const p = meta?.participants?.find((p: any) =>
        p.id.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') === num)
      const n = p?.notify || p?.name || p?.verifiedName
      if (n?.trim()) return n.trim()
    } catch {}
  }

  return null
}
```

Untuk resolve nama singkat di plugin biasa, cukup pakai chain ini:

```ts
const isLid    = targetP.id.endsWith('@lid')
const lidNum   = targetP.id.split('@')[0]
const phone    = isLid ? getPhoneByLid(lidNum) : null
const phoneNum = phone ? phone.replace(/[^0-9]/g, '') : normNum(targetP.id)

const displayName =
  getPushName(targetP.id)                                          ||
  getPushName(lidNum)                                              ||
  (phone ? getPushName(phoneNum + '@s.whatsapp.net') : null)      ||
  (phone ? getPushName(phoneNum) : null)                          ||
  targetP.notify || targetP.name                                  ||
  '+' + phoneNum
```

---

## Masalah dan Solusinya

**Mention tampil angka aneh seperti +27 647xxx padahal bukan nomor itu**
Penyebab: `mentionedJid[0]` yang `@lid` di-normalisasi jadi angka sampah sebelum cari participant.
Solusi: biarkan `mentionedJid[0]` as-is, gunakan `findParticipant` dengan urutan fallback lengkap.

**Kick silent fail tanpa error**
Penyebab: JID yang dikirim ke `groupParticipantsUpdate` di-construct sendiri (`628xxx@s.whatsapp.net`) padahal participant terdaftar sebagai `@lid`.
Solusi: selalu pakai `targetP.id` asli dari hasil `findParticipant`.

**Delete pesan tidak terhapus**
Penyebab: field `participant` di delete masih `@lid`.
Solusi: convert ke phone dulu via `getPhoneByLid` sebelum kirim delete.

**Bot selalu dianggap bukan admin padahal sudah admin**
Penyebab: compare `p.id === botJid` langsung, padahal di grup LID format JID berbeda.
Solusi: pakai `botAdmin` dari context handler. Kalau tidak tersedia, normalisasi angka dulu dan tambah fallback `getPhoneByLid`.

**`m.pushName` return nama pengirim bukan target**
Penyebab: `m.pushName` itu nama orang yang kirim pesan, bukan target yang dimention atau di-reply.
Solusi: pakai `getPushName(targetJid)` atau chain resolve nama di atas.

**`getPushName(fullJid)` return null untuk LID user**
Penyebab: key di database pushname adalah LID number saja, bukan full JID.
Solusi: `getPushName(lidNum)` bukan `getPushName(lidNum + '@lid')`.

---

## Perbandingan Implementasi

| File | Mention hijau | Resolve nama | Catatan |
|---|---|---|---|
| welcome.ts | ya | ya | pushname chain lengkap |
| goodbye.ts | ya | ya | sama dengan welcome |
| kerangajaib.ts | ya | ya | getPushName chain |
| antigrup.ts | ya | ya | findParticipant paling lengkap |
| antivirtex.ts | ya | ya | kickAndNotify dengan LID resolve |
| votekick.ts | ya | ya | findParticipant + botAdmin context |
| didyoumen.ts | ya | tidak | cuma @phoneNum, tidak resolve nama |
| userinfo.ts | tidak | ya | resolveName 5 layer, paling lengkap |
