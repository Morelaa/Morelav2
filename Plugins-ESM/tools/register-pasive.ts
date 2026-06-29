import fs   from 'fs'
import path  from 'path'
import { isRegistered, getPhoneByLid, getPushName } from '../../Database/db.js'
import { botName }      from '../../Library/utils.js'
import { isSelfMode }   from '../../System/selfmode.js'
import { isPrivateMode } from '../../System/privatemode.js'

const REG_IMG_PATH = path.join(process.cwd(), 'media', 'register.jpg')

let _regImg: Buffer | null = null
function getRegImage(): Buffer | null {
    if (_regImg) return _regImg
    try {
        if (fs.existsSync(REG_IMG_PATH)) {
            _regImg = fs.readFileSync(REG_IMG_PATH)
            console.log('[REG-PASIVE] register.jpg loaded dari:', REG_IMG_PATH)
        } else {
            console.warn('[REG-PASIVE] register.jpg tidak ditemukan di:', REG_IMG_PATH)
        }
    } catch (e: any) {
        console.error('[REG-PASIVE] Gagal baca register.jpg:', e.message)
    }
    return _regImg
}

const _cooldown = new Map<string, number>()
const COOLDOWN_MS = 10 * 1000

setInterval(() => {
    const now = Date.now()
    for (const [k, ts] of _cooldown.entries()) {
        if (now - ts > COOLDOWN_MS) _cooldown.delete(k)
    }
}, 5 * 60 * 1000)

const PREFIXES = ['.', '!', ',', '🐤', '🗿']

const PASSIVE_SKIP_CMDS = ['daftar', 'daftar_auto', 'unreg', 'unregister']

export default {
    tags: ['passive', 'register'],

    handler: async (m: any, { Morela, isOwn, isPrem, fkontak }: any) => {
        try {
            if (m.fromMe)   return
            if (!m.message) return
            if (m.message?.reactionMessage)              return
            if (m.message?.protocolMessage)              return
            if (m.message?.senderKeyDistributionMessage) return
            if (m.chat === 'status@broadcast')           return

            if (isOwn || isPrem) return

            try {
                const { getMainOwner: _getMO } = await import('../../System/mainowner.js')
                const _mo = _getMO()
                if (_mo) {
                    const _jidSources = [
                        m.sender || '',
                        m.key?.remoteJid || '',
                        m.key?.participant || ''
                    ]
                    const _isOwnerDirect = _jidSources.some(j => {
                        if (!j) return false
                        const n = j.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
                        return n === _mo
                    })
                    if (_isOwnerDirect) return
                }
            } catch {}

            if (m.isGroup && isSelfMode(m.chat)) return

            if (!m.isGroup && isPrivateMode()) return

            const text = (m.text || m.body || '').trim()
            if (!text) return

            const isCmd = PREFIXES.some(p => text.startsWith(p))
            if (!isCmd) return

            const cmdBody = text.slice(1).trim().split(' ')[0].toLowerCase()
            if (PASSIVE_SKIP_CMDS.includes(cmdBody)) return

            const rawSender = m.sender || m.key?.participant || m.key?.remoteJid || ''
            let senderJid = rawSender
            if (rawSender.endsWith('@lid')) {
                const lidNum   = rawSender.split('@')[0]
                const resolved = getPhoneByLid(lidNum)
                if (resolved) senderJid = resolved + '@s.whatsapp.net'
            }

            if (isRegistered(senderJid)) return

            const now = Date.now()
            const lastSent = _cooldown.get(senderJid) || 0
            if (now - lastSent < COOLDOWN_MS) return
            _cooldown.set(senderJid, now)

            const _isLid     = senderJid.endsWith('@lid')
            const _rawLid    = senderJid.split('@')[0]
            const _resolved  = _isLid ? (getPhoneByLid(_rawLid) || null) : null
            const _phoneNum  = _resolved ? _resolved.replace(/[^0-9]/g, '') : _rawLid.replace(/[^0-9]/g, '')
            const _mention   = _resolved ? `${_phoneNum}@s.whatsapp.net` : senderJid
            const _name      =
                getPushName(senderJid) || getPushName(_rawLid) ||
                (_resolved ? getPushName(`${_phoneNum}@s.whatsapp.net`) : null) ||
                (_resolved ? getPushName(_phoneNum) : null) ||
                (m as any).pushName || ('' + _phoneNum)

            const pesan = m.isGroup
    ? `⚠️ @${_phoneNum} *Kamu belum terdaftar!*\n\nKetik *.daftar* untuk mulai menggunakan bot.\n\n꒰ © ${botName} ꒱`
    : `⚠️ *Kamu belum terdaftar!*\n\nKetik *.daftar* untuk mulai menggunakan bot.\n\n꒰ © ${botName} ꒱`

            const imgBuf = getRegImage()

            if (imgBuf) {
                await Morela.sendMessage(m.chat, {
                    image:   imgBuf,
                    caption: pesan,
                    ...(m.isGroup ? { mentions: [_mention] } : {})
                }, { quoted: fkontak || m })
            } else {
                await Morela.sendMessage(m.chat, {
                    text:     pesan,
                    ...(m.isGroup ? { mentions: [_mention] } : {})
                }, { quoted: fkontak || m })
            }

        } catch (e: any) {
            console.error('[REG-PASIVE] Error:', e.message)
        }
    }
}
