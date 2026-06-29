import type { ExtSocket, GetFileResult, MsgObj } from '../types/global.js';
import type { AnyMessageContent, MediaType } from '@itsliaaa/baileys';
import * as baileys from '@itsliaaa/baileys';
const { downloadContentFromMessage } = baileys;
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileTypeFromBuffer } from 'file-type';
import { getBuffer, getSizeMedia, sleep } from '../System/message.js';
const _toBuffer = async (src: string | Buffer): Promise<Buffer> => {
    if (Buffer.isBuffer(src)) return src;
    if (/^data:.*\/.*?;base64,/i.test(src)) return Buffer.from(src.split(',')[1] ?? '', 'base64');
    if (/^https?:\/\//.test(src)) return getBuffer(src);
    if (fs.existsSync(src)) return fs.readFileSync(src);
    return Buffer.alloc(0);
};
const _getStickerHelpers = () => globalThis as Record<string, unknown> as {
    writeExifImg?: (b: Buffer, o: unknown) => Promise<Buffer>;
    imageToWebp?:  (b: Buffer) => Promise<Buffer>;
    writeExifVid?: (b: Buffer, o: unknown) => Promise<Buffer>;
    videoToWebp?:  (b: Buffer) => Promise<Buffer>;
};
export function attachSocketExtensions(Morela: ExtSocket): void {
    Morela.getFile = async (PATH: string | Buffer, save = false): Promise<GetFileResult> => {
        let res: Buffer | undefined, data: Buffer;
        if (Buffer.isBuffer(PATH))                         { data = PATH; }
        else if (/^data:.*\/.*?;base64,/i.test(PATH))     { data = Buffer.from(PATH.split(',')[1] ?? '', 'base64'); }
        else if (/^https?:\/\//.test(PATH))                { res = data = await getBuffer(PATH); }
        else if (fs.existsSync(PATH))                      { data = fs.readFileSync(PATH); }
        else                                               { data = Buffer.from(PATH); }
        const type     = await fileTypeFromBuffer(data! as unknown as Uint8Array) ?? { mime: 'application/octet-stream', ext: 'bin' };
        const filename = path.join(os.tmpdir(), `morela_${Date.now()}.${type.ext}`);
        if (save) await fs.promises.writeFile(filename, data! as unknown as Uint8Array);
        return {
            res,
            filename,
            size: await getSizeMedia(data!),
            ...type,
            data: data!,
            cleanup: () => { if (save && fs.existsSync(filename)) try { fs.unlinkSync(filename); } catch {} }
        };
    };
    Morela.downloadMediaMessage = async (message: MsgObj | Record<string, unknown>): Promise<Buffer> => {
        const msg    = message as Record<string, unknown>;
        const quoted = (msg.msg ?? msg.message ?? msg) as Record<string, unknown>;
        const mime   = String(((quoted.msg as Record<string, unknown>) ?? quoted).mimetype ?? '');
        let   mtype  = msg.mtype ? String(msg.mtype).replace(/Message/gi, '') : mime.split('/')[0];
        if (!mtype || mtype === 'undefined') {
            for (const t of ['image','video','sticker','audio','document'] as MediaType[]) {
                if (quoted[`${t}Message`] || mime.includes(t)) { mtype = t; break; }
            }
        }
        try {
            const stream = await downloadContentFromMessage(quoted as Parameters<typeof downloadContentFromMessage>[0], mtype as MediaType);
            let buf = Buffer.from([]);
            for await (const c of stream) buf = Buffer.concat([buf, c]);
            if (!buf.length) throw new Error("Empty buffer");
            return buf;
        } catch (err) {
            const u = String((quoted as Record<string, unknown>).url ?? '');
            if (u) { const r = await getBuffer(u); if (r?.length) return r; }
            throw new Error(`Download failed: ${(err as Error).message}`);
        }
    };
    Morela.downloadMedia = async (message: MsgObj | Record<string, unknown>, opts: { forceType?: string | null; maxRetries?: number; retryDelay?: number } = {}): Promise<Buffer> => {
        const { forceType = null, maxRetries = 3, retryDelay = 1000 } = opts;
        const msg = message as Record<string, unknown>;
        let lastErr: unknown;
        for (let i = 1; i <= maxRetries; i++) {
            try {
                const quoted = (msg.msg ?? msg.message ?? msg) as Record<string, unknown>;
                const mime   = String(((quoted.msg as Record<string, unknown>) ?? quoted).mimetype ?? '');
                let   mtype  = forceType ?? (msg.mtype ? String(msg.mtype).replace(/Message/gi,'') : mime.split('/')[0]);
                if (!mtype || mtype === 'undefined') {
                    for (const t of ['image','video','sticker','audio','document'] as MediaType[]) {
                        if (quoted[`${t}Message`] || mime.includes(t)) { mtype = t; break; }
                    }
                }
                const stream   = await downloadContentFromMessage(quoted as Parameters<typeof downloadContentFromMessage>[0], mtype as MediaType);
                const tmp      = path.join(os.tmpdir(), `morela_dl_${Date.now()}.tmp`);
                const ws       = fs.createWriteStream(tmp);
                let   bytes    = 0;
                for await (const c of stream) { ws.write(c); bytes += c.length; }
                await new Promise<void>((res, rej) => ws.end((e?: Error | null) => e ? rej(e) : res()));
                if (!bytes) { try { fs.unlinkSync(tmp); } catch {} throw new Error("Empty"); }
                const buf = fs.readFileSync(tmp);
                try { fs.unlinkSync(tmp); } catch {}
                return buf;
            } catch (e) { lastErr = e; if (i < maxRetries) await sleep(retryDelay * Math.pow(2, i-1)); }
        }
        throw lastErr ?? new Error("Download failed");
    };
    Morela.sendText = (jid: string, text: string, quoted: unknown = '', options: Record<string,unknown> = {}) =>
        Morela.sendMessage(jid, { text, ...options } as AnyMessageContent, { quoted });
    Morela.sendImageAsSticker = async (jid: string, src: string | Buffer, quoted: unknown, options: Record<string, unknown> = {}) => {
        const buff = await _toBuffer(src);
        const h    = _getStickerHelpers();
        const buf  = (options.packname || options.author) && h.writeExifImg
            ? await h.writeExifImg(buff, options)
            : h.imageToWebp ? await h.imageToWebp(buff) : buff;
        await Morela.sendMessage(jid, { sticker: buf } as AnyMessageContent, { quoted });
        return buf;
    };
    Morela.sendVideoAsSticker = async (jid: string, src: string | Buffer, quoted: unknown, options: Record<string, unknown> = {}) => {
        const buff = await _toBuffer(src);
        const h    = _getStickerHelpers();
        const buf  = (options.packname || options.author) && h.writeExifVid
            ? await h.writeExifVid(buff, options)
            : h.videoToWebp ? await h.videoToWebp(buff) : buff;
        await Morela.sendMessage(jid, { sticker: buf } as AnyMessageContent, { quoted });
        return buf;
    };
    Morela.downloadAndSaveMediaMessage = async (message: Record<string, unknown>, filename: string, attachExtension: boolean = true) => {
        const msg    = message as Record<string, unknown>;
        const quoted = (msg.msg ?? msg) as Record<string, unknown>;
        const mime   = String(((quoted.msg as Record<string, unknown>) ?? quoted).mimetype ?? '');
        const mtype  = msg.mtype ? String(msg.mtype).replace(/Message/gi,'') : mime.split('/')[0];
        const stream = await downloadContentFromMessage(quoted as Parameters<typeof downloadContentFromMessage>[0], mtype as MediaType);
        let buf = Buffer.from([]);
        for await (const c of stream) buf = Buffer.concat([buf, c]);
        const type = await fileTypeFromBuffer(buf as unknown as Uint8Array);
        const name = attachExtension ? `${filename}.${type?.ext ?? 'bin'}` : filename;
        fs.writeFileSync(name, buf as unknown as Uint8Array);
        return name;
    };
    Morela.sendMedia = async (jid: string, filePath: string, caption: string = '', quoted: unknown = '', options: Record<string, unknown> = {}) => {
        const file = await Morela.getFile(filePath, true);
        const mt   = file.mime.split('/')[0];
        let   cnt: AnyMessageContent;
        if      (mt === 'image') cnt = { image: file.data, caption, ...options } as AnyMessageContent;
        else if (mt === 'video') cnt = { video: file.data, caption, ...options } as AnyMessageContent;
        else if (mt === 'audio') cnt = { audio: file.data, ptt: Boolean(options.ptt) } as AnyMessageContent;
        else                     cnt = { document: file.data, mimetype: file.mime, fileName: String(options.fileName ?? 'file') } as AnyMessageContent;
        try { await Morela.sendMessage(jid, cnt, { quoted }); } finally { file.cleanup(); }
    };
    Morela.sendPoll = async (jid: string, name: string, values: string[]) => {
        await Morela.sendMessage(jid, { poll: { name, values, selectableCount: 1 } } as AnyMessageContent);
    }; 
    Morela.public = true;
}
