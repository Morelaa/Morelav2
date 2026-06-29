import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import ffmpeg from 'fluent-ffmpeg'
import webpmux from 'node-webpmux'

const { Image } = webpmux

const TEMP_DIR = path.join(process.cwd(), 'media', 'temp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

/**
 * Convert a static image buffer to a webp sticker buffer.
 */
export const imageToWebp = (buffer: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const stamp  = Date.now()
    const input  = path.join(TEMP_DIR, `s_in_${stamp}.jpg`)
    const output = path.join(TEMP_DIR, `s_out_${stamp}.webp`)

    fs.writeFileSync(input, buffer)

    ffmpeg(input)
      .on('error', (e: Error) => {
        try { fs.unlinkSync(input)  } catch {}
        try { fs.unlinkSync(output) } catch {}
        reject(e)
      })
      .on('end', () => {
        try { fs.unlinkSync(input) } catch {}
        try {
          const webp = fs.readFileSync(output)
          fs.unlinkSync(output)
          resolve(webp)
        } catch (e) {
          reject(e)
        }
      })
      .outputOptions([
        '-vcodec', 'libwebp',
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15',
        '-loop', '0',
        '-preset', 'default',
        '-an',
        '-vsync', '0'
      ])
      .save(output)
  })

/**
 * Convert a video buffer to an animated webp sticker buffer.
 * Max 6 seconds, 512x512, 15fps, with transparency.
 */
export const videoToWebp = (buffer: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const stamp  = Date.now()
    const input  = path.join(TEMP_DIR, `sv_in_${stamp}.mp4`)
    const output = path.join(TEMP_DIR, `sv_out_${stamp}.webp`)

    fs.writeFileSync(input, buffer)

    ffmpeg(input)
      .on('error', (e: Error) => {
        console.error('[STICKER FFMPEG ERROR]', e)
        try { fs.unlinkSync(input)  } catch {}
        try { fs.unlinkSync(output) } catch {}
        reject(e)
      })
      .on('end', () => {
        try { fs.unlinkSync(input) } catch {}
        try {
          const webp = fs.readFileSync(output)
          fs.unlinkSync(output)
          resolve(webp)
        } catch (e) {
          reject(e)
        }
      })
      .outputOptions([
        '-vcodec', 'libwebp',
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
        '-loop', '0',
        '-preset', 'default',
        '-an',
        '-vsync', '0',
        '-t', '6'
      ])
      .save(output)
  })

/**
 * Convenience wrapper: convert image OR video buffer to a webp sticker buffer
 * depending on `isVideo`.
 */
export const sticker = async (buffer: Buffer, isVideo = false): Promise<Buffer> =>
  isVideo ? videoToWebp(buffer) : imageToWebp(buffer)

/**
 * Returns true if the given webp buffer is an animated webp (ANIM chunk present).
 */
export async function isAnimatedWebp(buffer: Buffer): Promise<boolean> {
  try {
    const img = new Image()
    await img.load(buffer)
    return !!(img as any).hasAnim
  } catch {
    return false
  }
}

/**
 * Add exif metadata (pack name / author) to a webp sticker buffer.
 */
export async function addExif(buffer: Buffer, packname?: string, author?: string): Promise<Buffer> {
  const img = new Image()
  await img.load(buffer)

  const jsonBuf = Buffer.from(JSON.stringify({
    'sticker-pack-id':        crypto.randomUUID(),
    'sticker-pack-name':      packname || '',
    'sticker-pack-publisher': author   || '',
    'emojis':                 ['🤖']
  }), 'utf8')

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00,
    0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x41, 0x57,
    0x07, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x16, 0x00, 0x00, 0x00
  ])

  const exif = Buffer.concat([exifAttr, jsonBuf])
  exif.writeUIntLE(jsonBuf.length, 14, 4)

  img.exif = exif
  return await img.save(null) as unknown as Buffer
}
