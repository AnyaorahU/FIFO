const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { col, oid, withId, withIds, logActivity, getDb } = require('../server/db');
const { requireAdmin, ah, str } = require('../server/lib/middleware');
const { deleteFile } = require('../server/lib/uploads');
const { parsePay } = require('../server/lib/pay');
const { COUNTRIES, CONTRACT_TYPES, PROFILE_STATUS, APP_STATUS } = require('../server/lib/constants');
const { passwordProblems } = require('../server/routes/auth');

// Admin templates live in admin/views; shared partials resolve from client/views.
const view = name => path.join(__dirname, 'views', name);

const router = express.Router();
router.use(requireAdmin);
router.use(ah(async (req, res, next) => {
  res.locals.unread = await col.messages.countDocuments({ is_read: false });
  res.locals.statuses = Object.keys(PROFILE_STATUS);
  res.locals.statusLabel = s => PROFILE_STATUS[s] || s;
  res.locals.APP_STATUS = APP_STATUS;
  res.locals.appStatusLabel = s => APP_STATUS[s] || s;
  next();
}));

router.use('/content', require('./content-routes'));

// Dangerous actions require the admin to re-enter their password (protects against a hijacked or unattended session).
async function passwordConfirmed(req) {
  const pw = typeof req.body.confirm_password === 'string' ? req.body.confirm_password : '';
  if (!pw) return false;
  const me = await col.users.findOne({ _id: req.user._id }, { projection: { password_hash: 1 } });
  const ok = Boolean(me) && await bcrypt.compare(pw, me.password_hash);
  if (!ok) await logActivity(req.user._id, 'admin_reauth_failed', req.originalUrl.slice(0, 200), req.ip);
  return ok;
}

// Signs a user out everywhere by removing their stored sessions.
async function endSessions(userId, exceptSessionId) {
  const filter = { session: { $regex: `"userId":"${String(userId)}"` } };
  if (exceptSessionId) filter._id = { $ne: exceptSessionId };
  await getDb().collection('sessions').deleteMany(filter);
}

// Joins user names (and roles) onto rows that have a user_id.
async function attachUsers(rows, field = 'user_id') {
  const ids = [...new Set(rows.map(r => r[field] && String(r[field])).filter(Boolean))].map(oid);
  const users = await col.users.find({ _id: { $in: ids } }, { projection: { name: 1, email: 1, role: 1 } }).toArray();
  const byId = Object.fromEntries(users.map(u => [String(u._id), u]));
  return rows.map(r => {
    const u = r[field] ? byId[String(r[field])] : null;
    return { ...r, id: String(r._id), user_id: r[field] ? String(r[field]) : null, name: u ? u.name : null, email: u ? u.email : null, role: u ? u.role : null };
  });
}

