const router = require('express').Router();
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), crypto = require('crypto');
const { z } = require('zod'), rateLimit = require('express-rate-limit');
const { pool } = require('../db'), { sendOtp } = require('../mailer');
const prod = process.env.NODE_ENV === 'production';

// ---- rate limiting (security requirement 3) ----
const lim = (ms, n, msg, skipOk) => rateLimit({ windowMs: ms, limit: n, skipSuccessfulRequests: !!skipOk,
  standardHeaders: true, legacyHeaders: false, message: { error: msg } });
const authLimit = lim(15 * 60e3, 10, 'Too many attempts. Try again in 15 minutes.');
const loginLimit = lim(15 * 60e3, 5, 'Too many failed logins. Try again in 15 minutes.', true);
const resendLimit = lim(10 * 60e3, 3, 'Too many code requests. Wait 10 minutes.');

// ---- validation (security requirement 2) ----
const email = z.string().trim().toLowerCase().email('Enter a valid email').max(100);
const password = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password is too long')
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Password needs at least one letter and one number');
const SignUp = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,16}$/, 'Username: 3 to 16 letters, numbers or underscore'),
  email,
  password
});
const Login = z.object({ email, password: z.string().min(1).max(72) });
const Verify = z.object({ email, otp: z.string().regex(/^\d{6}$/, 'Code must be 6 digits') });
const Resend = z.object({ email });
const Forgot = z.object({ email });
const Reset = z.object({ email, otp: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'), password });
// sanitization: HTML-significant characters become entities, so a stored value can never run as markup
const esc = s => String(s).replace(/[&<>"'`\/]/g, c => '&#' + c.charCodeAt(0) + ';');
const parse = (schema, req, res) => {
  const r = schema.safeParse(req.body);
  if (!r.success) { res.status(400).json({ error: r.error.issues[0].message }); return null; }
  return r.data;
};
const h = fn => (req, res, next) => fn(req, res, next).catch(next);

// ---- OTP (stored hashed, never in plain text) ----
const hashOtp = o => crypto.createHmac('sha256', process.env.OTP_SECRET).update(o).digest('hex');
async function sendCode(id, to, name, purpose) {
  const otp = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  await pool.query(`INSERT INTO otps(user_id, otp_hash, expires_at, attempts)
    VALUES($1,$2, now() + interval '10 minutes', 0)
    ON CONFLICT(user_id) DO UPDATE SET otp_hash=$2, expires_at=now() + interval '10 minutes', attempts=0`, [id, hashOtp(otp)]);
  await sendOtp(to, name, otp, purpose);
}

// shared OTP check: `verified` picks signup codes (false) or password-reset codes (true)
async function checkOtp(email, otp, verified) {
  const r = (await pool.query(`SELECT u.id, u.username, o.otp_hash, o.attempts, (o.expires_at < now()) AS expired
    FROM users u JOIN otps o ON o.user_id=u.id WHERE u.email=$1 AND u.is_verified=$2`, [email, verified])).rows[0];
  if (!r) return { error: 'Invalid or expired code.' };
  if (r.attempts >= 5 || r.expired) return { error: 'Code expired or locked. Request a new one.' };
  const a = Buffer.from(hashOtp(otp)), b = Buffer.from(r.otp_hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await pool.query('UPDATE otps SET attempts = attempts + 1 WHERE user_id=$1', [r.id]);
    return { error: 'Wrong code.' };
  }
  return { user: r };
}
function issue(res, u) {
  const token = jwt.sign({ id: u.id, username: u.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: prod, maxAge: 7 * 864e5 });
}
function requireAuth(req, res, next) {
  try { req.user = jwt.verify(req.cookies.token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Not signed in.' }); }
}

router.post('/signup', authLimit, h(async (req, res) => {
  const d = parse(SignUp, req, res); if (!d) return;
  const name = esc(d.username), hash = await bcrypt.hash(d.password, 12);   // password is only ever stored hashed
  const ex = (await pool.query('SELECT id, is_verified FROM users WHERE email=$1', [d.email])).rows[0];
  if (ex && ex.is_verified) return res.status(409).json({ error: 'That email or username is already in use.' });
  let id;
  try {
    if (ex) { id = ex.id; await pool.query('UPDATE users SET username=$1, password_hash=$2 WHERE id=$3', [name, hash, id]); }
    else id = (await pool.query('INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) RETURNING id', [name, d.email, hash])).rows[0].id;
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'That email or username is already in use.' });
    throw e;
  }
  await sendCode(id, d.email, name);
  res.status(201).json({ ok: true, needsVerify: true });
}));

router.post('/verify', authLimit, h(async (req, res) => {
  const d = parse(Verify, req, res); if (!d) return;
  const c = await checkOtp(d.email, d.otp, false);
  if (c.error) return res.status(400).json({ error: c.error });
  await pool.query('UPDATE users SET is_verified=true WHERE id=$1', [c.user.id]);
  await pool.query('DELETE FROM otps WHERE user_id=$1', [c.user.id]);
  issue(res, c.user); res.json({ ok: true });
}));

router.post('/resend', resendLimit, h(async (req, res) => {
  const d = parse(Resend, req, res); if (!d) return;
  const u = (await pool.query('SELECT id, username FROM users WHERE email=$1 AND is_verified=false', [d.email])).rows[0];
  if (u) await sendCode(u.id, d.email, u.username);
  res.json({ ok: true });   // same answer whether or not the account exists
}));

router.post('/forgot', resendLimit, h(async (req, res) => {
  const d = parse(Forgot, req, res); if (!d) return;
  const u = (await pool.query('SELECT id, username FROM users WHERE email=$1 AND is_verified=true', [d.email])).rows[0];
  if (u) { try { await sendCode(u.id, d.email, u.username, 'reset'); } catch (e) { console.error('reset email failed:', e.message); } }
  res.json({ ok: true });   // same answer whether or not the account exists
}));

router.post('/reset', authLimit, h(async (req, res) => {
  const d = parse(Reset, req, res); if (!d) return;
  const c = await checkOtp(d.email, d.otp, true);
  if (c.error) return res.status(400).json({ error: c.error });
  const hash = await bcrypt.hash(d.password, 12);   // the new password is stored hashed, like every other one
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, c.user.id]);
  await pool.query('DELETE FROM otps WHERE user_id=$1', [c.user.id]);
  res.json({ ok: true });
}));

const DUMMY = bcrypt.hashSync('dummy-password', 12);   // keeps timing equal for unknown emails
router.post('/login', loginLimit, h(async (req, res) => {
  const d = parse(Login, req, res); if (!d) return;
  const u = (await pool.query('SELECT id, username, password_hash, is_verified FROM users WHERE email=$1', [d.email])).rows[0];
  const ok = await bcrypt.compare(d.password, u ? u.password_hash : DUMMY);
  if (!u || !ok) return res.status(401).json({ error: 'Wrong email or password.' });
  if (!u.is_verified) {
    await sendCode(u.id, d.email, u.username);
    return res.status(403).json({ error: 'Verify your email first. We sent a new code.', needsVerify: true });
  }
  issue(res, u); res.json({ ok: true });
}));

router.get('/me', requireAuth, (req, res) => res.json({ id: req.user.id, username: req.user.username }));
router.post('/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

module.exports = { router, requireAuth };
