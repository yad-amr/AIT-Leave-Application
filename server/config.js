require('dotenv').config({ quiet: true });
function config() {
  const production = process.env.NODE_ENV === 'production';
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('Set SESSION_SECRET to at least 32 random characters.');
  const positive = (key, fallback) => {
    const value = Number(process.env[key] || fallback);
    if (!Number.isFinite(value) || value < 1) throw new Error(`Invalid ${key}`);
    return value;
  };
  const domain = (process.env.COLLEGE_DOMAIN || 'aitpune.edu.in').toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error('Invalid COLLEGE_DOMAIN');
  const devMode = process.env.DEV_MODE === 'true' && !production;
  if (!devMode && (!process.env.SMTP_HOST || !process.env.SMTP_FROM)) throw new Error('Configure SMTP or explicitly set DEV_MODE=true locally.');
  return { production, secret, domain, devMode, otpMs: positive('OTP_EXPIRY_SECONDS', 300) * 1000, sessionMs: positive('SESSION_EXPIRY_SECONDS', 28800) * 1000, origin: process.env.APP_ORIGIN || 'http://localhost:5173' };
}
module.exports = config;