// ---- Overview ----
router.get('/', ah(async (req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [candidates, newThisWeek, awaiting, approved, openJobs, newJobApps, alerts] = await Promise.all([
    col.users.countDocuments({ role: 'candidate' }),
    col.users.countDocuments({ role: 'candidate', created_at: { $gte: weekAgo } }),
    col.applications.countDocuments({ status: { $in: ['submitted', 'under_review'] } }),
    col.applications.countDocuments({ status: 'approved' }),
    col.jobs.countDocuments({ status: 'open' }),
    col.jobApplications.countDocuments({ status: 'new' }),
    col.jobAlerts.countDocuments(),
  ]);
  const group = field => col.applications.aggregate([{ $group: { _id: `$${field}`, n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray();
  const bySector = (await group('job_sector')).map(r => ({ job_sector: r._id, n: r.n }));
  const byStatus = (await group('status')).map(r => ({ status: r._id, n: r.n }));
  const subs = await col.applications.find({ submitted_at: { $ne: null } }).sort({ submitted_at: -1 }).limit(8).toArray();
  const recentSubmissions = (await attachUsers(subs)).map(s => ({ ...s, id: s.user_id }));
  const ja = await attachUsers(await col.jobApplications.find().sort({ created_at: -1 }).limit(6).toArray());
  const jobTitles = Object.fromEntries((await col.jobs.find({ _id: { $in: ja.map(a => a.job_id) } }, { projection: { title: 1 } }).toArray()).map(j => [String(j._id), j.title]));
  const recentJobApps = ja.map(a => ({ ...a, job_id: String(a.job_id), title: jobTitles[String(a.job_id)] || '(deleted job)' }));
  const activity = await attachUsers(await col.activity.find().sort({ created_at: -1 }).limit(12).toArray());
  res.render(view('index'), {
    title: 'Admin overview', stats: { candidates, newThisWeek, awaiting, approved, openJobs, newJobApps, alerts },
    bySector, byStatus, recentSubmissions, recentJobApps, activity,
  });
}));

// ---- Candidates ----
async function candidateRows(query) {
  const filters = { q: str(query.q, 100), status: PROFILE_STATUS[query.status] ? query.status : '', sector: str(query.sector, 80) };
  const userFilter = { role: 'candidate' };
  if (filters.q) {
    const re = new RegExp(filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    userFilter.$or = [{ name: re }, { email: re }, { phone: re }];
  }
  const users = await col.users.find(userFilter, { projection: { password_hash: 0 } }).toArray();
  const appFilter = { user_id: { $in: users.map(u => u._id) } };
  if (filters.status) appFilter.status = filters.status;
  if (filters.sector) appFilter.job_sector = filters.sector;
  const apps = await col.applications.find(appFilter).toArray();
  const docCounts = await col.documents.aggregate([
    { $match: { user_id: { $in: apps.map(a => a.user_id) } } },
    { $group: { _id: { u: '$user_id', k: '$kind' }, n: { $sum: 1 } } },
  ]).toArray();
  const count = (u, k) => (docCounts.find(d => d._id.u.equals(u) && d._id.k === k) || { n: 0 }).n;
  const rows = apps.map(a => {
    const u = users.find(x => x._id.equals(a.user_id));
    return { ...a, ...u, id: String(u._id), status: a.status, updated_at: a.updated_at, submitted_at: a.submitted_at,
      has_cv: count(u._id, 'cv'), has_passport: count(u._id, 'passport'), certs: count(u._id, 'certificate') };
  }).sort((x, y) => (y.updated_at || 0) - (x.updated_at || 0));
  return { rows, filters };
}

router.get('/candidates', ah(async (req, res) => {
  const { rows, filters } = await candidateRows(req.query);
  res.render(view('candidates'), { title: 'Candidates', rows, filters });
}));

router.get('/candidates.csv', ah(async (req, res) => {
  const { rows } = await candidateRows(req.query);
  const cell = v => {
    let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const header = ['ID', 'Name', 'Email', 'Phone', 'Sector', 'Country', 'Right to work', 'Licences', 'Status', 'CV', 'Passport', 'Certificates', 'Registered', 'Submitted'];
  const lines = rows.map(r => [r.id, r.name, r.email, r.phone, res.locals.sectorName(r.job_sector), r.country || r.state, r.work_rights, (r.licences || []).join('; '),
    PROFILE_STATUS[r.status], r.has_cv ? 'Yes' : 'No', r.has_passport ? 'Yes' : 'No', r.certs, r.created_at, r.submitted_at].map(cell).join(','));
  await logActivity(req.user._id, 'admin_export', `${rows.length} candidates`, req.ip);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="candidates-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send([header.map(cell).join(','), ...lines].join('\r\n'));
}));

const loadCandidate = ah(async (req, res, next) => {
  const id = oid(req.params.id);
  const u = id && await col.users.findOne({ _id: id, role: 'candidate' }, { projection: { password_hash: 0 } });
  if (!u) return res.status(404).render('error', { title: 'Not found', message: 'Candidate not found.' });
  const a = await col.applications.findOne({ user_id: u._id }) || {};
  req.candidate = { ...a, ...u, id: String(u._id), licences: a.licences || [], status: a.status || 'draft',
    admin_notes: a.admin_notes, updated_at: a.updated_at, submitted_at: a.submitted_at };
  next();
});

router.get('/candidates/:id', loadCandidate, ah(async (req, res) => {
  const c = req.candidate;
  const docs = withIds(await col.documents.find({ user_id: c._id }).sort({ kind: 1, uploaded_at: -1 }).toArray());
  const activity = withIds(await col.activity.find({ user_id: c._id }).sort({ created_at: -1 }).limit(30).toArray());
  const apps = await col.jobApplications.find({ user_id: c._id }).sort({ created_at: -1 }).toArray();
  const titles = Object.fromEntries((await col.jobs.find({ _id: { $in: apps.map(a => a.job_id) } }, { projection: { title: 1 } }).toArray()).map(j => [String(j._id), j.title]));
  const jobApps = apps.map(a => ({ ...a, id: String(a._id), job_id: String(a.job_id), title: titles[String(a.job_id)] || '(deleted job)' }));
  res.render(view('candidate'), { title: c.name, c, docs, activity, jobApps });
}));

router.post('/candidates/:id/status', loadCandidate, ah(async (req, res) => {
  const c = req.candidate;
  const status = str(req.body.status, 30);
  if (!PROFILE_STATUS[status]) { req.flash('error', 'Invalid status.'); return res.redirect(`/admin/candidates/${c.id}`); }
  await col.applications.updateOne({ user_id: c._id }, { $set: { status, admin_notes: str(req.body.admin_notes, 5000) || null, updated_at: new Date() } }, { upsert: true });
  if (status !== c.status) await logActivity(c._id, 'status_change', `${PROFILE_STATUS[c.status]} → ${PROFILE_STATUS[status]} by ${req.user.name}`, req.ip);
  req.flash('success', 'Profile review saved.');
  res.redirect(`/admin/candidates/${c.id}`);
}));

router.post('/candidates/:id/toggle', loadCandidate, ah(async (req, res) => {
  const c = req.candidate;
  const active = c.active === false;
  await col.users.updateOne({ _id: c._id }, { $set: { active } });
  if (!active) await endSessions(c._id);
  await logActivity(c._id, active ? 'account_enabled' : 'account_disabled', `by ${req.user.name}`, req.ip);
  req.flash('success', active ? 'Account enabled.' : 'Account disabled and signed out.');
  res.redirect(`/admin/candidates/${c.id}`);
}));

router.post('/candidates/:id/delete', loadCandidate, ah(async (req, res) => {
  const c = req.candidate;
  if (!await passwordConfirmed(req)) {
    req.flash('error', 'Enter your password to confirm deleting this candidate.');
    return res.redirect(`/admin/candidates/${c.id}`);
  }
  const docs = await col.documents.find({ user_id: c._id }).toArray();
  await Promise.all(docs.map(d => deleteFile('documents', d.file_id)));
  await Promise.all([
    col.documents.deleteMany({ user_id: c._id }), col.applications.deleteMany({ user_id: c._id }),
    col.jobApplications.deleteMany({ user_id: c._id }), col.users.deleteOne({ _id: c._id }),
    col.activity.updateMany({ user_id: c._id }, { $set: { user_id: null } }),
  ]);
  await endSessions(c._id);
  await logActivity(req.user._id, 'admin_delete_candidate', `${c.name} <${c.email}>`, req.ip);
  req.flash('success', 'Candidate and all their documents were deleted.');
  res.redirect('/admin/candidates');
}));

// ---- Jobs ----
router.get('/jobs', ah(async (req, res) => {
  const status = ['open', 'closed'].includes(req.query.status) ? req.query.status : '';
  const jobs = withIds(await col.jobs.find(status ? { status } : {}).sort({ published_at: -1 }).toArray());
  const counts = await col.jobApplications.aggregate([{ $group: { _id: '$job_id', n: { $sum: 1 }, fresh: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } } } }]).toArray();
  const rows = jobs.map(j => { const c = counts.find(x => x._id.equals(j._id)) || { n: 0, fresh: 0 }; return { ...j, applicants: c.n, new_applicants: c.fresh }; });
  res.render(view('jobs'), { title: 'Jobs', rows, status });
}));

function readJob(body, sectors) {
  const job = {
    title: str(body.title, 140), sector: str(body.sector, 80), location: str(body.location, 120), state: str(body.state, 80), country: str(body.country, 80),
    contract_type: str(body.contract_type, 30), pay: str(body.pay, 80), summary: str(body.summary, 400),
    description: str(body.description, 8000), requirements: str(body.requirements, 3000),
    status: body.status === 'closed' ? 'closed' : 'open',
    featured: body.featured === 'on',
  };
  const errors = [];
  if (job.title.length < 3) errors.push('Title is required.');
  if (!sectors.some(s => s.slug === job.sector)) errors.push('Choose a sector.');
  if (!job.location) errors.push('Location is required.');
  if (!COUNTRIES.includes(job.country)) errors.push('Choose a country.');
  if (!CONTRACT_TYPES.includes(job.contract_type)) errors.push('Choose a work type.');
  if (job.summary.length < 10) errors.push('Add a short summary (shown on job cards).');
  if (job.description.length < 20) errors.push('Add a job description.');
  const pay = parsePay(job.pay);
  return { job: { ...job, pay: job.pay || null, requirements: job.requirements || null, pay_rate: pay.rate, pay_unit: pay.unit }, errors };
}
const formLocals = { COUNTRIES, CONTRACT_TYPES };

router.get('/jobs/new', (req, res) => res.render(view('job-form'), { title: 'New job', job: { status: 'open', country: 'Australia' }, applicants: null, ...formLocals }));

router.post('/jobs', ah(async (req, res) => {
  const { job, errors } = readJob(req.body, res.locals.sectors);
  if (errors.length) {
    res.locals.flash = errors.map(text => ({ type: 'error', text }));
    return res.status(400).render(view('job-form'), { title: 'New job', job, applicants: null, ...formLocals });
  }
  const now = new Date();
  const { insertedId } = await col.jobs.insertOne({ ...job, published_at: now, updated_at: now });
  await logActivity(req.user._id, 'admin_job_create', `${job.title} (${insertedId})`, req.ip);
  req.flash('success', 'Job published.');
  res.redirect(`/admin/jobs/${insertedId}`);
}));

const loadJob = ah(async (req, res, next) => {
  const id = oid(req.params.id);
  const job = id && await col.jobs.findOne({ _id: id });
  if (!job) return res.status(404).render('error', { title: 'Not found', message: 'Job not found.' });
  req.job = withId(job);
  next();
});

router.get('/jobs/:id', loadJob, ah(async (req, res) => {
  const apps = await attachUsers(await col.jobApplications.find({ job_id: req.job._id }).sort({ created_at: -1 }).toArray());
  const uids = apps.map(a => oid(a.user_id)).filter(Boolean);
  const [profiles, users, cvs] = await Promise.all([
    col.applications.find({ user_id: { $in: uids } }).toArray(),
    col.users.find({ _id: { $in: uids } }, { projection: { phone: 1 } }).toArray(),
    col.documents.find({ user_id: { $in: uids }, kind: 'cv' }, { projection: { user_id: 1 } }).toArray(),
  ]);
  const applicants = apps.map(a => {
    const p = profiles.find(x => String(x.user_id) === a.user_id) || {};
    const u = users.find(x => String(x._id) === a.user_id) || {};
    return { ...a, phone: u.phone, profile_status: p.status || 'draft', work_rights: p.work_rights, has_cv: cvs.some(d => String(d.user_id) === a.user_id) };
  });
  res.render(view('job-form'), { title: req.job.title, job: req.job, applicants, ...formLocals });
}));

router.post('/jobs/:id', loadJob, ah(async (req, res) => {
  const { job, errors } = readJob(req.body, res.locals.sectors);
  if (errors.length) {
    res.locals.flash = errors.map(text => ({ type: 'error', text }));
    return res.status(400).render(view('job-form'), { title: req.job.title, job: { ...job, id: req.job.id }, applicants: [], ...formLocals });
  }
  await col.jobs.updateOne({ _id: req.job._id }, { $set: { ...job, updated_at: new Date() } });
  await logActivity(req.user._id, 'admin_job_update', `${job.title}${job.status !== req.job.status ? ' → ' + job.status : ''}`, req.ip);
  req.flash('success', 'Job saved.');
  res.redirect(`/admin/jobs/${req.job.id}`);
}));

router.post('/jobs/:id/delete', loadJob, ah(async (req, res) => {
  await col.jobApplications.deleteMany({ job_id: req.job._id });
  await col.jobs.deleteOne({ _id: req.job._id });
  await logActivity(req.user._id, 'admin_job_delete', req.job.title, req.ip);
  req.flash('success', 'Job deleted.');
  res.redirect('/admin/jobs');
}));

router.post('/job-applications/:id/status', ah(async (req, res) => {
  const id = oid(req.params.id);
  const ja = id && await col.jobApplications.findOne({ _id: id });
  const status = str(req.body.status, 30);
  if (ja && APP_STATUS[status]) {
    const job = await col.jobs.findOne({ _id: ja.job_id }, { projection: { title: 1 } });
    await col.jobApplications.updateOne({ _id: ja._id }, { $set: { status } });
    await logActivity(ja.user_id, 'job_app_status', `${job ? job.title : 'job'}: ${APP_STATUS[ja.status]} → ${APP_STATUS[status]} by ${req.user.name}`, req.ip);
    req.flash('success', 'Applicant updated.');
  }
  const back = str(req.body.back, 200);
  res.redirect(back.startsWith('/admin/') ? back : '/admin/jobs');
}));

// ---- Job alerts, messages, activity ----
router.get('/alerts', ah(async (req, res) => {
  const rows = withIds(await col.jobAlerts.find().sort({ created_at: -1 }).limit(500).toArray());
  const byCountry = (await col.jobAlerts.aggregate([{ $group: { _id: '$country', n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray()).map(r => ({ country: r._id || '—', n: r.n }));
  res.render(view('alerts'), { title: 'Job alerts', rows, byCountry });
}));

router.post('/alerts/:id/delete', ah(async (req, res) => {
  const id = oid(req.params.id);
  if (id) await col.jobAlerts.deleteOne({ _id: id });
  req.flash('success', 'Subscriber removed.');
  res.redirect('/admin/alerts');
}));

router.get('/messages', ah(async (req, res) => {
  const rows = withIds(await col.messages.find().sort({ created_at: -1 }).limit(200).toArray());
  res.render(view('messages'), { title: 'Enquiries', rows });
}));

router.post('/messages/:id/read', ah(async (req, res) => {
  const id = oid(req.params.id);
  const m = id && await col.messages.findOne({ _id: id });
  if (m) await col.messages.updateOne({ _id: id }, { $set: { is_read: !m.is_read } });
  res.redirect('/admin/messages');
}));

router.get('/activity', ah(async (req, res) => {
  const rows = await attachUsers(await col.activity.find().sort({ created_at: -1 }).limit(300).toArray());
  res.render(view('activity'), { title: 'Activity log', rows });
}));

// ---- Admin users & own account ----
const adminList = async () => withIds(await col.users.find({ role: 'admin' }, { projection: { password_hash: 0 } }).sort({ created_at: 1 }).toArray());

router.get('/users', ah(async (req, res) => res.render(view('users'), { title: 'Admin users', rows: await adminList(), form: {} })));

router.post('/users', ah(async (req, res) => {
  const form = { name: str(req.body.name, 120), email: str(req.body.email, 200).toLowerCase() };
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const errors = [];
  if (form.name.length < 2) errors.push('Enter a name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.push('Enter a valid email.');
  errors.push(...passwordProblems(password, 'admin'));
  if (!errors.length && await col.users.findOne({ email: form.email })) errors.push('An account with that email already exists.');
  if (!errors.length && !await passwordConfirmed(req)) errors.push('Enter your own password to confirm creating an admin.');
  if (errors.length) {
    res.locals.flash = errors.map(text => ({ type: 'error', text }));
    return res.status(400).render(view('users'), { title: 'Admin users', rows: await adminList(), form });
  }
  await col.users.insertOne({ ...form, phone: null, password_hash: await bcrypt.hash(password, 12), role: 'admin', active: true,
    created_at: new Date(), last_login_at: null, failed_logins: 0, locked_until: null });
  await logActivity(req.user._id, 'admin_user_create', form.email, req.ip);
  req.flash('success', `Admin account created for ${form.email}.`);
  res.redirect('/admin/users');
}));

router.post('/users/:id/toggle', ah(async (req, res) => {
  const id = oid(req.params.id);
  const u = id && await col.users.findOne({ _id: id, role: 'admin' });
  if (!u) return res.redirect('/admin/users');
  if (u._id.equals(req.user._id)) { req.flash('error', "You can't disable your own account."); return res.redirect('/admin/users'); }
  if (!await passwordConfirmed(req)) { req.flash('error', 'Enter your password to confirm this change.'); return res.redirect('/admin/users'); }
  const active = u.active === false;
  if (!active && await col.users.countDocuments({ role: 'admin', active: { $ne: false } }) <= 1) {
    req.flash('error', 'At least one active admin is required.');
    return res.redirect('/admin/users');
  }
  await col.users.updateOne({ _id: u._id }, { $set: { active } });
  if (!active) await endSessions(u._id);
  await logActivity(req.user._id, active ? 'admin_user_enabled' : 'admin_user_disabled', u.email, req.ip);
  req.flash('success', active ? 'Admin enabled.' : 'Admin disabled and signed out.');
  res.redirect('/admin/users');
}));

router.get('/account', (req, res) => res.render(view('account'), { title: 'My account' }));

router.post('/account/password', ah(async (req, res) => {
  const current = typeof req.body.current === 'string' ? req.body.current : '';
  const next = typeof req.body.password === 'string' ? req.body.password : '';
  const me = await col.users.findOne({ _id: req.user._id });
  const errors = [];
  if (!await bcrypt.compare(current, me.password_hash)) errors.push('Your current password is incorrect.');
  errors.push(...passwordProblems(next, 'admin'));
  if (next !== req.body.confirm) errors.push('New passwords do not match.');
  if (errors.length) {
    res.locals.flash = errors.map(text => ({ type: 'error', text }));
    return res.status(400).render(view('account'), { title: 'My account' });
  }
  await col.users.updateOne({ _id: me._id }, { $set: { password_hash: await bcrypt.hash(next, 12) } });
  await endSessions(me._id, req.sessionID); // sign out every other session for this account
  await logActivity(me._id, 'password_changed', null, req.ip);
  req.flash('success', 'Password changed. Your other sessions have been signed out.');
  res.redirect('/admin/account');
}));

module.exports = router;
