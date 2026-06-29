import { findParticipant, isParticipantAdmin, safeKickJid } from '../../Library/resolve.js'

export default {

    tags: ['group'],
    help: ['React 👍 ke pesan untuk kick member (admin only)'],

    handler: async (m, { Morela, fkontak }) => {
        try {

            if (!m.message?.reactionMessage) return

            const from = m.chat

            if (!from || !from.endsWith('@g.us')) return

            const reaction = m.message.reactionMessage.text
            if (reaction !== '👍') return

            console.log('[REACTION KICK] 👍 detected')

            let meta
            try {
                meta = await Morela.groupMetadata(from)
            } catch (e) {
                console.error('[REACTION KICK] Get metadata failed:', (e as Error).message)

                return
            }

            const senderRaw = m.key.participant || m.key.remoteJid
            // findParticipant: LID-safe dengan fallback getPhoneByLid, jadi admin
            // yang masuk lewat @lid (tanpa field p.lid ter-set) tetap terdeteksi.
            const senderParticipant = findParticipant(meta.participants, senderRaw)

            if (!isParticipantAdmin(senderParticipant)) {
                console.log('[REACTION KICK] Bukan admin, skip')
                return
            }

            console.log('[REACTION KICK] Admin confirmed')

            const reactedKey = m.message.reactionMessage.key
            const targetRaw = reactedKey?.participant || reactedKey?.remoteJid

            if (!targetRaw) {
                console.log('[REACTION KICK] Target not found')
                return
            }

            console.log('[REACTION KICK] Target:', targetRaw)

            const targetParticipant = findParticipant(meta.participants, targetRaw)

            if (!targetParticipant) {
                console.log('[REACTION KICK] Target not in group')

                return
            }

            if (isParticipantAdmin(targetParticipant)) {
                console.log('[REACTION KICK] Target is admin, skip')

                return
            }

            const kickJid = safeKickJid(targetParticipant)
            if (!kickJid) {
                console.log('[REACTION KICK] Target id tidak valid, skip')
                return
            }

            console.log('[REACTION KICK] Kicking:', kickJid)

            try {
                await Morela.groupParticipantsUpdate(
                    from,
                    [kickJid],
                    'remove'
                )

                console.log('[REACTION KICK] Success! (silent)')

            } catch (e) {
                console.error('[REACTION KICK] Kick failed:', (e as Error).message)

            }

        } catch (error) {
            console.error('[REACTION KICK] Unexpected error:', (error as Error).message)

        }
    }
}
