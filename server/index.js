const config = require('./config');
const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');

const dbm = require('./db');
const { loadUser, csrf, flash } = require('./lib/middleware');
const { sanitizeInput, noIndex, sessionGuard, adminGuard } = require('./lib/security');
const { getContent } = require('./lib/content-store');
const icon = require('./lib/icons');
const constants = require('./lib/constants');

const ROOT = path.join(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const ADMIN_DIR = path.join(ROOT, 'admin');

const toDate = s => (s instanceof Date ? s : s ? new Date(String(s).replace(' ', 'T') + (String(s).length <= 19 ? 'Z' : '')) : null);

function tileOrigin(url) {
  try { return new URL(url.replace(/\{s\}/g, 'a').replace(/\{[a-z]\}/gi, '0')).origin.replace('//a.', '//*.'); }
  catch { return 'https://tile.openstreetmap.org'; }
}

// __Host- cookies are only sent over HTTPS, to this exact host and path (production only).
const SESSION_COOKIE = config.isProd ? '__Host-sid' : 'sid';

function buildApp() {
  const app = express();
  app.set('view engine', 'ejs');
  // An array lets admin templates include the shared client partials by name (e.g. 'partials/head').
  app.set('views', [path.join(CLIENT_DIR, 'views')]);
  app.disable('x-powered-by');
  // Flat query strings only: repeated keys become arrays, but a[b]=c never becomes a nested object.
  app.set('query parser', 'simple');
  if (config.isProd) app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'https://cdnjs.cloudflare.com'],
        'style-src': ["'self'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'style-src-attr': ["'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:', tileOrigin(config.mapTiles.url)],
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
    // OpenStreetMap blocks browser tile requests that carry no Referer. Only our origin is sent to other sites.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
  }));

  const staticOpts = { maxAge: config.isProd ? '7d' : 0 };
  app.use(express.static(path.join(CLIENT_DIR, 'public'), staticOpts));
  app.use('/admin/assets', express.static(path.join(ADMIN_DIR, 'public'), staticOpts));
  app.use(express.urlencoded({ extended: false, limit: '200kb', parameterLimit: 500 }));
  app.use(sanitizeInput);
  app.use(noIndex);

  app.use(session({
    name: SESSION_COOKIE,
    secret: config.sessionSecret,
    store: MongoStore.create({ client: dbm.client, dbName: config.mongoDb, collectionName: 'sessions', ttl: config.sessionIdleMinutes * 60, autoRemove: 'native', touchAfter: 60 }),
    resave: false,
    saveUninitialized: false,
    rolling: true, // idle timeout: the session expires after SESSION_IDLE_MINUTES without activity
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: config.sessionIdleMinutes * 60 * 1000 },
  }));

  // Site content + helpers for every template.
  app.use(async (req, res, next) => {
    try {
      const c = await getContent();
      Object.assign(res.locals, c);
      res.locals.icon = icon;
      res.locals.constants = constants;
      res.locals.path = req.path;
      res.locals.mapTiles = config.mapTiles;
      res.locals.maxUploadMb = config.maxUploadMb;
      res.locals.audience = req.path.startsWith('/companies') ? 'companies' : 'candidates';
      res.locals.place = (...parts) => parts.filter(Boolean).join(', ');
      res.locals.sectorName = slug => (c.sectors.find(s => s.slug === slug) || {}).name || slug || '—';
      res.locals.fmtDate = s => { const d = toDate(s); return d ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
      res.locals.fmtDateTime = s => { const d = toDate(s); return d ? d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; };
      res.locals.fmtShort = s => { const d = toDate(s); return d ? d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; };
      next();
    } catch (e) { next(e); }
  });

  app.use(sessionGuard);
  app.use(flash);
  app.use(loadUser);
  app.use(csrf);

  app.use('/', require('./routes/public'));
  app.use('/', require('./routes/auth'));
  app.use('/jobs', require('./routes/jobs'));
  app.use('/dashboard', require('./routes/dashboard'));
  app.use('/files', require('./routes/files'));
  app.use('/media', require('./routes/media'));
  app.use('/admin', adminGuard, require('../admin/routes'));

  app.use((req, res) => {
    res.status(404).render('error', { title: 'Page not found', message: "We couldn't find the page you were looking for." });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).render('error', { title: 'Something went wrong', message: 'An unexpected error occurred. Please try again.' });
  });
  return app;
}

async function start() {
  await dbm.connect();
  const count = await dbm.col.settings.countDocuments();
  if (!count) console.warn('[warn] The database has no site content yet. Run: npm run seed');
  const admins = await dbm.col.users.countDocuments({ role: 'admin' });
  if (!admins) console.warn('[warn] No admin account. Run: npm run seed (uses ADMIN_EMAIL / ADMIN_PASSWORD from .env)');
  return buildApp().listen(config.port, () => console.log(`Listening on http://localhost:${config.port}`));
}

if (require.main === module) {
  start().catch(err => {
    console.error('[fatal] Could not start:', err.message);
    process.exit(1);
  });
}

// Serverless hosts (Vercel): connect once per instance and reuse the app across requests.
let appPromise = null;
function getApp() {
  if (!appPromise) {
    appPromise = dbm.connect().then(buildApp).catch(err => { appPromise = null; throw err; });
  }
  return appPromise;
}

module.exports = { buildApp, start, getApp, SESSION_COOKIE };
