require('dotenv').config();
const express = require('express'), helmet = require('helmet'), cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit'), path = require('path');
const { init } = require('./db'), { router: auth } = require('./routes/auth'), games = require('./routes/games');

for (const k of ['DATABASE_URL', 'JWT_SECRET', 'OTP_SECRET'])
  if (!process.env[k]) { console.error('Missing environment variable: ' + k); process.exit(1); }

const app = express();
app.set('trust proxy', 1);   // needed behind Render's proxy so rate limiting sees real IPs
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: {
  'script-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ['https://fonts.gstatic.com'],
  'upgrade-insecure-requests': null } } }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 15 * 60e3, limit: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } }));
app.use('/api/auth', auth);
app.use('/api/games', games);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error.' }); });

init().then(() => app.listen(process.env.PORT || 3000, () => console.log('Ghost Lantern running on port ' + (process.env.PORT || 3000))))
  .catch(e => { console.error('Database init failed:', e.message); process.exit(1); });
