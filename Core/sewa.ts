import chalk from 'chalk';
import type { ExtSocket } from '../types/global.js';
import { getExpiredSewa, delSewa, getPendingReminders, markReminderSent } from '../Database/sewagrub.js';
import { deleteGroup } from '../Database/db.js';
import { invalidateGroupCache } from '../Morela.js';
export async function checkAndLeaveExpiredSewa(Morela: ExtSocket): Promise<void> {
    try {
        const expired = getExpiredSewa();
        if (expired.length === 0) return;
        console.log(chalk.yellow(`[SEWA] ${expired.length} grup expired — mulai proses keluar...`));
        for (const entry of expired) {
            try {
                console.log(chalk.yellow(`[SEWA] Keluar dari: ${entry.groupName}`));
                await Morela.sendMessage(entry.groupId, {
                    text:
                        `⏰ *Masa sewa bot telah habis!*\n\n` +
                        `📛 Grup: *${entry.groupName}*\n` +
                        `📅 Expired: ${new Date(entry.expiryTimestamp).toLocaleDateString('id-ID', {
                            day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                        })}\n\n` +
                        `Bot otomatis keluar dari grup ini.\n` +
                        `Hubungi owner untuk memperpanjang sewa. 🙏\n\n` +
                        `© ${(global as any).botName ?? 'Morela'}`
                });
                await new Promise(r => setTimeout(r, 2000));
                await Morela.groupLeave(entry.groupId);
                deleteGroup(entry.groupId);
                invalidateGroupCache(entry.groupId);
                console.log(chalk.green(`[SEWA] Berhasil keluar: ${entry.groupName}`));
            } catch (e) {
                console.error(chalk.red(`[SEWA] ❌ Gagal keluar dari ${entry.groupId}:`, (e as Error).message));
            }
            delSewa(entry.groupId);
            await new Promise(r => setTimeout(r, 1500));
        }
    } catch (e) {
        console.error(chalk.red('[SEWA SCHEDULER] Error:', (e as Error).message));
    }
}
export async function checkAndSendSewaReminders(Morela: ExtSocket): Promise<void> {
    try {
        const pending = getPendingReminders();
        if (pending.length === 0) return;
        console.log(chalk.yellow(`[SEWA] ${pending.length} reminder siap dikirim...`));
        for (const { entry, reminderIndex, label } of pending) {
            try {
                const expiredDate = new Date(entry.expiryTimestamp).toLocaleDateString('id-ID', {
                    day:      '2-digit',
                    month:    'long',
                    year:     'numeric',
                    hour:     '2-digit',
                    minute:   '2-digit',
                    timeZone: 'Asia/Jakarta'
                });
                const icon =
                    reminderIndex === 0 ? '🟡' :
                    reminderIndex === 1 ? '🟠' :
                                         '🔴';
                const urgency =
                    reminderIndex === 0 ? '_Segera lakukan perpanjangan agar layanan tidak terganggu._' :
                    reminderIndex === 1 ? '_Waktu hampir habis! Perpanjang sekarang sebelum bot keluar otomatis._' :
                                         '*⚠️ INI PERINGATAN TERAKHIR! Bot akan keluar dalam 1 jam jika tidak diperpanjang!*';
                let allMentions: string[] = [];
                let mentionText = '';
                try {
                    const meta = await Morela.groupMetadata(entry.groupId);
                    if (meta?.participants?.length) {
                        allMentions = meta.participants.map((p: any) => p.id as string);
                        mentionText = '\n' + allMentions
                            .map((jid: string) => `@${jid.split('@')[0]}`)
                            .join(' ');
                    }
                } catch {}
                const reminderMsg =
                    `${icon} *Reminder Sewa Bot*\n\n` +
                    `Halo! Masa sewa bot di grup ini akan segera berakhir.\n\n` +
                    `╭──「 📋 *Detail Sewa* 」\n` +
                    `│  🏷️ Grup    : *${entry.groupName}*\n` +
                    `│  📅 Expired : *${expiredDate} WIB*\n` +
                    `│  ⏳ Sisa    : *${label} lagi*\n` +
                    `╰─────────────────────\n\n` +
                    `${urgency}\n\n` +
                    `Hubungi owner untuk perpanjangan:\n` +
                    `📞 ${entry.addedBy.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '')}\n\n` +
                    `© ${(global as any).botName ?? 'Morela'}` +
                    mentionText;
                await Morela.sendMessage(entry.groupId, {
                    text:     reminderMsg,
                    mentions: allMentions,
                });
                markReminderSent(entry.groupId, reminderIndex);
                console.log(chalk.green(`[SEWA] Reminder ${label} terkirim → ${entry.groupName} (${allMentions.length} member di-tag)`));
            } catch (e) {
                console.error(chalk.red(`[SEWA REMINDER] ❌ Gagal kirim ke ${entry.groupId}:`, (e as Error).message));
            }
            await new Promise(r => setTimeout(r, 1500));
        }
    } catch (e) {
        console.error(chalk.red('[SEWA REMINDER SCHEDULER] Error:', (e as Error).message));
    }
}
export function initSewaScheduler(Morela: ExtSocket): void {
    setTimeout(() => checkAndLeaveExpiredSewa(Morela), 15_000);
    setInterval(() => checkAndLeaveExpiredSewa(Morela), 5 * 60 * 1000);
    setTimeout(() => checkAndSendSewaReminders(Morela), 30_000);
    setInterval(() => checkAndSendSewaReminders(Morela), 15 * 60 * 1000);
}
