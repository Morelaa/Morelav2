// ─── Wrapper HTTP ke Telegram Bot API ───────────────────────────────────────
// Dipindahkan apa adanya dari tgbot.ts lama (tidak ada perubahan logic),
// supaya semua plugin tinggal import fungsi-fungsi ini.

import axios from 'axios'
import fs    from 'fs'
import { getTgToken, getTgChatId } from '../../Library/tg_global.js'
import type { TgApiResult } from './types.js'

const AXIOS_DEFAULT_TIMEOUT = 15000

export function getTgCfg() {
  const token   = getTgToken()
  const ownerId = getTgChatId()
  return { token, ownerId: String(ownerId) }
}

export async function tgApi(
  method: string,
  params: Record<string, unknown> = {},
  axiosTimeout: number = AXIOS_DEFAULT_TIMEOUT
): Promise<unknown> {
  const { token } = getTgCfg()
  if (!token) return null
  try {
    const { data } = await axios.post<TgApiResult>(
      `https://api.telegram.org/bot${token}/${method}`,
      params,
      { timeout: axiosTimeout }
    )
    return data?.result ?? null
  } catch (e) {
    const msg        = (e as Error).message ?? ''
    const statusCode = (e as { response?: { status?: number } })?.response?.status ?? 0
    if (statusCode === 409) throw Object.assign(new Error('TGBOT_409_CONFLICT'), { code: 409 })
    const isSilent =
      method === 'getUpdates' &&
      (msg.includes('timeout') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') ||
       msg.includes('ENOTFOUND') || msg.includes('socket hang up') || msg.includes('network'))
    if (!isSilent) console.error(`[TGBOT] API error ${method}:`, msg)
    return null
  }
}

export async function sendMsg(chatId: number | string, text: string, opts: Record<string, unknown> = {}): Promise<unknown> {
  return tgApi('sendMessage', {
    chat_id:    chatId,
    text:       text.slice(0, 4096),
    parse_mode: 'Markdown',
    ...opts
  })
}

export async function sendPhoto(chatId: number | string, photoPath: string, caption: string, replyMarkup: unknown = null): Promise<unknown> {
  try {
    const FormData = (await import('form-data')).default
    const form     = new FormData()
    form.append('chat_id', String(chatId))
    form.append('caption', caption.slice(0, 1024))
    form.append('parse_mode', 'Markdown')
    if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup))
    if (photoPath.startsWith('http')) {
      form.append('photo', photoPath)
    } else {
      form.append('photo', fs.createReadStream(photoPath), { filename: 'menu.jpg' })
    }
    const { token } = getTgCfg()
    const { data }  = await axios.post<TgApiResult>(
      `https://api.telegram.org/bot${token}/sendPhoto`,
      form,
      { headers: form.getHeaders(), timeout: 30000 }
    )
    return data?.result ?? null
  } catch (e) {
    console.error('[TGBOT] sendPhoto error:', (e as Error).message)
    return null
  }
}

export async function answerCallback(callbackQueryId: string, text: string = ''): Promise<unknown> {
  return tgApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
}

export async function editMsg(chatId: number | string, messageId: number | undefined, text: string, replyMarkup: unknown = null): Promise<unknown> {
  return tgApi('editMessageText', {
    chat_id:    chatId,
    message_id: messageId,
    text:       text.slice(0, 4096),
    parse_mode: 'Markdown',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  })
}

export async function tgDownloadPhoto(fileId: string): Promise<Buffer> {
  const { token } = getTgCfg()
  const fileInfo  = await tgApi('getFile', { file_id: fileId }) as { file_path?: string }
  if (!fileInfo?.file_path) throw new Error('Gagal get file info dari Telegram')
  const res = await axios.get(`https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`, { responseType: 'arraybuffer', timeout: 30000 })
  return Buffer.from(res.data)
}

export async function tgUploadToCDN(buf: Buffer): Promise<string> {
  // Coba ornzora dulu, fallback ke imgbb
  try {
    const form = new (await import('form-data')).default()
    form.append('file', buf, { filename: 'image.jpg', contentType: 'image/jpeg' })
    const res  = await axios.post('https://cdn.ornzora.eu.cc/upload', form, { headers: form.getHeaders(), timeout: 30000 })
    const url  = res.data?.url || res.data?.data?.url || res.data?.link || res.data?.data?.link
    if (url) return url as string
  } catch {}
  // Fallback imgbb
  const form2 = new (await import('form-data')).default()
  form2.append('image', buf.toString('base64'))
  const res2 = await axios.post(`https://api.imgbb.com/1/upload?key=${global.apiKeys.imgbb}`, form2, { headers: form2.getHeaders(), timeout: 30000 })
  const url2 = res2.data?.data?.url
  if (!url2) throw new Error('Upload CDN gagal')
  return url2 as string
}

export async function tgSendDocument(chatId: string | number, urlOrBuf: string | Buffer, caption: string = '', filename: string = 'result.png') {
  const token = getTgToken()
  let buf: Buffer
  if (typeof urlOrBuf === 'string') {
    const res = await axios.get(urlOrBuf, { responseType: 'arraybuffer', timeout: 60000 })
    buf = Buffer.from(res.data)
  } else {
    buf = urlOrBuf
  }
  // Konversi ke PNG lossless (tanpa kompresi) supaya hasil tetap tajam, tidak dikompres ulang oleh Telegram
  try {
    const sharp = (await import('sharp')).default
    buf = await sharp(buf).png({ compressionLevel: 9, effort: 10 }).toBuffer()
  } catch {}
  const FormData = (await import('form-data')).default
  const form = new FormData()
  form.append('chat_id', String(chatId))
  form.append('document', buf, { filename, contentType: 'image/png' })
  if (caption) form.append('caption', caption)
  form.append('parse_mode', 'Markdown')
  await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form, {
    headers: form.getHeaders(), timeout: 60000, maxContentLength: Infinity, maxBodyLength: Infinity
  })
}

export async function tgSendPhoto(chatId: string | number, urlOrBuf: string | Buffer, caption: string = '') {
  const token = getTgToken()
  let buf: Buffer
  if (typeof urlOrBuf === 'string') {
    const res = await axios.get(urlOrBuf, { responseType: 'arraybuffer', timeout: 60000 })
    buf = Buffer.from(res.data)
  } else {
    buf = urlOrBuf
  }
  const FormData = (await import('form-data')).default
  const form = new FormData()
  form.append('chat_id', String(chatId))
  form.append('photo', buf, { filename: 'result.jpg', contentType: 'image/jpeg' })
  if (caption) form.append('caption', caption)
  form.append('parse_mode', 'Markdown')
  await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, { headers: form.getHeaders(), timeout: 60000 })
}
