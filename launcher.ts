import { spawn } from 'node:child_process';
const ENTRY = 'utama.ts';
function runOnce(): Promise<'restart' | 'exit'> {
    return new Promise((resolve) => {
        console.log(`[LAUNCHER] menjalankan ${ENTRY}...`);
        const child = spawn('npx', ['tsx', ENTRY], {
            stdio: 'inherit',
        });
        child.on('exit', (code) => {
            console.log(`[LAUNCHER] proses berhenti, exit code=${code}`);
            if (code === 69) {
                resolve('restart');
            } else {
                resolve('exit');
            }
        });
        child.on('error', (error) => {
            console.error('[LAUNCHER] gagal spawn proses:', error.message);
            resolve('restart');
        });
    });
}
(async () => {
    let flag: 'restart' | 'exit' = 'restart';
    while (flag === 'restart') {
        flag = await runOnce();
    }
    console.log('[LAUNCHER] berhenti total.');
})();
