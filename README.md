# Ghost Lantern

First-person 3D escape-room game (Three.js) with email-OTP login, player stats dashboard and leaderboard.

Stack: Node + Express, PostgreSQL, vanilla JS + Three.js (CDN). Security: bcrypt (cost 12) for passwords, HMAC-hashed OTPs,
zod validation + HTML escaping, express-rate-limit, helmet, httpOnly JWT cookie, server-side score sanity checks.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env` and fill DATABASE_URL, JWT_SECRET, OTP_SECRET (SMTP optional locally: the OTP prints in the terminal).
3. `npm run dev` then open http://localhost:3000

## Deploy (Render)
Build command `npm install`, start command `npm start`, add the same env vars (plus NODE_ENV=production and the SMTP_* values).
