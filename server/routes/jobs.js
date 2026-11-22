const express = require('express');
const { col, oid, withId, withIds, logActivity } = require('../db');
const { COUNTRIES, CONTRACT_TYPES } = require('../lib/constants');
const { requireCandidate, ah, str } = require('../lib/middleware');
const { ANNUAL_EXPR: ANNUAL } = require('../lib/pay');

const router = express.Router();

const PER_PAGE = 10;
const LISTED = { '': 'Any time', 1: 'Last 24 hours', 3: 'Last 3 days', 7: 'Last 7 days', 14: 'Last 14 days', 30: 'Last 30 days' };
const SALARIES = [40000, 50000, 60000, 70000, 80000, 100000, 120000, 150000];

// Accepts ?x=a&x=b, ?x[]=a or a single value; keeps only allowed string values.
const pickList = (v, allowed) => [...new Set([].concat(v || []).filter(x => typeof x === 'string'))].filter(x => allowed.includes(x));
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


router.get('/', ah(async (req, res) => {
  const sectorSlugs = res.locals.sectors.map(s => s.slug);
  const f = {
    q: str(req.query.q, 100),
    sector: pickList(req.query.sector, sectorSlugs),
    country: pickList(req.query.country, COUNTRIES),
    type: pickList(req.query.type, CONTRACT_TYPES),
    listed: Object.keys(LISTED).includes(str(req.query.listed)) ? str(req.query.listed) : '',
    min: SALARIES.includes(Number(req.query.min)) ? Number(req.query.min) : '',
    max: SALARIES.includes(Number(req.query.max)) ? Number(req.query.max) : '',
  };
  const and = [{ status: 'open' }];
  if (f.q) {
    // Every word must match somewhere (title, summary, location, state, work type, sector).
    for (const word of f.q.split(/\s+/).slice(0, 6)) {
      const re = new RegExp(escapeRegex(word), 'i');
      and.push({ $or: [{ title: re }, { summary: re }, { location: re }, { state: re }, { country: re }, { contract_type: re }, { sector: re }] });
    }
  }
  if (f.sector.length) and.push({ sector: { $in: f.sector } });
  if (f.country.length) and.push({ country: { $in: f.country } });
  if (f.type.length) and.push({ contract_type: { $in: f.type } });
  if (f.listed) and.push({ published_at: { $gte: new Date(Date.now() - Number(f.listed) * 86400000) } });
  if (f.min) and.push({ pay_rate: { $ne: null } }, { $expr: { $gte: [ANNUAL, f.min] } });
  if (f.max) and.push({ pay_rate: { $ne: null } }, { $expr: { $lte: [ANNUAL, f.max] } });
  const filter = { $and: and };

  const total = await col.jobs.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
  const jobs = withIds(await col.jobs.find(filter).sort({ published_at: -1, _id: -1 }).skip((page - 1) * PER_PAGE).limit(PER_PAGE).toArray());

  // Option counts across all open jobs, shown next to each choice.
  const countBy = async field => Object.fromEntries((await col.jobs.aggregate([{ $match: { status: 'open' } }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]).toArray()).map(r => [r._id, r.n]));
  const [cSector, cCountry, cType] = await Promise.all([countBy('sector'), countBy('country'), countBy('contract_type')]);

  const urlWith = changes => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, page, ...changes })) {
      if (k === 'page' && Number(v) === 1) continue;
      [].concat(v).filter(x => x !== '' && x != null).forEach(x => sp.append(k, x));
    }
    const qs = sp.toString();
    return '/jobs' + (qs ? '?' + qs : '');
  };
  const activeFilters = f.sector.length + f.country.length + f.type.length + (f.listed ? 1 : 0) + (f.min ? 1 : 0) + (f.max ? 1 : 0);

  res.render('jobs', {
    title: 'Job search', jobs, f, total, page, pages, urlWith, activeFilters,
    COUNTRIES, CONTRACT_TYPES, LISTED, SALARIES, counts: { sector: cSector, country: cCountry, type: cType },
  });
}));

// Saved jobs live in the browser (localStorage); the page passes the ids here.
router.get('/saved', ah(async (req, res) => {
  const ids = str(req.query.ids, 2000).split(',').map(oid).filter(Boolean).slice(0, 50);
  const jobs = ids.length ? withIds(await col.jobs.find({ _id: { $in: ids } }).sort({ published_at: -1 }).toArray()) : [];
  res.render('saved', { title: 'Saved jobs', jobs, hasIds: 'ids' in req.query });
}));

router.get('/:id', ah(async (req, res, next) => {
  const id = oid(req.params.id);
  const job = id && withId(await col.jobs.findOne({ _id: id }));
  if (!job) return next();
  let applied = null;
  if (req.user && req.user.role === 'candidate') applied = await col.jobApplications.findOne({ job_id: job._id, user_id: req.user._id });
  const similar = withIds(await col.jobs.find({ status: 'open', sector: job.sector, _id: { $ne: job._id } }).sort({ published_at: -1 }).limit(2).toArray());
  res.render('job', { title: job.title, job, applied, similar });
}));

router.post('/:id/apply', requireCandidate, ah(async (req, res, next) => {
  const id = oid(req.params.id);
  const job = id && await col.jobs.findOne({ _id: id, status: 'open' });
  if (!job) return next();
  if (!await col.documents.findOne({ user_id: req.user._id, kind: 'cv' }, { projection: { _id: 1 } })) {
    req.flash('error', 'Please upload your CV before applying. It only takes a minute.');
    return res.redirect('/dashboard#documents');
  }
  const r = await col.jobApplications.updateOne(
    { job_id: job._id, user_id: req.user._id },
    { $setOnInsert: { note: str(req.body.note, 2000) || null, status: 'new', created_at: new Date() } },
    { upsert: true },
  );
  if (r.upsertedCount) {
    await logActivity(req.user._id, 'job_apply', `${job.title} (${job._id})`, req.ip);
    req.flash('success', `You've applied for ${job.title}. A consultant will be in touch.`);
  }
  res.redirect(`/jobs/${job._id}`);
}));

module.exports = router;
