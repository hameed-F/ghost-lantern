const $ = s => document.querySelector(s);
const forms = { login: $('#login'), signup: $('#signup'), verify: $('#verify'), forgot: $('#forgot'), reset: $('#reset') };
let pending = '';
const say = (t, bad = true) => { const m = $('#msg'); m.textContent = t; m.className = 'msg ' + (bad ? 'bad' : 'good'); };
function show(n) {
  Object.entries(forms).forEach(([k, f]) => f.hidden = k !== n);
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === n));
  $('#msg').textContent = '';
}
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => show(b.dataset.tab));
$('#forgot-link').onclick = () => { show('forgot'); $('#fp-email').value = $('#li-email').value; $('#fp-email').focus(); };

// client-side input filters (the server validates again; never trust the browser)
$('#su-user').addEventListener('input', e => e.target.value = e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16));
['#otp', '#rs-otp'].forEach(id => $(id).addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6)));

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
  let d = {}; try { d = await r.json(); } catch {}
  return { ok: r.ok, ...d };
}
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const passOk = v => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);
function needCode(email, text) { pending = email; show('verify'); $('#vtext').textContent = text; $('#otp').focus(); }

$('#login').onsubmit = async e => {
  e.preventDefault();
  const email = $('#li-email').value.trim(), password = $('#li-pass').value;
  if (!emailOk(email) || !password) return say('Enter your email and password.');
  const r = await post('/api/auth/login', { email, password });
  if (r.ok) return location.href = '/dashboard.html';
  if (r.needsVerify) { needCode(email, 'Your email is not verified yet. We sent you a new code.'); return; }
  say(r.error || 'Login failed.');
};
$('#signup').onsubmit = async e => {
  e.preventDefault();
  const username = $('#su-user').value.trim(), email = $('#su-email').value.trim(), password = $('#su-pass').value;
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return say('Username must be 3 to 16 letters, numbers or underscore.');
  if (!emailOk(email)) return say('Enter a valid email.');
  if (!passOk(password)) return say('Password needs 8+ characters, a letter and a number.');
  const r = await post('/api/auth/signup', { username, email, password });
  if (r.ok) return needCode(email, 'We emailed a 6-digit code to ' + email + '. It expires in 10 minutes.');
  say(r.error || 'Sign up failed.');
};
$('#verify').onsubmit = async e => {
  e.preventDefault();
  const otp = $('#otp').value;
  if (!/^\d{6}$/.test(otp)) return say('The code is 6 digits.');
  const r = await post('/api/auth/verify', { email: pending, otp });
  if (r.ok) return location.href = '/dashboard.html';
  say(r.error || 'Verification failed.');
};
$('#resend').onclick = async () => { const r = await post('/api/auth/resend', { email: pending }); say(r.ok ? 'If the account exists, a new code was sent.' : r.error, !r.ok); };

// ---- forgot / reset password ----
$('#forgot').onsubmit = async e => {
  e.preventDefault();
  const email = $('#fp-email').value.trim();
  if (!emailOk(email)) return say('Enter a valid email.');
  const r = await post('/api/auth/forgot', { email });
  if (!r.ok) return say(r.error || 'Could not send the code.');
  pending = email; show('reset');
  $('#rtext').textContent = 'If an account exists for ' + email + ', a 6-digit code is on its way. Enter it below with your new password.';
  $('#rs-otp').focus();
};
$('#reset').onsubmit = async e => {
  e.preventDefault();
  const otp = $('#rs-otp').value, password = $('#rs-pass').value;
  if (!/^\d{6}$/.test(otp)) return say('The code is 6 digits.');
  if (!passOk(password)) return say('Password needs 8+ characters, a letter and a number.');
  const r = await post('/api/auth/reset', { email: pending, otp, password });
  if (!r.ok) return say(r.error || 'Reset failed.');
  show('login'); $('#li-email').value = pending; $('#li-pass').value = '';
  say('Password changed. Log in with your new password.', false);
};
$('#rs-resend').onclick = async () => { const r = await post('/api/auth/forgot', { email: pending }); say(r.ok ? 'If the account exists, a new code was sent.' : r.error, !r.ok); };

fetch('/api/auth/me', { credentials: 'same-origin' }).then(r => { if (r.ok) location.href = '/dashboard.html'; });
