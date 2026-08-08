// lib/database.js — PostgreSQL client for your cloud database console.
// Replaces the local SQLite file (data/db.js) once you're pointing at real
// managed cloud infrastructure instead of a single-server file. Most "cloud
// database" consoles (including Google Cloud SQL, Neon, Supabase, and
// generic Postgres-as-a-service panels) expose a standard Postgres
// connection string — this uses that, not a bespoke API.
//
// Setup (add to .env):
//   CLOUD_DATABASE_URL=postgresql://user:password@host:5432/aerosys
//
// If your console instead exposes a custom REST API rather than a raw
// Postgres connection, tell me the actual endpoint shapes and I'll swap
// this file for a fetch()-based client against those routes instead —
// I can't guess the contract of a private console I can't reach.
//
// Requires: npm install pg

import pg from 'pg';
const { Pool } = pg;

let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.CLOUD_DATABASE_URL;
    if (!connectionString) throw new Error('CLOUD_DATABASE_URL not set in environment.');
    pool = new Pool({
      connectionString,
      ssl: process.env.CLOUD_DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function initSchema() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS licenses (
      id SERIAL PRIMARY KEY,
      serial TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      plan TEXT NOT NULL,
      stripe_session_id TEXT,
      revoked BOOLEAN DEFAULT false,
      issued_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      ticket_id TEXT UNIQUE NOT NULL,
      from_email TEXT NOT NULL,
      subject TEXT,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

export async function insertLicense({ serial, email, plan, stripeSessionId }) {
  const p = getPool();
  return p.query(
    `INSERT INTO licenses (serial, email, plan, stripe_session_id) VALUES ($1,$2,$3,$4) RETURNING *`,
    [serial, email, plan, stripeSessionId || null]
  );
}

export async function findLicense(serial) {
  const p = getPool();
  const { rows } = await p.query(`SELECT * FROM licenses WHERE serial = $1`, [serial]);
  return rows[0];
}

export async function revokeLicense(serial) {
  const p = getPool();
  return p.query(`UPDATE licenses SET revoked = true WHERE serial = $1`, [serial]);
}

export async function listLicenses() {
  const p = getPool();
  const { rows } = await p.query(`SELECT * FROM licenses ORDER BY issued_at DESC`);
  return rows;
}
