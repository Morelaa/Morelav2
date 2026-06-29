import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url as string);
const __dirname = path.dirname(__filename);

global.owner = [] 
global.mainOwner = 'SENSOR_NO_HP'; 

global.prefa = ['', '!', '.', ',', '🐤', '🗿'];
global.prefix = '.';   

global.thumbnail    = null; 
global.thumbnailUrl = 'https://api.deline.web.id/lWF5z2DXzM.png';

// ── Telegram Global Config ──────────────────────────────────────
// Isi token & chatId di sini, semua fitur (rvo, tgspy, backup, remote) otomatis pakai ini.
// Cara dapat token: chat @BotFather di Telegram → /newbot
// Cara dapat chatId: chat @userinfobot di Telegram
global.tgBot = {
  token:   'SENSOR_TG_TOKEN',   // contoh: '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ'
  ownerId: 'SENSOR_TG_OWNERID',   // contoh: '123456789'  (chatId kamu di Telegram)
}

global.tokengh = 'SENSOR_TOKEN_GH'

global.apiKeys = {

  neoxr: 'SENSOR_API_KEY',

  neoxrSkiplink: 'SENSOR_API_KEY',

  imgbb: 'SENSOR_API_KEY',

  openrouter: 'SENSOR_API_KEY',

  theresav: 'SENSOR_API_KEY',

  theresavGenmart: 'SENSOR_API_KEY',

  bypass: 'SENSOR_API_KEY',

  cuki: 'SENSOR_API_KEY',

  kazztzyy: 'SENSOR_API_KEY',

  kazztzyy2: 'SENSOR_API_KEY',

  evelyne: 'SENSOR_API_KEY',

  termai: 'SENSOR_API_KEY',

}

fs.watchFile(__filename, () => {
  fs.unwatchFile(__filename);
  console.log('\x1b[0;32m' + __filename + ' \x1b[1;32mupdated!\x1b[0m');
});
