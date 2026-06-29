'use strict';
const VERSION = '4.6';
import { generateWAMessageFromContent, prepareWAMessageMedia } from 'baileys';
import crypto from 'crypto';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough, Readable } from 'stream';
type MediaType = 'image' | 'video' | 'document' | 'audio';
type ResolveResult = 'url' | 'buffer' | 'base64';
type SuggestLayout = 'Single' | 'HScroll' | 'ActionRow';
interface IEResult {
	text: string;
	ie: IEEntry[];
	inline_entities: InlineEntity[];
}
interface IEEntry {
	type: 'hyperlink' | 'citation' | 'latex';
	ie: Record<string, unknown>;
}
interface InlineEntity {
	key: string;
	metadata: Record<string, unknown>;
}
interface ReelItem {
	username?: string;
	title?: string;
	profileIconUrl?: string;
	profile_url?: string;
	profile?: string;
	thumbnailUrl?: string;
	thumbnail?: string;
	videoUrl?: string;
	url?: string;
	reels_title?: string;
	likes_count?: number;
	like?: number;
	shares_count?: number;
	share?: number;
	view_count?: number;
	view?: number;
	reel_source?: string;
	source?: string;
	is_verified?: boolean;
	verified?: boolean;
}
interface PostItem {
	title?: string;
	subtitle?: string;
	username?: string;
	profile_picture_url?: string;
	profile_url?: string;
	profile?: string;
	is_verified?: boolean;
	verified?: boolean;
	thumbnail_url?: string;
	thumbnail?: string;
	post_caption?: string;
	caption?: string;
	likes_count?: number;
	like?: number;
	comments_count?: number;
	comment?: number;
	shares_count?: number;
	share?: number;
	post_url?: string;
	url?: string;
	post_deeplink?: string;
	deeplink?: string;
	source_app?: string;
	source?: string;
	footer_label?: string;
	footer?: string;
	footer_icon?: string;
	icon?: string;
	orientation?: 'LANDSCAPE' | 'PORTRAIT';
	post_type?: 'PHOTO' | 'VIDEO';
}
interface ProductItem {
	title?: string;
	brand?: string;
	price?: string;
	sale_price?: string;
	product_url?: string;
	url?: string;
	image_url?: string;
	image?: string | Buffer;
	icon_url?: string;
	icon?: string | Buffer;
}
interface VideoInput {
	url: string | Buffer;
	thumbnail?: string | Buffer;
	duration?: number;
	file_length?: number;
	mime_type?: string;
}
interface ResolveMediaOptions {
	resolveUrl?: boolean;
	resolveWAUrl?: boolean;
	result?: ResolveResult;
	resize?: boolean;
	width?: number;
	height?: number;
}
interface GetMp4PreviewOptions {
	time?: number;
	result?: ResolveResult;
	resize?: boolean;
	width?: number;
	height?: number;
	silent?: boolean;
}
function extractIE(
	text: string,
	{ extract = true, hyperlink = true, citation = true, latex = true }: { extract?: boolean; hyperlink?: boolean; citation?: boolean; latex?: boolean } = {}
): IEResult {
	if (!extract) {
		return { text, ie: [], inline_entities: [] };
	}
	const createIE = (type: string, ie: Record<string, unknown>): InlineEntity | undefined => {
		if (type === 'hyperlink') {
			return {
				key: ie.key as string,
				metadata: {
					display_name: ie.text,
					is_trusted: ie.is_trusted,
					url: ie.url,
					__typename: 'GenAIInlineLinkItem',
				},
			};
		}
		if (type === 'citation') {
			return {
				key: ie.key as string,
				metadata: {
					reference_id: ie.reference_id,
					reference_url: ie.url,
					reference_title: ie.url,
					reference_display_name: ie.url,
					sources: [],
					__typename: 'GenAISearchCitationItem',
				},
			};
		}
		if (type === 'latex') {
			return {
				key: ie.key as string,
				metadata: {
					latex_expression: ie.text,
					latex_image: {
						url: ie.url,
						width: Number(ie.width) || 100,
						height: Number(ie.height) || 100,
					},
					font_height: Number(ie.font_height) || 83.333333333333,
					padding: Number(ie.padding) || 15,
					__typename: 'GenAILatexItem',
				},
			};
		}
	};
	const ie: IEEntry[] = [];
	const inline_entities: InlineEntity[] = [];
	let result = '';
	let last = 0;
	let citation_index = 1;
	let hyperlink_index = 0;
	let latex_index = 0;
	const stack: number[] = [];	
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '[' && text[i - 1] !== '\\') {
			stack.push(i);
		} else if (text[i] === ']' && (text[i + 1] === '(' || text[i + 1] === '<')) {
			const start = stack.pop();
			if (start == null) continue;
			const open = text[i + 1];
			const close = open === '(' ? ')' : '>';
			const type = open === '(' ? 'link' : 'latex';
			let end = i + 2;
			let depth = 1;
			while (end < text.length && depth) {
				if (text[end] === open && text[end - 1] !== '\\') depth++;
				else if (text[end] === close && text[end - 1] !== '\\') depth--;
				end++;
			}
			if (depth) continue;
			const raw = text.slice(start + 1, i).trim();
			let url = text.slice(i + 2, end - 1).trim();
			let key: string;
			let tag: string;
			let data: IEEntry;
			if (type === 'latex') {
				if (!latex) continue;
				const [txt = '', width = null, height = null, font_height = null, padding = null] = raw.split('|');
				key = `\u004E\u0049\u0058\u0045\u004C_LATEX_${latex_index++}`;
				tag = `{{${key}}}${txt || 'image'}{{/${key}}}`;
				data = {
					type: 'latex',
					ie: { key, text: txt, url, width, height, font_height, padding },
				};
			} else if (raw) {
				if (!hyperlink) continue;
				const trusted = !url.startsWith('!');
				if (!trusted) url = url.slice(1);
				key = `\u004E\u0049\u0058\u0045\u004C_HYPERLINK_${hyperlink_index++}`;
				tag = `{{${key}}}${url}{{/${key}}}`;
				data = {
					type: 'hyperlink',
					ie: { key, text: raw, url, is_trusted: trusted },
				};
			} else {
				if (!citation) continue;
				key = `\u004E\u0049\u0058\u0045\u004C_CITATION_${citation_index - 1}`;
				tag = `{{${key}}}${url}{{/${key}}}`;
				data = {
					type: 'citation',
					ie: { reference_id: citation_index++, key, text: '', url },
				};
			}
			result += text.slice(last, start) + tag;
			last = end;
			ie.push(data);
			const entity = createIE(data.type, data.ie as Record<string, unknown>);
			if (entity) inline_entities.push(entity);
			i = end - 1;
		}
	}
	result += text.slice(last);
	return { text: result, ie, inline_entities };
}
async function waitAllPromises<T>(input: T): Promise<T> {
	const isPromise = (v: unknown): v is Promise<unknown> => !!v && typeof (v as Promise<unknown>).then === 'function';
	const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
	const deep = async (v: unknown): Promise<unknown> => {
		if (isPromise(v)) return deep(await v);
		if (Array.isArray(v)) return Promise.all(v.map(deep));
		if (isObject(v)) {
			const entries = await Promise.all(Object.entries(v).map(async ([k, val]) => [k, await deep(val)]));
			return Object.fromEntries(entries);
		}
		return v;
	};
	return deep(await input) as T;
}
class Toolkit {
	constructor() {}
	static extractIE(
		text: string,
		{ extract = true, hyperlink = true, citation = true, latex = true }: { extract?: boolean; hyperlink?: boolean; citation?: boolean; latex?: boolean } = {}
	): IEResult {
		return extractIE(text, { extract, hyperlink, citation, latex });
	}
	static async resize(buffer: Buffer, x: number, y: number, fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' = 'cover'): Promise<Buffer> {
		return await sharp(buffer)
			.resize(x, y, {
				fit,
				position: 'center',
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png()
			.toBuffer();
	}
	static async waitAllPromises<T>(input: T): Promise<T> {
		return await waitAllPromises(input);
	}
	static async fetchBuffer(url: string, options: RequestInit = {}, { silent = true }: { silent?: boolean } = {}): Promise<Buffer> {
		try {
			const response = await fetch(url, options);
			if (!response.ok) throw Error(`HTTP ${response.status}`);
			return Buffer.from(await response.arrayBuffer());
		} catch (error) {
			if (silent) return Buffer.alloc(0);
			throw error;
		}
	}
	static async toUrl(_client: any, path: string | Buffer, mediaType: MediaType = 'document'): Promise<string | undefined> {
		if (!path) throw new Error('Url or buffer needed');
		const media = await prepareWAMessageMedia(
			{
				[mediaType]: Buffer.isBuffer(path) ? path : { url: path },
			},
			{
				upload: _client.waUploadToServer,
				jid: '\u0040\u006e\u0065\u0077\u0073\u006c\u0065\u0074\u0074\u0065\u0072',
			}
		);
		return (Object.values(media)[0] as any)?.url;
	}
	static async resolveMedia(
		_client: any,
		media: string | Buffer | (string | Buffer)[],
		mediaType: MediaType = 'image',
		{ resolveUrl = false, resolveWAUrl = false, result = 'url' as ResolveResult, resize = false, width = 300, height = 300 }: ResolveMediaOptions = {}
	): Promise<string | Buffer | undefined | (string | Buffer | undefined)[]> {
		const isUrl = (str: string) => /^https?:\/\/.+/i.test(str);
		const isWAUrl = (str: string) => /^https?:\/\/[^/]*\.whatsapp\.net\//i.test(str);
		if (Array.isArray(media)) {
			return Promise.all(media.map((item) => Toolkit.resolveMedia(_client, item, mediaType, { resolveUrl, resolveWAUrl, result, resize, width, height })));
		}
		const originalIsBuffer = Buffer.isBuffer(media);
		if (typeof media === 'string' && isUrl(media)) {
			if (isWAUrl(media)) {
				if (resolveWAUrl) {
					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				} else if (!resolveUrl) {
					if (result === 'url') return media;
					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				}
			} else {
				if (!resolveUrl) {
					if (result === 'url') return media;
					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				} else {
					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				}
			}
		}
		if (typeof media === 'string' && !isUrl(media)) {
			media = Buffer.from(media, 'base64');
		}
		if (!Buffer.isBuffer(media) || !(media as Buffer).length) return undefined;
		if (resize && Buffer.isBuffer(media)) {
			media = await Toolkit.resize(media as Buffer, width, height);
		}
		if (result === 'buffer') return media as Buffer;
		if (result === 'base64') return (media as Buffer).toString('base64');

		if (originalIsBuffer) return Toolkit.toUrl(_client, media as Buffer, mediaType) as unknown as string;
		return Toolkit.toUrl(_client, media as Buffer, mediaType) as unknown as string;
	}
	static getMp4Duration(buffer: Buffer, { silent = true }: { silent?: boolean } = {}): number {
		try {
			if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
				if (silent) return 0;
				throw new Error('Invalid buffer');
			}
			let offset = 0;
			while (offset < buffer.length - 8) {
				const size = buffer.readUInt32BE(offset);
				if (size < 8 || offset + size > buffer.length) {
					if (silent) return 0;
					throw new Error('Invalid atom size');
				}
				const type = buffer.toString('ascii', offset + 4, offset + 8);
				if (type === 'moov') {
					let moovOffset = offset + 8;
					const moovEnd = offset + size;
					while (moovOffset < moovEnd - 8) {
						const childSize = buffer.readUInt32BE(moovOffset);
						if (childSize < 8 || moovOffset + childSize > moovEnd) {
							if (silent) return 0;
							throw new Error('Invalid child atom size');
						}
						const childType = buffer.toString('ascii', moovOffset + 4, moovOffset + 8);
						if (childType === 'mvhd') {
							const version = buffer.readUInt8(moovOffset + 8);
							if (version === 0) {
								const timescale = buffer.readUInt32BE(moovOffset + 20);
								const duration = buffer.readUInt32BE(moovOffset + 24);
								if (!timescale) {
									if (silent) return 0;
									throw new Error('Invalid timescale');
								}
								return duration / timescale;
							}
							if (version === 1) {
								const timescale = buffer.readUInt32BE(moovOffset + 32);
								const duration = Number(buffer.readBigUInt64BE(moovOffset + 36));
								if (!timescale) {
									if (silent) return 0;
									throw new Error('Invalid timescale');
								}
								return duration / timescale;
							}
						}
						moovOffset += childSize;
					}
				}
				offset += size;
			}
			if (silent) return 0;
			throw new Error('No mvhd found!');
		} catch (err) {
			if (silent) return 0;
			throw err;
		}
	}
	static getMp4Preview(videoBuffer: Buffer, { time, result = 'buffer' as ResolveResult, resize = true, width = 300, height = 300, silent = true }: GetMp4PreviewOptions = {}): Promise<Buffer | string> {
		return new Promise((resolve, reject) => {
			const fail = (err: Error) => {
				if (silent) return resolve(result === 'base64' ? '' : Buffer.alloc(0));
				return reject(err);
			};
			try {
				if (!Buffer.isBuffer(videoBuffer) || !videoBuffer.length) {
					return fail(new Error('videoBuffer tidak valid atau kosong'));
				}
				const inputStream = new Readable({ read() {} });
				inputStream.push(videoBuffer);
				inputStream.push(null);
				const outputStream = new PassThrough();
				const chunks: Buffer[] = [];
				outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
				outputStream.on('end', async () => {
					try {
						let output = Buffer.concat(chunks);
						if (!output.length) return fail(new Error('Output kosong — cek format atau timestamp video'));
						if (resize) output = await Toolkit.resize(output, width, height);
						return resolve(result === 'base64' ? output.toString('base64') : output);
					} catch (err) {
						return fail(err as Error);
					}
				});
				outputStream.on('error', fail);
				time ??= Math.min(Toolkit.getMp4Duration(videoBuffer) * 0.2, 10);
				ffmpeg(inputStream)
					.outputOptions([`-ss ${time}`, '-vframes 1', '-vcodec png', '-f image2pipe'])
					.on('error', (err: Error) => fail(new Error(`ffmpeg error: ${err.message}`)))
					.pipe(outputStream, { end: true });
			} catch (err) {
				return fail(err as Error);
			}
		});
	}
}
class BaseBuilder {
	protected _title: string;
	protected _subtitle: string;
	protected _body: string;
	protected _footer: string;
	protected _contextInfo: Record<string, unknown>;
	protected _extraPayload: Record<string, unknown>;
	constructor() {
		this._title = '';
		this._subtitle = '';
		this._body = '';
		this._footer = '';
		this._contextInfo = {};
		this._extraPayload = {};
	}
	setTitle(title: string): this {
		if (typeof title !== 'string') throw new TypeError('Title must be a string');
		this._title = title;
		return this;
	}
	setSubtitle(subtitle: string): this {
		if (typeof subtitle !== 'string') throw new TypeError('Subtitle must be a string');
		this._subtitle = subtitle;
		return this;
	}
	setBody(body: string): this {
		if (typeof body !== 'string') throw new TypeError('Body must be a string');
		this._body = body;
		return this;
	}
	setFooter(footer: string): this {
		if (typeof footer !== 'string') throw new TypeError('Footer must be a string');
		this._footer = footer;
		return this;
	}
	setContextInfo(obj: Record<string, unknown>): this {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('ContextInfo must be a plain object');
		}
		this._contextInfo = obj;
		return this;
	}
	addPayload(obj: Record<string, unknown>): this {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('Payload must be a plain object');
		}
		Object.assign(this._extraPayload, obj);
		return this;
	}
}
class Button extends BaseBuilder {
	#client: any;
	private _buttons: Record<string, unknown>[];
	private _data: Record<string, unknown> | undefined;
	private _currentSelectionIndex: number;
	private _currentSectionIndex: number;
	private _params: Record<string, unknown>;
	static paramsList = {
		limited_time_offer: { text: 'string', url: 'string', copy_code: 'string', expiration_time: 'number' },
		bottom_sheet: { in_thread_buttons_limit: 'number', divider_indices: ['number'], list_title: 'string', button_title: 'string' },
		tap_target_configuration: { title: 'string', description: 'string', canonical_url: 'string', domain: 'string', buttonIndex: 'number' },
	};
	constructor(client: any) {
		super();
		if (!client) throw new Error('Socket is required');
		this.#client = client;
		this._buttons = [];
		this._data = undefined;
		this._currentSelectionIndex = -1;
		this._currentSectionIndex = -1;
		this._params = {};
	}
	setVideo(path: string | Buffer, options: Record<string, unknown> = {}): this {
		if (!path) throw new Error('Url or buffer needed');
		this._data = Buffer.isBuffer(path) ? { video: path, ...options } : { video: { url: path }, ...options };
		return this;
	}
	setImage(path: string | Buffer, options: Record<string, unknown> = {}): this {
		if (!path) throw new Error('Url or buffer needed');
		this._data = Buffer.isBuffer(path) ? { image: path, ...options } : { image: { url: path }, ...options };
		return this;
	}
	setDocument(path: string | Buffer, options: Record<string, unknown> = {}): this {
		if (!path) throw new Error('Url or buffer needed');
		this._data = Buffer.isBuffer(path) ? { document: path, ...options } : { document: { url: path }, ...options };
		return this;
	}
	setMedia(obj: Record<string, unknown>): this {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new TypeError('Media must be a plain object');
		this._data = obj;
		return this;
	}
	clearButtons(): this {
		this._buttons = [];
		return this;
	}
	setParams(obj: Record<string, unknown>): this {
		this._params = obj;
		return this;
	}
	addButton(name: string, params: string | Record<string, unknown>): this {
		this._buttons.push({
			name,
			buttonParamsJson: typeof params === 'string' ? params : JSON.stringify(params),
		});
		return this;
	}
	makeRow(header = '', title = '', description = '', id = ''): this {
		if (this._currentSelectionIndex === -1 || this._currentSectionIndex === -1) {
			throw new Error('You need to create a selection and a section first');
		}
		const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson as string);
		buttonParams.sections[this._currentSectionIndex].rows.push({ header, title, description, id });
		this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
		return this;
	}
	makeSection(title = '', highlight_label = ''): this {
		if (this._currentSelectionIndex === -1) throw new Error('You need to create a selection first');
		const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson as string);
		buttonParams.sections.push({ title, highlight_label, rows: [] });
		this._currentSectionIndex = buttonParams.sections.length - 1;
		this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
		return this;
	}
	addSelection(title: string, options: Record<string, unknown> = {}): this {
		this._buttons.push({ ...options, name: 'single_select', buttonParamsJson: JSON.stringify({ title, sections: [] }) });
		this._currentSelectionIndex = this._buttons.length - 1;
		this._currentSectionIndex = -1;
		return this;
	}
	addReply(display_text = '', id = '', options: Record<string, unknown> = {}): this {
		this._buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text, id, ...options }) });
		return this;
	}
	addCall(display_text = '', id = '', options: Record<string, unknown> = {}): this {
		this._buttons.push({ name: 'cta_call', buttonParamsJson: JSON.stringify({ display_text, id, ...options }) });
		return this;
	}
	addReminder(display_text = '', id = '', options: Record<string, unknown> = {}): this {
		this._buttons.push({ name: 'cta_reminder', buttonParamsJson: JSON.stringify({ display_text, id, ...options }) });
		return this;
	}
	addCancelReminder(display_text = '', id = '', options: Record<string, unknown> = {}): this {
		this._buttons.push({ name: 'cta_cancel_reminder', buttonParamsJson: JSON.stringify({ display_text, id, ...options }) });
		return this;
	}
	addAddress(display_text = '', id = '', options: Record<string, unknown> = {}): this {
		this._buttons.push({ name: 'address_message', buttonParamsJson: JSON.stringify({ display_text, id, ...options }) });
		return this;
	}
	addLocation(options: Record<string, unknown> = {}): this {
		this._buttons.push({ name: 'send_location', buttonParamsJson: JSON.stringify(options) });
		return this;
	}
	addUrl(display_text = '', url = '', webview_interaction = false, options: Record<string, unknown> = {}): this {
		this._buttons.push({
			...options,
			name: 'cta_url',
			buttonParamsJson: JSON.stringify({ display_text, url, webview_interaction, ...options }),
		});
		return this;
	}
	addCopy(display_text = '', copy_code = '', options: Record<string, unknown> = {}): this {
		this._buttons.push({ name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text, copy_code, ...options }) });
		return this;
	}
	async toCard(): Promise<Record<string, unknown>> {
		return {
			body: { text: this._body },
			footer: { text: this._footer },
			header: {
				title: this._title,
				subtitle: this._subtitle,
				hasMediaAttachment: !!this._data,
				...(this._data
					? await prepareWAMessageMedia(this._data, { upload: this.#client.waUploadToServer }).catch((e: Error) => {
							if (String(e).includes('Invalid media type')) return this._data;
							throw e;
						})
					: {}),
			},
			nativeFlowMessage: {
				messageParamsJson: JSON.stringify(this._params),
				buttons: this._buttons,
			},
		};
	}
	async build(jid: string, options: Record<string, unknown> = {}): Promise<any> {
		const message = await this.toCard();
		return generateWAMessageFromContent(
			jid,
			{
				...this._extraPayload,
				interactiveMessage: { ...message, contextInfo: this._contextInfo },
			},
			{ ...options }
		);
	}
	async send(jid: string, options: Record<string, unknown> = {}): Promise<any> {
		const msg = await this.build(jid, options);
		await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [
				{
					tag: 'biz',
					attrs: {},
					content: [
						{
							tag: 'interactive',
							attrs: { type: 'native_flow', v: '1' },
							content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
						},
					],
				},
			],
			...options,
		});
		return msg;
	}
}
class ButtonV2 extends BaseBuilder {
	#client: any;
	private _image: string | Buffer | undefined;
	private _data: Record<string, unknown> | undefined;
	private _buttons: Record<string, unknown>[];
	constructor(client: any) {
		super();
		if (!client) throw new Error('Socket is required');
		this.#client = client;
		this._image = undefined;
		this._data = undefined;
		this._buttons = [];
	}
	addButton(displayText = '', buttonId: string = crypto.randomUUID()): this {
		this._buttons.push({ buttonId, buttonText: { displayText }, type: 1 });
		return this;
	}
	addRawButton(obj: Record<string, unknown>): this {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new TypeError('Buttons must be a plain object');
		this._buttons.push(obj);
		return this;
	}
	setThumbnail(path: string | Buffer): this {
		if (!path) throw new Error('Url or buffer needed');
		this._image = path;
		return this;
	}
	setMedia(obj: Record<string, unknown>): this {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new TypeError('Media must be a plain object');
		this._data = obj;
		return this;
	}
	async build(jid: string, options: Record<string, unknown> = {}): Promise<any> {
		const _thumbnail = this._image
			? await Toolkit.resize(Buffer.isBuffer(this._image) ? this._image : await Toolkit.fetchBuffer(this._image as string, {}, { silent: true }), 300, 300)
			: null;
		return generateWAMessageFromContent(
			jid,
			{
				...this._extraPayload,
				buttonsMessage: {
					contentText: this._body,
					footerText: this._footer,
					...(this._data
						? this._data
						: {
								headerType: 6,
								locationMessage: {
									degreesLatitude: 0,
									degreesLongitude: 0,
									name: this._title,
									address: this._subtitle,
									jpegThumbnail: _thumbnail,
								},
							}),
					viewOnce: true,
					contextInfo: this._contextInfo,
					buttons: [...this._buttons],
				},
			},
			{ ...options }
		);
	}
	async send(jid: string, options: Record<string, unknown> = {}): Promise<any> {
		if (this._buttons.length < 1) throw new Error('ButtonV2 requires at least one button');
		const msg = await this.build(jid, options);
		await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [
				{
					tag: 'biz',
					attrs: {},
					content: [
						{
							tag: 'interactive',
							attrs: { type: 'native_flow', v: '1' },
							content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
						},
					],
				},
			],
			...options,
		});
		return msg;
	}
}
class Carousel extends BaseBuilder {
	#client: any;
	private _cards: Record<string, unknown>[];
	constructor(client: any) {
		super();
		if (!client) throw new Error('Socket is required');
		this.#client = client;
		this._cards = [];
	}
	addCard(card: Record<string, unknown> | Record<string, unknown>[]): this {
		const cards = Array.isArray(card) ? card : [card];
		const baseIndex = this._cards.length;
		for (const [index, c] of cards.entries()) {
			if (!(c?.header as any)?.hasMediaAttachment) {
				throw new Error(`Card [${baseIndex + index}] must include an image or video in header`);
			}
		}
		this._cards.push(...cards);
		return this;
	}
	build(jid: string, options: Record<string, unknown> = {}): any {
		return generateWAMessageFromContent(
			jid,
			{
				...this._extraPayload,
				interactiveMessage: {
					header: { hasMediaAttachment: false },
					body: { text: this._body },
					footer: { text: this._footer },
					contextInfo: this._contextInfo,
					carouselMessage: { cards: this._cards },
				},
			},
			{ ...options }
		);
	}
	async send(jid: string, options: Record<string, unknown> = {}): Promise<any> {
		const msg = this.build(jid, options);
		await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [
				{
					tag: 'biz',
					attrs: {},
					content: [
						{
							tag: 'interactive',
							attrs: { type: 'native_flow', v: '1' },
							content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
						},
					],
				},
			],
			...options,
		});
		return msg;
	}
}
class AIRich extends BaseBuilder {
	#client: any;
	private _submessages: Record<string, unknown>[];
	private _sections: Record<string, unknown>[];
	private _richResponseSources: Record<string, unknown>[];
	constructor(client: any) {
		if (!client) throw new Error('Socket is required');
		super();
		this.#client = client;
		this._contextInfo = {};
		this._submessages = [];
		this._sections = [];
		this._richResponseSources = [];
	}
	addSubmessage(submessage: Record<string, unknown> | Record<string, unknown>[]): this {
		const items = Array.isArray(submessage) ? submessage : [submessage];
		for (const item of items) {
			if (typeof item !== 'object' || item === null || Array.isArray(item)) {
				throw new TypeError('Submessage must be a plain object or array of plain objects');
			}
			this._submessages.push(item);
		}
		return this;
	}
	addSection(section: Record<string, unknown> | Record<string, unknown>[]): this {
		const items = Array.isArray(section) ? section : [section];
		for (const item of items) {
			if (typeof item !== 'object' || item === null || Array.isArray(item)) {
				throw new TypeError('Section must be a plain object or array of plain objects');
			}
			this._sections.push(item);
		}
		return this;
	}
	addText(text: string, { hyperlink = true, citation = true, latex = true }: { hyperlink?: boolean; citation?: boolean; latex?: boolean } = {}): this {
		if (typeof text !== 'string') throw new TypeError('Text must be a string');
		const { text: extractedText, inline_entities } = extractIE(text, { hyperlink, citation, latex });
		this._submessages.push({ messageType: 2, messageText: extractedText });
		this._sections.push(
			AIRich.newLayout('Single', {
				text: extractedText,
				...(inline_entities.length && { inline_entities }),
				__typename: 'GenAIMarkdownTextUXPrimitive',
			})
		);
		return this;
	}
	addCode(language: string, code: string): this {
		if (typeof language !== 'string' || typeof code !== 'string') throw new TypeError('Language and code must be a string');
		const meta = AIRich.tokenizer(code, language);
		this._submessages.push({ messageType: 5, codeMetadata: { codeLanguage: language, codeBlocks: meta.codeBlock } });
		this._sections.push(AIRich.newLayout('Single', { language, code_blocks: meta.unified_codeBlock, __typename: 'GenAICodeUXPrimitive' }));
		return this;
	}
	addTable(table: string[][], { hyperlink = true, citation = true, latex = true }: { hyperlink?: boolean; citation?: boolean; latex?: boolean } = {}): this {
		if (!Array.isArray(table)) throw new TypeError('Table must be an array');
		const meta = AIRich.toTableMetadata(table, { hyperlink, citation, latex });
		this._submessages.push({ messageType: 4, tableMetadata: { title: meta.title, rows: meta.rows } });
		this._sections.push(AIRich.newLayout('Single', { rows: meta.unified_rows, __typename: 'GenATableUXPrimitive' }));
		return this;
	}
	addSource(sources: string[] | string[][]): this {
		if (
			!(
				Array.isArray(sources) &&
				(sources.every((item) => typeof item === 'string') || sources.every((item) => Array.isArray(item) && (item as string[]).every((v) => typeof v === 'string')))
			)
		) {
			throw new TypeError('Sources must be a string array or an array of string arrays');
		}
		let normalized = sources as string[][];
		if ((sources as string[]).every((item) => typeof item === 'string')) {
			normalized = [sources as string[]];
		}
		const source = normalized.map(([icon, url, text]) => ({
			source_type: 'THIRD_PARTY',
			source_display_name: text ?? '',
			source_subtitle: 'AI',
			source_url: url ?? '',
			favicon: {
				// favicon resolved via Toolkit.resolveMedia — supports buffer/base64/URL
				url: Toolkit.resolveMedia(this.#client, icon ?? '', 'image'),
				mime_type: 'image/jpeg',
				width: 16,
				height: 16,
			},
		}));

		this._sections.push(AIRich.newLayout('Single', { sources: source, __typename: 'GenAISearchResultPrimitive' }));
		return this;
	}
	addReels(reelsItems: ReelItem | ReelItem[]): this {
		if (
			!(
				(reelsItems && typeof reelsItems === 'object' && !Array.isArray(reelsItems)) ||
				(Array.isArray(reelsItems) && (reelsItems as ReelItem[]).every((item) => item && typeof item === 'object' && !Array.isArray(item)))
			)
		) {
			throw new TypeError('Reels items must be an object or an array of objects');
		}
		const list: ReelItem[] = Array.isArray(reelsItems) ? reelsItems : [reelsItems];
		const reels = list.map((item) => ({
			...item,
			_avatar: Toolkit.resolveMedia(this.#client, item.profileIconUrl ?? item.profile_url ?? item.profile ?? '', 'image'),
			_thumbnail: Toolkit.resolveMedia(this.#client, item.thumbnailUrl ?? item.thumbnail ?? '', 'image'),
		}));

		this._submessages.push({
			messageType: 9,
			contentItemsMetadata: {
				contentType: 1,
				itemsMetadata: reels.map((item) => ({
					reelItem: {
						title: item.username ?? '',
						profileIconUrl: (item as any)._avatar,
						thumbnailUrl: (item as any)._thumbnail,
						videoUrl: item.videoUrl ?? item.url ?? '',
					},
				})),
			},
		});
		reels.forEach((item, idx) => {
			this._richResponseSources.push({
				provider: '\u004E\u0049\u0058\u0045\u004C',
				thumbnailCDNURL: (item as any)._thumbnail,
				sourceProviderURL: item.videoUrl ?? item.url ?? '',
				sourceQuery: '',
				faviconCDNURL: (item as any)._avatar,
				citationNumber: idx + 1,
				sourceTitle: item.username ?? '',
			});
		});
		this._sections.push(
			AIRich.newLayout(
				'HScroll',
				reels.map((item) => ({
					reels_url: item.videoUrl ?? item.url ?? '',
					thumbnail_url: (item as any)._thumbnail,
					creator: item.username ?? item.title ?? '',
					avatar_url: (item as any)._avatar,
					reels_title: item.reels_title ?? item.title ?? '',
					likes_count: item.likes_count ?? item.like ?? 0,
					shares_count: item.shares_count ?? item.share ?? 0,
					view_count: item.view_count ?? item.view ?? 0,
					reel_source: item.reel_source ?? item.source ?? 'IG',
					is_verified: !!(item.is_verified || item.verified),
					__typename: 'GenAIReelPrimitive',
				}))
			)
		);

		return this;
	}
	addImage(imageUrl: string | Buffer | (string | Buffer)[], { resolveUrl = false }: { resolveUrl?: boolean } = {}): this {
		if (!(typeof imageUrl === 'string' || Buffer.isBuffer(imageUrl) || (Array.isArray(imageUrl) && (imageUrl as (string | Buffer)[]).every((v) => typeof v === 'string' || Buffer.isBuffer(v))))) {
			throw new TypeError('imageUrl must be string | buffer | array of string/buffer');
		}
		const makeEntry = (v: string | Buffer) => {
			const url = Toolkit.resolveMedia(this.#client, v, 'image', { resolveUrl });
			return { imagePreviewUrl: url, imageHighResUrl: url, sourceUrl: url };
		};
		const list = Array.isArray(imageUrl) ? (imageUrl as (string | Buffer)[]).map(makeEntry) : [makeEntry(imageUrl as string | Buffer)];
		this._submessages.push({
			messageType: 1,
			gridImageMetadata: {
				gridImageUrl: { imagePreviewUrl: list[0]?.imagePreviewUrl },
				imageUrls: list,
			},
		});
		list.forEach(({ imagePreviewUrl }) => {
			this._sections.push(
				AIRich.newLayout('Single', {
					media: { url: imagePreviewUrl, mime_type: 'image/png' },
					imagine_type: 'IMAGE',
					status: { status: 'READY' },
					__typename: 'GenAIImaginePrimitive',
				})
			);
		});

		return this;
	}
	addVideo(videoUrl: string | Buffer | VideoInput | (string | Buffer | VideoInput)[], { autoFill = true }: { autoFill?: boolean } = {}): this {
		const isObjectVideo = (v: unknown): v is VideoInput => !!v && typeof v === 'object' && !Buffer.isBuffer(v) && !!(v as VideoInput).url;
		const isValidPrimitive =
			typeof videoUrl === 'string' ||
			Buffer.isBuffer(videoUrl) ||
			isObjectVideo(videoUrl) ||
			(Array.isArray(videoUrl) && (videoUrl as unknown[]).every((v) => typeof v === 'string' || Buffer.isBuffer(v) || isObjectVideo(v)));
		if (!isValidPrimitive) throw new TypeError('videoUrl must be string | buffer | object | array');		
		const items = Array.isArray(videoUrl) ? videoUrl : [videoUrl];
		this._submessages.push({ messageType: 2, messageText: '[ CANNOT_LOAD_VIDEO - \u004E\u0049\u0058\u0045\u004C ]' });
		
		(items as (string | Buffer | VideoInput)[]).forEach((item) => {
			const isObj = isObjectVideo(item);
			const url = isObj
				? Toolkit.resolveMedia(this.#client, (item as VideoInput).url as string | Buffer, 'video')
				: Toolkit.resolveMedia(this.#client, item as string | Buffer, 'video');
			const bufferPromise = autoFill ? Promise.resolve(url).then((u) => Toolkit.fetchBuffer(u as string)) : null;
			const file_length = isObj && (item as VideoInput).file_length != null ? (item as VideoInput).file_length : autoFill ? bufferPromise!.then((b) => (b as Buffer)?.length ?? 0) : 0;
			const duration =
				isObj && (item as VideoInput).duration != null
					? (item as VideoInput).duration
					: autoFill
						? bufferPromise!.then((b) => Toolkit.getMp4Duration(b as Buffer, { silent: true }))
						: 0;
			const thumbnail =
				isObj && (item as VideoInput).thumbnail
					? Toolkit.resolveMedia(this.#client, (item as VideoInput).thumbnail!, 'image', { result: 'base64', resize: true, width: 300, height: 300 })
					: autoFill && bufferPromise
						? bufferPromise.then((b) => Toolkit.getMp4Preview(b as Buffer, { time: 0, result: 'base64' }))
						: null;
			this._sections.push(
				AIRich.newLayout('Single', {
					media: {
						url,
						mime_type: isObj ? ((item as VideoInput).mime_type ?? 'video/mp4') : 'video/mp4',
						file_length,
						duration,
					},
					imagine_type: 'ANIMATE',
					status: { status: 'READY' },
					thumbnail: { raw_media: thumbnail },
					__typename: 'GenAIImaginePrimitive',
				})
			);
		});
		return this;
	}
	addProduct(data: ProductItem | ProductItem[]): this {
		if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && (data as ProductItem[]).every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
			throw new TypeError('Product items must be an object or an array of objects');
		}
		this._submessages.push({ messageType: 2, messageText: '[ CANNOT_LOAD_PRODUCT - NIXEL ]' });
		const items: ProductItem[] = Array.isArray(data) ? data : [data];
		const product = items.map((item) => ({
			title: item.title,
			brand: item.brand,
			price: item.price,
			sale_price: item.sale_price,
			product_url: item.product_url ?? item.url,
			image: { url: Toolkit.resolveMedia(this.#client, (item.image_url ?? item.image) as string | Buffer, 'image') },
			additional_images: [{ url: Toolkit.resolveMedia(this.#client, (item.icon_url ?? item.icon) as string | Buffer, 'image') }],
			__typename: 'GenAIProductItemCardPrimitive',
		}));
		this._sections.push(AIRich.newLayout(Array.isArray(data) ? 'HScroll' : 'Single', Array.isArray(data) ? product : product[0]));
		return this;
	}
	addPost(data: PostItem | PostItem[]): this {
		if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && (data as PostItem[]).every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
			throw new TypeError('Post items must be an object or an array of objects');
		}
		const posts: PostItem[] = Array.isArray(data) ? data : [data];
		this._submessages.push({ messageType: 2, messageText: '[ CANNOT_LOAD_POST - NIXEL ]' });
		const primitives = posts.map((p) => ({
			title: p.title ?? '',
			subtitle: p.subtitle ?? '',
			username: p.username ?? '',
			profile_picture_url: Toolkit.resolveMedia(this.#client, (p.profile_picture_url ?? p.profile_url ?? p.profile ?? '') as string | Buffer, 'image'),
			is_verified: !!(p.is_verified || p.verified),
			thumbnail_url: Toolkit.resolveMedia(this.#client, (p.thumbnail_url ?? p.thumbnail ?? '') as string | Buffer, 'image'),
			post_caption: p.post_caption ?? p.caption ?? '',
			likes_count: p.likes_count ?? p.like ?? 0,
			comments_count: p.comments_count ?? p.comment ?? 0,
			shares_count: p.shares_count ?? p.share ?? 0,
			post_url: p.post_url ?? p.url ?? '',
			post_deeplink: p.post_deeplink ?? p.deeplink ?? '',
			source_app: p.source_app || p.source || 'INSTAGRAM',
			footer_label: p.footer_label ?? p.footer ?? '',
			footer_icon: Toolkit.resolveMedia(this.#client, (p.footer_icon ?? p.icon ?? '') as string | Buffer, 'image'),
			is_carousel: posts.length > 1,
			orientation: p.orientation ?? 'LANDSCAPE',
			post_type: p.post_type ?? 'VIDEO',
			__typename: 'GenAIPostPrimitive',
		}));
		this._sections.push(AIRich.newLayout('HScroll', primitives));
		return this;
	}
	addTip(text: string): this {
		this._submessages.push({ messageType: 2, messageText: text });
		this._sections.push(AIRich.newLayout('Single', { text, __typename: 'GenAIMetadataTextPrimitive' }));
		return this;
	}
	addSuggest(suggestion: string | string[], { scroll = true, layout }: { scroll?: boolean; layout?: SuggestLayout } = {}): this {
		if (!(typeof suggestion === 'string' || (Array.isArray(suggestion) && (suggestion as string[]).every((v) => typeof v === 'string')))) {
			throw new TypeError('Suggestion must be a string or array of strings');
		}
		const suggest = Array.isArray(suggestion)
			? (suggestion as string[]).map((text) => ({ prompt_text: text, prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' }))
			: [{ prompt_text: suggestion as string, prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' }];
		const type: SuggestLayout = layout ?? (suggest.length === 1 ? 'Single' : scroll ? 'HScroll' : 'ActionRow');
		this._sections.push(AIRich.newLayout(type, type === 'Single' ? suggest[0] : suggest, { __typename: 'GenAIUnifiedResponseSection' }));
		return this;
	}
	async build({
		forwarded = true,
		notification = false,
		includesUnifiedResponse = true,
		includesSubmessages = true,
		quoted,
		quotedParticipant,
		...options
	}: {
		forwarded?: boolean;
		notification?: boolean;
		includesUnifiedResponse?: boolean;
		includesSubmessages?: boolean;
		quoted?: any;
		quotedParticipant?: string;
		[key: string]: unknown;
	} = {}): Promise<Record<string, unknown>> {
		const forward = forwarded
			? { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: '0@bot' }, forwardOrigin: 4 }
			: {};
		const notif = notification
			? {
					sessionTransparencyMetadata: {
						disclaimerText: '~ Ahmad tumbuh kembang',
						hcaId: `hca_${Date.now()}`,
						sessionTransparencyType: 1,
					},
				}
			: {};
		const qObj = quoted
			? {
					stanzaId: quoted?.key?.id || quoted?.id,
					participant: quotedParticipant || quoted?.key?.participant || quoted?.key?.remoteJid,
					quotedType: 0,
					quotedMessage: typeof quoted === 'object' && quoted !== null ? quoted.message ?? quoted : undefined,
				}
			: {};
		const resolvedSections = await waitAllPromises(this._sections);
		const sections = this._footer
			? [
					...resolvedSections,
					AIRich.newLayout('Single', { text: this._footer, __typename: 'GenAIMetadataTextPrimitive' }),
				]
			: [...resolvedSections];
		return {
			messageContextInfo: {
				deviceListMetadata: {},
				deviceListMetadataVersion: 2,
				botMetadata: {
					messageDisclaimerText: this._title,
					richResponseSourcesMetadata: { sources: this._richResponseSources },
					...notif,
				},
			},
			...this._extraPayload,
			botForwardedMessage: {
				message: {
					richResponseMessage: {
						messageType: 1,
						submessages: includesSubmessages ? await waitAllPromises(this._submessages) : [],
						unifiedResponse: {
							data: includesUnifiedResponse ? Buffer.from(JSON.stringify({ response_id: crypto.randomUUID(), sections })).toString('base64') : '',
						},
						contextInfo: {
							...forward,
							...qObj,
							...this._contextInfo,
						},
					},
				},
			},
		};
	}
	async send(
		jid: string,
		{
			forwarded,
			notification,
			includesUnifiedResponse,
			includesSubmessages,
			...options
		}: {
			forwarded?: boolean;
			notification?: boolean;
			includesUnifiedResponse?: boolean;
			includesSubmessages?: boolean;
			[key: string]: unknown;
		} = {}
	): Promise<any> {
		const msg = await this.build({ forwarded, notification, includesUnifiedResponse, includesSubmessages, ...options });
		return await this.#client.relayMessage(jid, msg, { ...options });
	}
	static tokenizer(code: string, lang = 'javascript') {
		const keywordsMap: Record<string, Set<string>> = {
			javascript: new Set([
				'break', 'case', 'catch', 'continue', 'debugger', 'delete', 'do', 'else', 'finally',
				'for', 'function', 'if', 'in', 'instanceof', 'new', 'return', 'switch', 'this', 'throw',
				'try', 'typeof', 'var', 'void', 'while', 'with', 'true', 'false', 'null', 'undefined',
				'class', 'const', 'let', 'super', 'extends', 'export', 'import', 'yield', 'static',
				'constructor', 'async', 'await', 'get', 'set',
			]),
			typescript: new Set([
				'abstract', 'any', 'as', 'asserts', 'bigint', 'boolean', 'declare', 'enum', 'implements',
				'infer', 'interface', 'is', 'keyof', 'module', 'namespace', 'never', 'readonly', 'require',
				'number', 'object', 'override', 'private', 'protected', 'public', 'satisfies', 'string',
				'symbol', 'type', 'unknown', 'using', 'from', 'break', 'case', 'catch', 'continue', 'do',
				'else', 'finally', 'for', 'function', 'if', 'new', 'return', 'switch', 'this', 'throw',
				'try', 'var', 'void', 'while', 'class', 'const', 'let', 'extends', 'import', 'export',
				'async', 'await',
			]),
			python: new Set([
				'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
				'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
				'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
				'try', 'while', 'with', 'yield',
			]),
			java: new Set([
				'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const',
				'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float',
				'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native',
				'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
				'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void',
				'volatile', 'while',
			]),
			golang: new Set([
				'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough',
				'for', 'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range',
				'return', 'select', 'struct', 'switch', 'type', 'var',
			]),
			c: new Set([
				'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else',
				'enum', 'extern', 'float', 'for', 'goto', 'if', 'int', 'long', 'register', 'return',
				'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned',
				'void', 'volatile', 'while',
			]),
			cpp: new Set([
				'alignas', 'alignof', 'and', 'auto', 'bool', 'break', 'case', 'catch', 'class', 'const',
				'constexpr', 'continue', 'delete', 'do', 'double', 'else', 'enum', 'explicit', 'export',
				'extern', 'false', 'float', 'for', 'friend', 'if', 'inline', 'int', 'long', 'mutable',
				'namespace', 'new', 'noexcept', 'nullptr', 'operator', 'private', 'protected', 'public',
				'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'template', 'this',
				'throw', 'true', 'try', 'typedef', 'typename', 'union', 'unsigned', 'using', 'virtual',
				'void', 'while',
			]),
			php: new Set([
				'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch', 'class', 'clone',
				'const', 'continue', 'declare', 'default', 'do', 'echo', 'else', 'elseif', 'empty',
				'enddeclare', 'endfor', 'endforeach', 'endif', 'endswitch', 'endwhile', 'extends', 'final',
				'finally', 'fn', 'for', 'foreach', 'function', 'global', 'goto', 'if', 'implements',
				'include', 'include_once', 'instanceof', 'interface', 'match', 'namespace', 'new', 'null',
				'or', 'private', 'protected', 'public', 'require', 'require_once', 'return', 'static',
				'switch', 'throw', 'trait', 'try', 'use', 'var', 'while', 'yield',
			]),
			rust: new Set([
				'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern', 'false', 'fn',
				'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref',
				'return', 'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe',
				'use', 'where', 'while',
			]),
			html: new Set([
				'html', 'head', 'body', 'div', 'span', 'p', 'a', 'img', 'video', 'audio', 'script',
				'style', 'link', 'meta', 'form', 'input', 'button', 'table', 'tr', 'td', 'th', 'ul',
				'ol', 'li', 'section', 'article', 'header', 'footer', 'nav', 'main',
			]),
			bash: new Set([
				'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac',
				'function', 'in', 'select', 'until', 'break', 'continue', 'return', 'export', 'readonly',
				'local', 'declare',
			]),
			markdown: new Set(['#', '##', '###', '####', '#####', '######']),
		};
		if (!lang || lang === 'txt' || lang === 'text' || lang === 'plaintext') {
			return {
				codeBlock: [{ codeContent: code, highlightType: 0 }],
				unified_codeBlock: [{ content: code, type: 'DEFAULT' }],
			};
		}
		const TYPE_MAP: Record<number, string> = { 0: 'DEFAULT', 1: 'KEYWORD', 2: 'METHOD', 3: 'STR', 4: 'NUMBER', 5: 'COMMENT' };
		const keywords = keywordsMap[lang.toLowerCase()] || new Set<string>();
		const tokens: { codeContent: string; highlightType: number }[] = [];
		let i = 0;
		const push = (content: string, type: number) => {
			if (!content) return;
			const last = tokens[tokens.length - 1];
			if (last && last.highlightType === type) last.codeContent += content;
			else tokens.push({ codeContent: content, highlightType: type });
		};
		const isIdentifier = (char: string): boolean => {
			switch (lang.toLowerCase()) {
				case 'css':  return /[a-zA-Z0-9_$-]/.test(char);
				case 'html': return /[a-zA-Z0-9_$:-]/.test(char);
				default:     return /[a-zA-Z0-9_$]/.test(char);
			}
		};
		while (i < code.length) {
			const c = code[i];
			if (/\s/.test(c)) {
				let s = i;
				while (i < code.length && /\s/.test(code[i])) i++;
				push(code.slice(s, i), 0);
				continue;
			}
			if ((c === '/' && code[i + 1] === '/') || (c === '#' && ['python', 'bash'].includes(lang.toLowerCase()))) {
				let s = i;
				while (i < code.length && code[i] !== '\n') i++;
				push(code.slice(s, i), 5);
				continue;
			}
			if (c === '"' || c === "'" || c === '`') {
				let s = i;
				const q = c;
				i++;
				while (i < code.length) {
					if (code[i] === '\\' && i + 1 < code.length) i += 2;
					else if (code[i] === q) { i++; break; }
					else i++;
				}
				push(code.slice(s, i), 3);
				continue;
			}
			if (/[0-9]/.test(c)) {
				let s = i;
				while (i < code.length && /[0-9._]/.test(code[i])) i++;
				push(code.slice(s, i), 4);
				continue;
			}
			if (/[a-zA-Z_$]/.test(c)) {
				let s = i;
				while (i < code.length && isIdentifier(code[i])) i++;
				const word = code.slice(s, i);
				let type = 0;
				if (keywords.has(word)) {
					type = 1;
				} else if (lang.toLowerCase() === 'css') {
					let j = i;
					while (j < code.length && /\s/.test(code[j])) j++;
					if (code[j] === ':') type = 1;
				} else if (lang.toLowerCase() === 'html') {
					let p = s - 1;
					while (p >= 0 && /\s/.test(code[p])) p--;
					if (code[p] === '<' || (code[p] === '/' && code[p - 1] === '<')) type = 1;
				}
				if (type === 0) {
					let j = i;
					while (j < code.length && /\s/.test(code[j])) j++;
					if (code[j] === '(') type = 2;
				}
				push(word, type);
				continue;
			}
			push(c, 0);
			i++;
		}
		return {
			codeBlock: tokens,
			unified_codeBlock: tokens.map((t) => ({ content: t.codeContent, type: TYPE_MAP[t.highlightType] })),
		};
	}
	static toTableMetadata(arr: string[][], { hyperlink = true, citation = true, latex = true }: { hyperlink?: boolean; citation?: boolean; latex?: boolean } = {}) {
		if (!Array.isArray(arr) || !arr.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'))) {
			throw new TypeError('Table must be a nested array of strings');
		}
		const [header, ...rows] = arr;
		const maxLen = Math.max(header.length, ...rows.map((r) => r.length));
		const normalize = (r: string[]) => [...r, ...Array(maxLen - r.length).fill('')];
		const unified_rows = [
			{ is_header: true, cells: normalize(header) },
			...rows.map((r) => ({ is_header: false, cells: normalize(r) })),
		].map((row) => {
			const markdown_cells = row.cells.map((cell) => {
				const extracted = extractIE(cell, { hyperlink, citation, latex });
				return {
					text: extracted.text,
					...(extracted.inline_entities.length ? { inline_entities: extracted.inline_entities } : {}),
				};
			});
			return {
				...row,
				...(markdown_cells.some((c) => c.inline_entities?.length) ? { markdown_cells } : {}),
			};
		});
		const rowsMeta = unified_rows.map((r) => ({
			items: r.cells,
			...(r.is_header ? { isHeading: true } : {}),
		}));

		return { title: '', rows: rowsMeta, unified_rows };
	}
	static newLayout(name: string, data: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
		return {
			...extra,
			view_model: {
				[Array.isArray(data) ? 'primitives' : 'primitive']: data,
				__typename: `GenAI${name}LayoutViewModel`,
			},
		};
	}
}

export { VERSION, Button, ButtonV2, Carousel, AIRich, Toolkit };
