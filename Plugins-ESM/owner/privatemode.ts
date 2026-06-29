import { isPrivateMode, setPrivateMode } from '../../System/privatemode.js'
import { botName, ownerName } from '../../Library/utils.js'

const handler = async (m: any, { Morela, command, args, fkontak }: any) => {
    let mode = (args[0] || '').toLowerCase()

    const sendInteractive = async (headerTitle: string, bodyText: string) => {
        const { generateWAMessageFromContent } = await import('@itsliaaa/baileys')
        const { getMainOwner } = await import('../../System/mainowner.js')

        const mainOwnerNum = getMainOwner()
        const now = new Date()
        const end = new Date(now.getTime() + 10 * 60000)

        const buttons: any[] = []
        if (mainOwnerNum) {
            buttons.push({
                name: 'booking_confirmation',
                buttonParamsJson: JSON.stringify({
                    start_datetime:        now.toISOString(),
                    end_datetime:          end.toISOString(),
                    location:              '🇮🇩Indonesia🇮🇩',
                    booking_url:           `https://wa.me/${mainOwnerNum}`,
                    phone_number:          mainOwnerNum,
                    booking_management_url: `https://wa.me/${mainOwnerNum}`,
                    description:
                        `*◦ 👤 Name  :*  ${ownerName}\n` +
                        `*◦ 👑 Status  :*  _Real Owner_\n`,
                    email: '',
                    display_text: `👑 ᴍᴀɪɴ ᴏᴡɴᴇʀ`,
                    display_content: {
                        display_language:                  'id',
                        display_meeting_type:              'ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ',
                        display_bottom_sheet_header:       '々   P R O F I L E     ◦     I N F O   々',
                        display_add_to_calendar_cta_text:  'CALENDAR',
                        display_view_on_maps_cta_text:     'O W N E R     ◦     C O U N T R Y',
                        display_manage_booking_cta_text:   'Follow for More',
                        display_manage_booking_not_supported_text: 'OWNER NOT REGISTERED',
                        display_read_more:                 'READ MORE'
                    }
                })
            })
        } else {
            buttons.push({
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: `👑 ᴍᴀɪɴ ᴏᴡɴᴇʀ`,
                    url: `https://wa.me/${mainOwnerNum}`,
                    merchant_url: `https://wa.me/${mainOwnerNum}`
                })
            })
        }

        const msg = generateWAMessageFromContent(
            m.chat,
            {
                interactiveMessage: {
                    header: {
                        title: headerTitle,
                        hasMediaAttachment: false
                    },
                    body: {
                        text: bodyText
                    },
                    footer: {
                        text: `© ${botName}`
                    },
                    nativeFlowMessage: {
                        messageParamsJson: '{}',
                        buttons
                    }
                }
            },
            { userJid: mainOwnerNum ? `${mainOwnerNum}@s.whatsapp.net` : Morela.user.id, quoted: fkontak || m }
        )

        await Morela.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    }

    if (mode === 'status' || mode === 'cek') {
        const status = isPrivateMode()
        return sendInteractive(
            status ? '𝗣 𝗥 𝗜 𝗩 𝗔 𝗧 𝗘   ◦   𝗠 𝗢 𝗗 𝗘' : '𝗣 𝗨 𝗕 𝗟 𝗜 𝗖   ◦   𝗠 𝗢 𝗗 𝗘',
            `*乂  ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ   ◦   ꜱᴛᴀᴛᴜꜱ*\n` +
            `✧ ꜱᴛᴀᴛᴜꜱ : ${status ? '🟢 *ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ ᴀᴋᴛɪꜰ*' : '🔴 *ᴘᴜʙʟɪᴄ ᴍᴏᴅᴇ*'}\n` +
            (status
                ? `✧ ɪɴꜰᴏ : _Bot ʜᴀɴʏᴀ ʀᴇꜱᴘᴏɴ ᴏᴡɴᴇʀ ᴅɪ ᴘᴇꜱᴀɴ ᴘʀɪʙᴀᴅɪ_`
                : `✧ ɪɴꜰᴏ : _Bot ʀᴇꜱᴘᴏɴ ꜱᴇᴍᴜᴀ ᴜꜱᴇʀ ᴅɪ ᴘᴇꜱᴀɴ ᴘʀɪʙᴀᴅɪ_`)
        )
    }

    if (!mode || mode === 'on' || mode === 'aktif' || mode === 'enable') {
        if (isPrivateMode()) {
            return sendInteractive(
                '𝗣 𝗥 𝗜 𝗩 𝗔 𝗧 𝗘   ◦   𝗠 𝗢 𝗗 𝗘',
                `*乂  ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ   ◦   ɪɴꜰᴏ*\n` +
                `✧ ꜱᴛᴀᴛᴜꜱ : 🟢 *ꜱᴜᴅᴀʜ ᴀᴋᴛɪꜰ*\n` +
                `✧ ɪɴꜰᴏ : _Private mode sudah aktif!_`
            )
        }
        setPrivateMode(true)
        return sendInteractive(
            '𝗣 𝗥 𝗜 𝗩 𝗔 𝗧 𝗘   ◦   𝗠 𝗢 𝗗 𝗘',
            `*乂  ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ   ◦   ᴅɪᴀᴋᴛɪꜰᴋᴀɴ*\n` +
            `✧ ꜱᴛᴀᴛᴜꜱ : 🟢 *ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ ᴀᴋᴛɪꜰ*\n` +
            `✧ ɪɴꜰᴏ : _Bot ʜᴀɴʏᴀ ʀᴇꜱᴘᴏɴ ᴏᴡɴᴇʀ ᴅɪ ᴘᴇꜱᴀɴ ᴘʀɪʙᴀᴅɪ_`
        )
    }

    if (mode === 'off' || mode === 'nonaktif' || mode === 'disable') {
        if (!isPrivateMode()) {
            return sendInteractive(
                '𝗣 𝗨 𝗕 𝗟 𝗜 𝗖   ◦   𝗠 𝗢 𝗗 𝗘',
                `*乂  ᴘᴜʙʟɪᴄ ᴍᴏᴅᴇ   ◦   ɪɴꜰᴏ*\n` +
                `✧ ꜱᴛᴀᴛᴜꜱ : 🔴 *ꜱᴜᴅᴀʜ ɴᴏɴᴀᴋᴛɪꜰ*\n` +
                `✧ ɪɴꜰᴏ : _Private mode sudah nonaktif!_`
            )
        }
        setPrivateMode(false)
        return sendInteractive(
            '𝗣 𝗨 𝗕 𝗟 𝗜 𝗖   ◦   𝗠 𝗢 𝗗 𝗘',
            `*乂  ᴍᴏᴅᴇ ᴘᴜʙʟɪᴄ   ◦   ᴅɪᴀᴋᴛɪꜰᴋᴀɴ*\n` +
            `✧ ꜱᴛᴀᴛᴜꜱ : 🔴 *ᴍᴏᴅᴇ ᴘᴜʙʟɪᴄ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ*\n` +
            `✧ ɪɴꜰᴏ : _Bot ʀᴇꜱᴘᴏɴ ꜱᴇᴍᴜᴀ ᴜꜱᴇʀ ᴅɪ ᴘᴇꜱᴀɴ ᴘʀɪʙᴀᴅɪ_`
        )
    }

    return sendInteractive(
        '𝗣 𝗥 𝗜 𝗩 𝗔 𝗧 𝗘   ◦   𝗠 𝗢 𝗗 𝗘',
        `*乂  ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ   ◦   ᴄᴏᴍᴍᴀɴᴅ*\n` +
        `✧ .privatemode        — ᴀᴋᴛɪꜰᴋᴀɴ ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ\n` +
        `✧ .privatemode on     — ᴀᴋᴛɪꜰᴋᴀɴ ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ\n` +
        `✧ .privatemode off    — ɴᴏɴᴀᴋᴛɪꜰᴋᴀɴ ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ\n` +
        `✧ .privatemode status — ᴄᴇᴋ ꜱᴛᴀᴛᴜꜱ\n` +
        `✧ .pvmode             — ꜱʜᴏʀᴛᴄᴜᴛ`
    )
}

handler.command = ['privatemode', 'pvmode']
handler.owner   = true
handler.tags    = ['owner']
handler.help    = ['privatemode / privatemode on/off/status']
handler.noLimit = true

export default handler
