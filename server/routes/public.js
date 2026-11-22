const express = require('express');
const { col, withIds } = require('../db');
const { COUNTRIES } = require('../lib/constants');
const { rateLimit, ah, str } = require('../lib/middleware');

const router = express.Router();

router.get('/', ah(async (req, res) => {
  const site = res.locals.site;
  // Featured jobs first (unless the admin chose "newest only"), then newest. Extra jobs feed the category chips.
  const sort = site.opportunitiesMode === 'latest' ? { published_at: -1 } : { featured: -1, published_at: -1 };
  const jobs = withIds(await col.jobs.find({ status: 'open' }).sort(sort).limit(60).toArray());
  // Category chips only for sectors that currently have jobs.
  const chips = res.locals.sectors.filter(s => jobs.some(j => j.sector === s.slug));
  const visible = Math.min(20, Math.max(1, Math.round(Number(site.opportunitiesCount) || 4)));
  res.render('home', { title: null, audience: 'candidates', jobs, chips, visible });
}));

router.get('/companies', (req, res) => res.render('companies', { title: 'For companies', audience: 'companies' }));
router.get('/about', (req, res) => res.render('about', { title: 'About us' }));
router.get('/sectors', (req, res) => res.render('sectors', { title: 'Our sectors' }));

router.get('/sectors/:slug', ah(async (req, res, next) => {
  const sector = res.locals.sectors.find(s => s.slug === req.params.slug);
  if (!sector) {
    // Renamed sectors keep their old URLs working.
    const moved = res.locals.sectors.find(s => (s.old_slugs || []).includes(req.params.slug));
    return moved ? res.redirect(301, `/sectors/${moved.slug}`) : next();
  }
  const jobs = withIds(await col.jobs.find({ status: 'open', sector: sector.slug }).sort({ published_at: -1 }).limit(6).toArray());
  res.render('sector', { title: sector.name, sector, jobs });
}));

router.get('/branches', (req, res) => {
  const q = str(req.query.q, 80).toLowerCase();
  const country = COUNTRIES.includes(req.query.country) ? req.query.country : '';
  let list = res.locals.branches;
  if (country) list = list.filter(b => b.country === country);
  if (q) list = list.filter(b => `${b.city} ${b.state} ${b.country} ${b.address}`.toLowerCase().includes(q));
  res.render('branches', { title: 'Find a branch', list, q, country });
});

router.get('/news', (req, res) => res.render('news', { title: 'News & advice' }));

router.get('/news/:slug', (req, res, next) => {
  const article = res.locals.news.find(a => a.slug === req.params.slug);
  if (!article) return next();
  res.render('article', { title: article.title, article });
});

// Contact + business enquiry share the messages collection.
const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, key: req => 'form|' + req.ip });
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

router.get('/contact', (req, res) => res.render('contact', { title: 'Contact us', form: {} }));

router.post('/contact', formLimiter, ah(async (req, res) => {
  const form = {
    name: str(req.body.name, 120), email: str(req.body.email, 200), phone: str(req.body.phone, 40),
    audience: req.body.audience === 'employer' ? 'employer' : 'candidate', body: str(req.body.body, 5000),
  };
  if (!form.name || !validEmail(form.email) || form.body.length < 5) {
    res.locals.flash = [{ type: 'error', text: 'Please enter your name, a valid email and a message.' }];
    return res.status(400).render('contact', { title: 'Contact us', form });
  }
  await col.messages.insertOne({ kind: 'contact', ...form, is_read: false, created_at: new Date() });
  req.flash('success', "Thanks, your message has been sent. We'll reply by email shortly.");
  res.redirect('/contact');
}));

const NEEDS = ['Temporary', 'Permanent', 'Both', 'Outsourcing / HR'];

router.get('/companies/enquiry', (req, res) => {
  res.render('enquiry', { title: 'Business enquiry', audience: 'companies', form: { type: req.query.type === 'health-check' ? 'health-check' : 'enquiry' } });
});

router.post('/companies/enquiry', formLimiter, ah(async (req, res) => {
  const form = {
    type: req.body.type === 'health-check' ? 'health-check' : 'enquiry',
    name: str(req.body.name, 120), email: str(req.body.email, 200), phone: str(req.body.phone, 40),
    organisation: str(req.body.organisation, 160), location: str(req.body.location, 120),
    sector: res.locals.sectors.some(s => s.slug === req.body.sector) ? req.body.sector : '',
    need: NEEDS.includes(req.body.need) ? req.body.need : '',
    source: str(req.body.source, 120), body: str(req.body.body, 5000),
  };
  const errors = [];
  if (!form.name) errors.push('Please enter your name.');
  if (!validEmail(form.email)) errors.push('Please enter a valid email.');
  if (!form.organisation) errors.push('Please enter your organisation.');
  if (!form.need) errors.push('Please tell us what kind of staff you need.');
  if (errors.length) {
    res.locals.flash = errors.map(text => ({ type: 'error', text }));
    return res.status(400).render('enquiry', { title: 'Business enquiry', audience: 'companies', form });
  }
  const { type, ...rest } = form;
  await col.messages.insertOne({ kind: type, audience: 'employer', ...rest, body: rest.body || '(no message)', is_read: false, created_at: new Date() });
  req.flash('success', 'Thank you. We will reply by email within one business day.');
  res.redirect('/companies/enquiry');
}));

router.post('/job-alerts', formLimiter, ah(async (req, res) => {
  const name = str(req.body.name, 120);
  const email = str(req.body.email, 200).toLowerCase();
  const country = COUNTRIES.includes(req.body.country) ? req.body.country : '';
  const backRaw = str(req.body.back, 300);
  const back = backRaw.startsWith('/') && !backRaw.startsWith('//') ? backRaw : '/';
  if (!name || !validEmail(email) || !country) {
    req.flash('error', 'To sign up for job alerts, enter your name, a valid email and the country you want to work in.');
    return res.redirect(back);
  }
  await col.jobAlerts.updateOne({ email, country }, { $set: { name }, $setOnInsert: { created_at: new Date() } }, { upsert: true });
  req.flash('success', `You're subscribed to job alerts for ${country}.`);
  res.redirect(back);
}));

// Info pages managed in Admin > Content > Info pages. Registered last so fixed routes win.
router.get(/^\/[a-z0-9\-/]+$/, (req, res, next) => {
  const page = res.locals.pages[req.path.replace(/\/$/, '')];
  if (!page) return next();
  res.render('page', { title: page.title, page, audience: page.audience === 'companies' ? 'companies' : res.locals.audience });
});

module.exports = router;
