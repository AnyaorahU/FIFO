const express = require('express');
const bcrypt = require('bcryptjs');
const { col, logActivity } = require('../db');
const config = require('../config');
const { COUNTRIES } = require('../lib/constants');
const { rateLimit, ah, str } = require('../lib/middleware');
const { bindSession } = require('../lib/security');

const router = express.Router();

// Per IP + email, on top of the per-account lockout below.
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: req => req.ip + '|' + str(req.body.email, 200).toLowerCase() });

// Keeps timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-placeholder', 12);
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function passwordProblems(pw, role = 'candidate') {
  const min = role === 'admin' ? 12 : 8;
  const problems = [];
  if (pw.length < min) problems.push(`Password must be at least ${min} characters.`);
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) problems.push('Password must include letters and numbers.');
  return problems;
}

function startSession(req, userId, cb) {
  const returnTo = req.session.returnTo;
  // New session id on login prevents session fixation.
  req.session.regenerate(err => {
    if (err) return cb(err);
    req.session.userId = String(userId);
    req.session.loginAt = Date.now();
    bindSession(req);
    cb(null, returnTo);
  });
}

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('register', { title: 'Create your account', form: {} });
});

router.post('/register', limiter, ah(async (req, res, next) => {
  const form = {
    name: str(req.body.name, 120), email: str(req.body.email, 200).toLowerCase(), phone: str(req.body.phone, 40),
    job_sector: str(req.body.job_sector, 80), country: COUNTRIES.includes(req.body.country) ? req.body.country : '',
  };
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const errors = [];
  if (form.name.length < 2) errors.push('Please enter your full name.');
  if (!validEmail(form.email)) errors.push('Please enter a valid email address.');
  errors.push(...passwordProblems(password));
  if (password !== req.body.confirm) errors.push('Passwords do not match.');
  if (!req.body.terms) errors.push('Please accept the privacy policy to continue.');
  if (!errors.length && await col.users.findOne({ email: form.email }, { projection: { _id: 1 } })) {
    errors.push('An account with that email already exists. Try logging in.');
  }
  if (errors.length) {
    res.locals.flash = errors.map(text => ({ type: 'error', text }));
    return res.status(400).render('register', { title: 'Create your account', form });
  }

  const now = new Date();
  const sector = res.locals.sectors.some(s => s.slug === form.job_sector) ? form.job_sector : null;
  let userId;
  try {
    ({ insertedId: userId } = await col.users.insertOne({
      name: form.name, email: form.email, phone: form.phone || null, password_hash: await bcrypt.hash(password, 12),
      role: 'candidate', active: true, created_at: now, last_login_at: null, failed_logins: 0, locked_until: null,
    }));
  } catch (e) {
    if (e.code === 11000) {
      res.locals.flash = [{ type: 'error', text: 'An account with that email already exists. Try logging in.' }];
      return res.status(400).render('register', { title: 'Create your account', form });
    }
    throw e;
  }
  await col.applications.insertOne({ user_id: userId, job_sector: sector, country: form.country || null, status: 'draft', licences: [], updated_at: now });
  await logActivity(userId, 'register', null, req.ip);

  startSession(req, userId, err => {
    if (err) return next(err);
    req.flash('success', `Welcome, ${form.name.split(' ')[0]}! Complete the steps below to submit your profile.`);
    res.redirect('/dashboard');
  });
}));

router.get('/login', (req, res) => {
  if (req.user) return res.redirect(req.user.role === 'admin' ? '/admin' : '/dashboard');
  res.render('login', { title: 'Log in', email: '' });
});

router.post('/login', limiter, ah(async (req, res, next) => {
  const email = str(req.body.email, 200).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const fail = (text, status = 401) => {
    res.locals.flash = [{ type: 'error', text }];
    res.status(status).render('login', { title: 'Log in', email });
  };

  const user = await col.users.findOne({ email });
  if (user && user.locked_until && user.locked_until > new Date()) {
    const mins = Math.ceil((user.locked_until - Date.now()) / 60000);
    await bcrypt.compare(password, DUMMY_HASH);
    return fail(`Too many failed attempts. This account is locked for ${mins} more minute${mins === 1 ? '' : 's'}.`, 429);
  }
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !ok) {
    if (user) {
      const failures = (user.failed_logins || 0) + 1;
      const update = { failed_logins: failures };
      if (failures >= config.login.maxFailures) {
        update.locked_until = new Date(Date.now() + config.login.lockMinutes * 60000);
        update.failed_logins = 0;
        await logActivity(user._id, 'account_locked', `${config.login.maxFailures} failed logins`, req.ip);
      }
      await col.users.updateOne({ _id: user._id }, { $set: update });
    }
    return fail('Incorrect email or password.');
  }
  if (user.active === false) return fail('This account has been disabled. Please contact us.', 403);

  await col.users.updateOne({ _id: user._id }, { $set: { last_login_at: new Date(), failed_logins: 0, locked_until: null } });
  await logActivity(user._id, 'login', null, req.ip);
  startSession(req, user._id, (err, returnTo) => {
    if (err) return next(err);
    const fallback = user.role === 'admin' ? '/admin' : '/dashboard';
    const safe = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : fallback;
    res.redirect(safe);
  });
}));

router.post('/logout', ah(async (req, res) => {
  if (req.user) await logActivity(req.user._id, 'logout', null, req.ip);
  req.session.destroy(() => {
    res.clearCookie(config.isProd ? '__Host-sid' : 'sid', { path: '/' });
    res.redirect('/');
  });
}));

module.exports = router;
module.exports.passwordProblems = passwordProblems;
