import { sendMsg } from '../core/api.js'
import type { TgPlugin } from '../core/types.js'

async function runExec(chatId: number | string, args: string) {
  if (!args) return void sendMsg(chatId, '❌ Format: /exec <kode JS>')
  try {
    const util = (await import('util')).default
    const code = args.replace(/[\u200e\u200f\u200b\u200d\u2028\u2029\ufeff\u00a0]/g, ' ').trim()
    const result = await eval(`(async () => { return ${code} })()`)
    let output = util.format(result)
    if (output.length > 3800) output = output.slice(0, 3800) + '\n...(terpotong)'
    await sendMsg(chatId, `📤 *Result*\n\n\`\`\`\n${output}\n\`\`\``)
  } catch (e) { await sendMsg(chatId, `❌ *Error*\n\n\`\`\`\n${(e as Error).message}\n\`\`\``) }
}

async function runEval(chatId: number | string, args: string) {
  if (!args) return void sendMsg(chatId, '❌ Format: /eval <kode JS>')
  try {
    const util = (await import('util')).default
    const code = args.replace(/[\u200e\u200f\u200b\u200d\u2028\u2029\ufeff\u00a0]/g, ' ').trim()
    let evaled: unknown
    try { evaled = await eval(`(async () => { return ${code} })()`) }
    catch { evaled = await eval(`(async () => { ${code} })()`) }
    if (evaled === undefined) evaled = '✅ Done (no return value)'
    let output = typeof evaled === 'string' ? evaled : util.inspect(evaled, { depth: 3 })
    if (output.length > 3800) output = output.slice(0, 3800) + '\n...(terpotong)'
    await sendMsg(chatId, `✅ *Eval*\n\n\`\`\`\n${output}\n\`\`\``)
  } catch (e) { await sendMsg(chatId, `❌ *Eval Error*\n\n\`\`\`\n${(e as Error).message}\n\`\`\``) }
}

async function runShell(chatId: number | string, args: string) {
  if (!args) return void sendMsg(chatId, '❌ Format: /shell <command>')
  try {
    const { promisify } = await import('util')
    const { exec }      = await import('child_process')
    const execP         = promisify(exec)
    const { stdout, stderr } = await execP(args, { timeout: 30000 })
    if (stderr) return void sendMsg(chatId, `⚠️ *stderr*\n\n\`\`\`\n${stderr.slice(0, 3800)}\n\`\`\``)
    const out = stdout?.trim() || '✅ Command executed (no output)'
    await sendMsg(chatId, `📤 *stdout*\n\n\`\`\`\n${out.slice(0, 3800)}\n\`\`\``)
  } catch (e) { await sendMsg(chatId, `❌ *Shell Error*\n\n\`\`\`\n${(e as Error).message}\n\`\`\``) }
}

// NB: satu file bisa daftar >1 command, tapi karena masing-masing perlu
// implementasi berbeda, kita split jadi 3 default export gabungan lewat
// array pattern tidak didukung _pluginmanager (1 default = 1 plugin),
// jadi command exec/eval/shell tetap 1 file tapi dispatch manual di dalam.
export default {
  command:  ['exec', 'eval', 'shell'],
  category: 'owner',
  owner:    true,
  help:     '💻 /exec /eval /shell <cmd> — Eksekusi kode/perintah',

  handler: async (chatId, args, ctx) => {
    // ctx.raw.text menyimpan pesan asli, dari situ kita tahu command mana yang dipanggil
    const cmd = (ctx.raw.text || ctx.raw.caption || '').trim().split(' ')[0].toLowerCase().replace('/', '')
    if (cmd === 'eval')  return runEval(chatId, args)
    if (cmd === 'shell') return runShell(chatId, args)
    return runExec(chatId, args)
  }
} satisfies TgPlugin
