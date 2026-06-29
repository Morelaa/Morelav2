export type BaileysStore = ReturnType<typeof makeCustomStore>;
export function makeCustomStore() {
    const store: {
        messages: Record<string, { array: unknown[] }>;
        groupMetadata: Record<string, unknown>;
        bind: (ev: unknown) => void;
    } = {
        messages: {},
        groupMetadata: {},
        bind(ev: unknown) {
            const _ev = ev as { on: (e: string, fn: (d: unknown) => void) => void };
            _ev.on('messages.upsert', (data: unknown) => {
                const { messages: msgs } = data as { messages: Array<{ key?: { remoteJid?: string } }> };
                for (const msg of msgs ?? []) {
                    const jid = msg?.key?.remoteJid;
                    if (!jid) continue;
                    if (!store.messages[jid]) store.messages[jid] = { array: [] };
                    store.messages[jid].array.push(msg);
                    if (store.messages[jid].array.length > 50)
                        store.messages[jid].array = store.messages[jid].array.slice(-50);
                }
            });
            _ev.on('groups.update', (updates: unknown) => {
                for (const g of (updates as Array<{ id?: string }>) ?? []) {
                    if (g.id) store.groupMetadata[g.id] = { ...((store.groupMetadata[g.id] as object) ?? {}), ...g };
                }
            });
        }
    };
    return store;
}
