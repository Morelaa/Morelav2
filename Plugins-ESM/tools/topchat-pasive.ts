import { getFullDB as _getFullDB, replaceFullDB as _replaceFullDB } from '../../Database/chatcount.js'

let _saveTimer: ReturnType<typeof setTimeout> | null = null

function getDB(): Record<string, Record<string, { count: number; name: string }>> {

  if ((globalThis as any).__chatCountDB__) return (globalThis as any).__chatCountDB__

  const loaded = _getFullDB()
  ;(globalThis as any).__chatCountDB__ = loaded
  return loaded as any
}

function scheduleWrite(): void {
  if (_saveTimer) return 
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    try {
      const data = (globalThis as any).__chatCountDB__
      if (!data) return
      _replaceFullDB(data)
    } catch (e) {
      console.error('[TOPCHAT-PASIVE] save error:', (e as Error).message)
    }
  }, 5000)
}

function increment(db: Record<string, any>, scope: string, jid: string, name: string): void {
  if (!db[scope])           db[scope]       = {}
  if (!db[scope][jid])      db[scope][jid]  = { count: 0, name }
  db[scope][jid].count++

  if (name) db[scope][jid].name = name
}

export default {
  tags: ['passive', 'topchat'],

  handler: async (m: any, { isOwn }: any) => {
    try {

      if (!m.isGroup)                                    return 
      if (m.fromMe)                                      return 
      if (!m.message)                                    return 
      if (m.chat === 'status@broadcast')                 return 
      if (m.message?.reactionMessage)                    return 
      if (m.message?.protocolMessage)                    return 
      if (m.message?.senderKeyDistributionMessage)       return 
      if (m.message?.pollUpdateMessage)                  return 

      const from   = m.chat                              
      const sender = m.sender || m.key?.participant || m.key?.remoteJid
      if (!from || !sender)                              return

      const name = m.pushName || sender.split('@')[0]

      const db = getDB()
      increment(db, from,      sender, name)  
      increment(db, '_global', sender, name)  
      ;(globalThis as any).__chatCountDB__ = db

      scheduleWrite()

    } catch {

    }
  }
}
