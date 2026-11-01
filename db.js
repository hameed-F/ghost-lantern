require('dotenv').config();
const { Pool, neonConfig } = require('@neondatabase/serverless');
neonConfig.webSocketConstructor = require('ws');   // talks to Neon over port 443 instead of 5432
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      id SERIAL PRIMARY KEY,
      username VARCHAR(16) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_verified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users(lower(username));
    CREATE TABLE IF NOT EXISTS otps(
      user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      otp_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INT NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS games(
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score INT NOT NULL, diamonds INT NOT NULL, keys_found INT NOT NULL,
      banished INT NOT NULL, levels INT NOT NULL, won BOOLEAN NOT NULL,
      duration INT NOT NULL, played_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS games_user ON games(user_id, played_at DESC);
  `);
}
module.exports = { pool, init };