import Database from 'better-sqlite3'
import fs        from 'fs'
import path      from 'path'
import chalk     from 'chalk'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url as string))
const DB_DIR    = path.join(__dirname, '../data')
const DB_PATH   = path.join(DB_DIR, 'morela.db')

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  number          TEXT,
  name            TEXT,
  registered      INTEGER DEFAULT 0,
  regName         TEXT,
  regDate         TEXT,
  registered_at   INTEGER,
  sn_code         TEXT,
  level           INTEGER DEFAULT 1,
  exp             INTEGER DEFAULT 0,
  premium         INTEGER DEFAULT 0,
  premiumExpiry   INTEGER,
  is_banned       INTEGER DEFAULT 0,
  gold            INTEGER DEFAULT 0,
  diamond         INTEGER DEFAULT 0,
  apel            INTEGER DEFAULT 0,
  potion          INTEGER DEFAULT 0,
  balance         INTEGER DEFAULT 0,
  bank            INTEGER DEFAULT 0,
  health          INTEGER DEFAULT 0,
  max_health      INTEGER DEFAULT 0,
  armor           TEXT,
  sword           TEXT,
  pickaxe         TEXT,
  limit_item      INTEGER DEFAULT 0,
  dungeon_active  INTEGER DEFAULT 0,
  mining_active   INTEGER DEFAULT 0,
  last_mining     INTEGER,
  extra           TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_users_premium ON users(premium);
CREATE INDEX IF NOT EXISTS idx_users_number  ON users(number);

CREATE TABLE IF NOT EXISTS groups (
  id              TEXT PRIMARY KEY,
  subject         TEXT,
  owner           TEXT,
  ownerPn         TEXT,
  size            INTEGER,
  creation        INTEGER,
  restrict_only   INTEGER,
  announce        INTEGER,
  addressingMode  TEXT,
  selfmode        INTEGER DEFAULT 0,
  extra           TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_groups_selfmode ON groups(selfmode);

CREATE TABLE IF NOT EXISTS lidmap (
  lid   TEXT PRIMARY KEY,
  phone TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lidmap_phone ON lidmap(phone);

CREATE TABLE IF NOT EXISTS pushname (
  lid  TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sewagrub (
  groupId         TEXT PRIMARY KEY,
  groupName       TEXT,
  ownerJid        TEXT,
  startDate       TEXT,
  expiryDate      TEXT,
  expiryTimestamp INTEGER,
  addedBy         TEXT,
  remindersSent   TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS usagelimit (
  jid        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0,
  limitHitAt INTEGER
);
CREATE TABLE IF NOT EXISTS limitconfig (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  dailyLimit INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stats_commands (
  command TEXT PRIMARY KEY,
  count   INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stats_users (
  jid   TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stats_hours (
  hour  TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stats_days (
  day   TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stats_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS chat_counts (
  scope     TEXT NOT NULL,
  member_id TEXT NOT NULL,
  name      TEXT,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, member_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_counts_scope ON chat_counts(scope, count DESC);

CREATE TABLE IF NOT EXISTS group_participants (
  group_id  TEXT NOT NULL,
  jid       TEXT NOT NULL,
  phone     TEXT,
  lid       TEXT,
  role      TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (group_id, jid)
);
CREATE INDEX IF NOT EXISTS idx_gp_group  ON group_participants(group_id);
CREATE INDEX IF NOT EXISTS idx_gp_phone  ON group_participants(phone);
CREATE INDEX IF NOT EXISTS idx_gp_lid    ON group_participants(lid);

CREATE TABLE IF NOT EXISTS kv_store (
  store TEXT NOT NULL,
  key   TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (store, key)
);
CREATE INDEX IF NOT EXISTS idx_kv_store_store ON kv_store(store);
`

let _db: Database.Database | null = null

export function getDB(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.exec(SCHEMA)
  console.log(chalk.green.bold('✅ SQLite DB ready →'), chalk.cyan(DB_PATH))
  return _db
}

export function closeDB(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

export { DB_PATH }
export default getDB
