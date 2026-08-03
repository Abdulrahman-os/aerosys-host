// data/db.js — SQLite persistence (file-based, self-contained, no external
// DB service required). Uses better-sqlite3 (synchronous, fast, zero-config).
// The .db file lives at data/aerosys.db and persists across server restarts —
// back it up / mount it as a volume in Docker.

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'aerosys.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    plan TEXT NOT NULL,
    stripe_session_id TEXT,
    revoked INTEGER DEFAULT 0,
    issued_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL,
    from_email TEXT NOT NULL,
    subject TEXT,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

export function insertLicense({ serial, email, plan, stripeSessionId }) {
  const stmt = db.prepare(`INSERT INTO licenses (serial, email, plan, stripe_session_id) VALUES (?, ?, ?, ?)`);
  return stmt.run(serial, email, plan, stripeSessionId || null);
}

export function findLicense(serial) {
  return db.prepare(`SELECT * FROM licenses WHERE serial = ?`).get(serial);
}

export function revokeLicense(serial) {
  return db.prepare(`UPDATE licenses SET revoked = 1 WHERE serial = ?`).run(serial);
}

export function listLicenses() {
  return db.prepare(`SELECT * FROM licenses ORDER BY issued_at DESC`).all();
}

export default db;
