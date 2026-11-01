require('dotenv').config();
const express = require('express'), helmet = require('helmet'), cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit'), path = require('path');
const { init } = require('./db'), { router: auth } = require('./routes/auth'), games = require('./routes/games');

for (const k of ['DATABASE_URL', 'JWT_SECRET', 'OTP_SECRET'])
  if (!process.env[k]) console.error('Missing environment variable: ' + k);

const app = express();
app.set('trust proxy', 1);   // behind Vercel's proxy, so rate limiting sees real IPs
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: {
  'script-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ['https://fonts.gstatic.com'],
  'upgrade-insecure-requests': null } } }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// create the database tables once per server instance, before the first API request
let ready;
app.use('/api', (req, res, next) => {
  ready = ready || init();
  ready.then(() => next()).catch(e => { ready = null; next(e); });
});
app.use('/api', rateLimit({ windowMs: 15 * 60e3, limit: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } }));
app.use('/api/auth', auth);
app.use('/api/games', games);
app.use(express.static(path.join(__dirname, 'public')));   // used locally; on Vercel the public/ folder is served by its CDN
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error.' }); });

if (!process.env.VERCEL) {   // running on your own computer
  const port = process.env.PORT || 3000;
  ready = init();
  ready.then(() => app.listen(port, () => console.log('Ghost Lantern running on port ' + port)))
    .catch(e => { console.error('Database init failed:', e.message); process.exit(1); });
}
module.exports = app;