require('dotenv').config();
// 使用 Node 22+ 内置的 node:sqlite，无需原生编译
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'checkin.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  college TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT DEFAULT '',
  open INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_code TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  college TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  UNIQUE(activity_code, user_id)
);
`);

// 首次启动时初始化管理员账号
const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
if (!admin) {
  db.prepare("INSERT INTO users (student_id,name,college,password_hash,role,created_at) VALUES (?,?,?,?,?,?)")
    .run(
      process.env.ADMIN_USER || 'admin',
      '管理员',
      '-',
      bcrypt.hashSync(process.env.ADMIN_PASS || 'admin123', 10),
      'admin',
      Date.now()
    );
}

module.exports = db;
