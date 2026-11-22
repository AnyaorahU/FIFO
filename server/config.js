// Loads and validates environment configuration. Nothing secret is hard-coded here.
const path = require('path');
const crypto = require('crypto');

try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* no .env file */ }

const isProd = process.env.NODE_ENV === 'production';

function fail(msg) {
  console.error(`[config] ${msg}`);
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri || mongoUri.includes('<db_password>') || mongoUri.includes('<db_username>')) {
  fail('MONGODB_URI is missing or still has the <db_username>/<db_password> placeholders. Set it in .env.');
}

// The database connection must be encrypted in production (Atlas mongodb+srv:// URIs use TLS by default).
if (isProd && !/^mongodb\+srv:\/\//.test(mongoUri) && !/[?&](tls|ssl)=true/i.test(mongoUri) && process.env.MONGODB_ALLOW_INSECURE !== '1') {
  fail('MONGODB_URI must use TLS in production (mongodb+srv://… or tls=true).');
}

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  if (isProd) fail('SESSION_SECRET must be set (at least 32 characters) in production.');
  sessionSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[config] SESSION_SECRET not set: using a random one (everyone is logged out on restart).');
}

module.exports = {
  isProd,
  port: Number(process.env.PORT || 3000),
  mongoUri,
  mongoDb: process.env.MONGODB_DB || 'fifoconnect',
  sessionSecret,
  sessionIdleMinutes: Number(process.env.SESSION_IDLE_MINUTES || 120),
  admin: {
    // Admin sessions expire sooner and have a hard maximum length.
    idleMinutes: Number(process.env.ADMIN_IDLE_MINUTES || 30),
    maxHours: Number(process.env.ADMIN_MAX_SESSION_HOURS || 12),
    // Optional comma-separated list of IPs allowed to open /admin (everyone else gets a 404).
    ipAllowlist: String(process.env.ADMIN_IP_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean),
  },
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 10),
  login: {
    maxFailures: Number(process.env.LOGIN_MAX_FAILURES || 5),
    lockMinutes: Number(process.env.LOGIN_LOCK_MINUTES || 15),
  },
  mapTiles: {
    url: process.env.MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: process.env.MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};
