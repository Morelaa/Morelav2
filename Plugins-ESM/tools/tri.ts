const handler = async (m: any, { Morela, reply, text, fkontak }: any) => {
  const msisdn = text?.trim()

  if (!msisdn) return reply(
    `📱 *Cek Status SIM Tri*\n\nCara pakai:\n*.tri 08973965618*`
  )

  let nomor = msisdn.replace(/\D/g, '')
  if (nomor.startsWith('0')) nomor = '62' + nomor.slice(1)
  if (!nomor.startsWith('62')) nomor = '62' + nomor

  await Morela.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

  try {
    const response = await fetch('https://tri.co.id/api/v1/information/sim-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sec-ch-ua-platform': '"Android"',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
        'sec-ch-ua-mobile': '?1',
        'Origin': 'https://tri.co.id',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Referer': 'https://tri.co.id/',
        'Accept-Language': 'id,en-US;q=0.9,en;q=0.8,ar;q=0.7'
      },
      body: JSON.stringify({
        action: 'MSISDN_STATUS_WEB',
        input1: '',
        input2: '',
        language: 'ID',
        msisdn: nomor
      })
    })

    const json = await response.json()

    if (!json.status || !json.data) {
      await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return reply(`❌ Gagal!\n${json.message || 'Nomor tidak ditemukan'}`)
    }

    const d = json.data
    const statusEmoji = d.cardStatus?.toLowerCase().includes('aktif') ? '✅' : '❌'

    await Morela.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

    await reply(
      `📱 *CEK STATUS SIM TRI*\n\n` +
      `📞 *Nomor:* ${d.msisdn}\n` +
      `💳 *ICCID:* ${d.iccid}\n` +
      `${statusEmoji} *Status Kartu:* ${d.cardStatus}\n` +
      `📋 *Status Registrasi:* ${d.activationStatus}\n` +
      `📦 *Paket:* ${d.prodDesc}\n` +
      `📅 *Tanggal Aktivasi:* ${d.activationDate}\n` +
      `⏳ *Masa Aktif Hingga:* ${d.actEndDate}\n` +
      `📍 *Wilayah:* ${d.retDistrict}\n` +
      `🔁 *FRC Date:* ${d.frcDate}`
    )

  } catch (e) {
    console.error('[tri error]', e)
    await Morela.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    reply('❌ Gagal: ' + (e as Error).message)
  }
}

handler.command = ['tri', 'cektri', 'simtri']
handler.tags = ['tools']
handler.help = ['tri <nomor>']

export default handler
