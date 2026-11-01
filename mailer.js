const nodemailer = require('nodemailer');
const configured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
const tx = configured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;

async function sendOtp(to, name, otp) {
  if (!tx) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured');
    console.log(`[DEV ONLY] OTP for ${to}: ${otp}`);
    return;
  }
  await tx.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: 'Your Ghost Lantern code',
    text: `Hi ${name},\n\nYour verification code is ${otp}. It expires in 10 minutes.\n\nIf you did not sign up, you can ignore this email.`
  });
}
module.exports = { sendOtp };
