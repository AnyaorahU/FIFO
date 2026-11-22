const crypto = require('crypto');
const { col, oid, withId, logActivity } = require('../db');

// Loads the logged-in user on every request; inactive or deleted users are signed out.
async function loadUser(req, res, next) {
  res.locals.user = null;
  try {
    const id = oid(req.session.userId);
    if (id) {
      const user = await col.users.findOne({ _id: id }, { projection: { password_hash: 0 } });
      if (user && user.active !== false) {
        req.user = withId(user);
        res.locals.user = req.user;
      } else {
        delete req.session.userId;
      }
    }
    next();
  } catch (e) { next(e); }
}

// A form loaded before the last login/logout (old tab, Back button, restored page, double-tap) carries an old
// token. Instead of a dead-end error, send the person somewhere sensible with a fresh form.
function csrfExpired(req, res) {
  // Already logged in and submitting an old login/register page: go straight to their home page.
  if (req.user && ['/login', '/register'].includes(req.path)) {
    return res.redirect(303, req.user.role === 'admin' ? '/admin' : '/dashboard');
  }
  const refererPath = fallback => {
    try { return new URL(req.get('referer') || fallback, 'http://local').pathname || fallback; } catch { return fallback; }
  };
  let back;
  if (['/login', '/register', '/contact', '/companies/enquiry'].includes(req.path)) back = req.path;
  else if (req.originalUrl.startsWith('/dashboard')) back = '/dashboard';
  else if (req.originalUrl.startsWith('/admin')) { const ref = refererPath('/admin'); back = ref.startsWith('/admin') ? ref : '/admin'; }
  else back = refererPath('/');
  req.flash('info', 'That page had expired, so we refreshed it. Please try again.');
  res.redirect(303, back);
}

const isCredentialForm = req => req.method === 'POST' && (req.path === '/login' || req.path === '/register');

// True only when the browser says the request came from a page on this exact host.
function sameOrigin(req) {
  const origin = req.get('origin');
  if (!origin || origin === 'null') return false;
  try { return new URL(origin).host === req.get('host'); } catch { return false; }
}

function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Multipart forms carry the token in the query string so it is checked before any file is read.
    const token = String((req.body && req.body._csrf) || req.query._csrf || req.get('x-csrf-token') || '');
    const expected = req.session.csrf;
    const ok = token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    // Login/registration from a page whose session has since expired (e.g. left open for hours): accept it when the
    // browser's Origin header proves the form was submitted from this site (an OWASP-recognised CSRF defence),
    // so people get in on the first attempt. Cross-site submissions are still rejected.
    if (!ok && !(isCredentialForm(req) && sameOrigin(req))) return csrfExpired(req, res);
  }
  next();
}

function flash(req, res, next) {
  res.locals.flash = req.session.flash || [];
  delete req.session.flash;
  req.flash = (type, text) => {
    req.session.flash = req.session.flash || [];
    req.session.flash.push({ type, text });
  };
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.method === 'GET') req.session.returnTo = req.originalUrl;
    req.flash('info', 'Please log in to continue.');
    return res.redirect('/login');
  }
  next();
}

function requireCandidate(req, res, next) {
  if (!req.user) return requireAuth(req, res, next);
  if (req.user.role === 'admin') return res.redirect('/admin');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return requireAuth(req, res, next);
  if (req.user.role !== 'admin') {
    logActivity(req.user._id, 'admin_access_denied', `${req.method} ${req.originalUrl.slice(0, 200)}`, req.ip).catch(() => {});
    return res.status(403).render('error', { title: 'Access denied', message: 'This area is for administrators only.' });
  }
  res.set('Cache-Control', 'no-store');
  next();
}

// In-memory limiter (per process) for login, registration and public forms.
function rateLimit({ windowMs, max, key, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.reset < now) entry = { count: 0, reset: now + windowMs };
    entry.count++;
    hits.set(k, entry);
    if (entry.count > max) {
      req.flash('error', message || 'Too many attempts. Please wait a few minutes and try again.');
      // Back to the page the form was on (path only, so it can never leave this site).
      let back = '/';
      try { back = new URL(req.get('referer') || '/', 'http://local').pathname || '/'; } catch { /* keep "/" */ }
      return res.redirect(back);
    }
    next();
  };
}

// Wraps async route handlers so rejected promises reach the error handler.
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Coerces a request value to a trimmed string (blocks object/array injection into queries).
const str = (v, max = 500) => (typeof v === 'string' ? v : '').trim().slice(0, max);

module.exports = { loadUser, csrf, flash, requireAuth, requireCandidate, requireAdmin, rateLimit, ah, str };
