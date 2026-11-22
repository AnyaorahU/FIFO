// Extra protection layers: input sanitising, session binding and admin-area hardening.
const crypto = require('crypto');
const config = require('../config');
const { logActivity } = require('../db');
const { rateLimit } = require('./middleware');

// Removes keys that MongoDB could treat as operators ("$gt") or paths ("a.b"), at any depth.
function stripOperators(value, depth = 0) {
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) delete value[key];
    else value[key] = stripOperators(value[key], depth + 1);
  }
  return value;
}

function sanitizeInput(req, res, next) {
  stripOperators(req.body);
  stripOperators(req.query);
  stripOperators(req.params);
  next();
}

// Private areas should never appear in search results or inside frames.
function noIndex(req, res, next) {
  if (/^\/(admin|dashboard|files)(\/|$)/.test(req.path)) res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
}

const fingerprint = req => crypto.createHash('sha256').update(String(req.get('user-agent') || '')).digest('hex').slice(0, 32);

// Ties a logged-in session to the browser that created it, so a stolen cookie used from a different
// browser is signed out. Call bindSession() at login.
function bindSession(req) {
  req.session.fp = fingerprint(req);
  req.session.lastSeen = Date.now();
}

function sessionGuard(req, res, next) {
  if (req.session && req.session.userId && req.session.fp && req.session.fp !== fingerprint(req)) {
    const userId = req.session.userId;
    return req.session.regenerate(() => {
      logActivity(userId, 'session_rejected', 'session cookie used from a different browser', req.ip).catch(() => {});
      next();
    });
  }
  next();
}

const adminLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 600, key: req => 'admin|' + req.ip, message: 'Too many admin requests. Please slow down.' });
const adminWriteLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 150, key: req => 'admin-write|' + req.ip, message: 'Too many changes in a short time. Please wait a few minutes.' });

// Runs before the admin routes: IP allowlist, rate limits, shorter idle timeout and a maximum session length.
function adminGuard(req, res, next) {
  if (config.admin.ipAllowlist.length && !config.admin.ipAllowlist.includes(req.ip)) {
    return res.status(404).render('error', { title: 'Page not found', message: "We couldn't find the page you were looking for." });
  }
  adminLimiter(req, res, () => {
    const proceed = () => {
      if (!req.user || req.user.role !== 'admin') return next();
      const now = Date.now();
      const idle = now - (req.session.lastSeen || now);
      const age = now - (req.session.loginAt || now);
      if (idle > config.admin.idleMinutes * 60000 || age > config.admin.maxHours * 3600000) {
        const reason = idle > config.admin.idleMinutes * 60000 ? 'inactivity' : 'maximum session length';
        const userId = req.user._id;
        return req.session.regenerate(() => {
          logActivity(userId, 'admin_session_expired', reason, req.ip).catch(() => {});
          req.flash('info', 'Your admin session expired. Please log in again.');
          req.session.returnTo = req.method === 'GET' ? req.originalUrl : '/admin';
          res.redirect('/login');
        });
      }
      req.session.lastSeen = now;
      next();
    };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return adminWriteLimiter(req, res, proceed);
    proceed();
  });
}

module.exports = { sanitizeInput, noIndex, sessionGuard, bindSession, adminGuard, stripOperators };
