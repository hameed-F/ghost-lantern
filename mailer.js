const nodemailer = require('nodemailer');
const apiKey = process.env.BREVO_API_KEY;
const smtpOk = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
const tx = smtpOk ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;

// "Ghost Lantern <me@example.com>" -> { name, email }
function parseFrom(s) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(s || '');
  return m ? { name: m[1].trim() || 'Ghost Lantern', email: m[2].trim() } : { name: 'Ghost Lantern', email: (s || '').trim() };
}

async function sendOtp(to, name, otp) {
  const text = `Hi ${name},\n\nYour verification code is ${otp}. It expires in 10 minutes.\n\nIf you did not sign up, you can ignore this email.`;
  if (apiKey) {   // HTTPS (port 443): works on Render's free tier
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: parseFrom(process.env.MAIL_FROM), to: [{ email: to }], subject: 'Your Ghost Lantern code', textContent: text })
    });
    if (!r.ok) throw new Error('Brevo API error ' + r.status + ' ' + await r.text());
    return;
  }
  if (tx) { await tx.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject: 'Your Ghost Lantern code', text }); return; }
  if (process.env.NODE_ENV === 'production') throw new Error('No email provider configured');
  console.log(`[DEV ONLY] OTP for ${to}: ${otp}`);
}
module.exports = { sendOtp };