const express = require('express');
const { col, oid, withId, withIds, logActivity } = require('../db');
const { COUNTRIES, WORK_RIGHTS, AVAILABILITY } = require('../lib/constants');
const { requireCandidate, ah, str } = require('../lib/middleware');
const { uploader, hasValidSignature, saveFile, deleteFile, ALLOWED, LABELS, MAX_MB } = require('../lib/uploads');

const router = express.Router();
router.use(requireCandidate);

async function getState(userId) {
  const [app, docs] = await Promise.all([
    col.applications.findOne({ user_id: userId }),
    col.documents.find({ user_id: userId }, { projection: { file_id: 0 } }).sort({ uploaded_at: -1 }).toArray(),
  ]);
  withIds(docs);
  return {
    app: app || { status: 'draft', licences: [] },
    cv: docs.find(d => d.kind === 'cv'),
    passport: docs.find(d => d.kind === 'passport'),
    certificates: docs.filter(d => d.kind === 'certificate'),
  };
}

router.get('/', ah(async (req, res) => {
  const state = await getState(req.user._id);
  const apps = await col.jobApplications.find({ user_id: req.user._id }).sort({ created_at: -1 }).toArray();
  const jobs = await col.jobs.find({ _id: { $in: apps.map(a => a.job_id) } }).toArray();
  const jobApps = apps.map(a => {
    const j = jobs.find(x => x._id.equals(a.job_id)) || {};
    return { ...a, job_id: String(a.job_id), title: j.title || '(job removed)', location: j.location, state: j.state, country: j.country, contract_type: j.contract_type, job_status: j.status };
  });
  const a = state.app;
  const steps = [
    { label: 'Profile', done: Boolean(req.user.phone && a.country && a.work_rights) },
    { label: 'Job sector', done: Boolean(a.job_sector) },
    { label: 'CV', done: Boolean(state.cv) },
    { label: 'Passport', done: Boolean(state.passport) },
    { label: 'Submit', done: a.status !== 'draft' },
  ];
  const ready = Boolean(a.job_sector && state.cv && state.passport);
  res.render('dashboard', { title: 'My dashboard', ...state, jobApps, steps, ready, ALLOWED, MAX_MB });
}));

router.post('/profile', ah(async (req, res) => {
  const name = str(req.body.name, 120);
  if (name.length < 2) {
    req.flash('error', 'Please enter your full name.');
    return res.redirect('/dashboard#profile');
  }
  const allowedLicences = res.locals.site.licences || [];
  const workRights = WORK_RIGHTS[req.body.work_rights] ? req.body.work_rights : null;
  const sector = res.locals.sectors.some(s => s.slug === req.body.job_sector) ? req.body.job_sector : null;
  const update = {
    job_sector: sector,
    location: str(req.body.location, 120) || null,
    summary: str(req.body.summary, 2000) || null,
    country: COUNTRIES.includes(req.body.country) ? req.body.country : null,
    work_rights: workRights,
    visa_type: workRights === 'visa' || workRights === 'sponsorship' ? str(req.body.visa_type, 80) || null : null,
    licences: [].concat(req.body.licences || []).filter(l => typeof l === 'string' && allowedLicences.includes(l)),
    availability: AVAILABILITY.includes(req.body.availability) ? req.body.availability : null,
    updated_at: new Date(),
  };
  await col.users.updateOne({ _id: req.user._id }, { $set: { name, phone: str(req.body.phone, 40) || null } });
  await col.applications.updateOne({ user_id: req.user._id }, { $set: update, $setOnInsert: { status: 'draft' } }, { upsert: true });
  await logActivity(req.user._id, 'profile_update', sector ? `sector: ${sector}` : null, req.ip);
  req.flash('success', 'Your profile has been saved.');
  res.redirect('/dashboard#profile');
}));

router.post('/upload/:kind', (req, res, next) => {
  const kind = req.params.kind;
  if (!['cv', 'passport', 'certificate'].includes(kind)) return next();
  const handler = kind === 'certificate' ? uploader(kind, { maxFiles: 5 }).array('files', 5) : uploader(kind).single('file');

  handler(req, res, err => {
    const done = msg => { req.flash('error', msg); res.redirect('/dashboard#documents'); };
    if (err) {
      return done(err.code === 'LIMIT_FILE_SIZE' ? `Files must be ${MAX_MB} MB or smaller.`
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'You can upload up to 5 certificates at a time.'
        : err.message);
    }
    const files = req.files || (req.file ? [req.file] : []);
    if (!files.length) return done('Please choose a file to upload.');
    const bad = files.find(f => !hasValidSignature(f));
    if (bad) return done(`"${bad.originalname}" doesn't look like a valid ${bad.originalname.split('.').pop().toUpperCase()} file.`);

    (async () => {
      // CV and passport are single documents: replace any previous upload.
      if (kind !== 'certificate') {
        const old = await col.documents.find({ user_id: req.user._id, kind }).toArray();
        await Promise.all(old.map(d => deleteFile('documents', d.file_id)));
        await col.documents.deleteMany({ user_id: req.user._id, kind });
      }
      const title = kind === 'certificate' ? str(req.body.title, 120) || null : null;
      for (const f of files) {
        const fileId = await saveFile('documents', f, { user_id: req.user._id, kind });
        await col.documents.insertOne({
          user_id: req.user._id, kind, title, original_name: f.originalname.slice(0, 200), file_id: fileId,
          mime: f.mimetype, size: f.size, uploaded_at: new Date(),
        });
      }
      await col.applications.updateOne({ user_id: req.user._id }, { $set: { updated_at: new Date() } });
      await logActivity(req.user._id, 'upload', `${LABELS[kind]}: ${files.map(f => f.originalname).join(', ')}`, req.ip);
      req.flash('success', `${LABELS[kind]} uploaded successfully.`);
      res.redirect('/dashboard#documents');
    })().catch(next);
  });
});

router.post('/documents/:id/delete', ah(async (req, res) => {
  const id = oid(req.params.id);
  const doc = id && await col.documents.findOne({ _id: id, user_id: req.user._id });
  if (doc) {
    await deleteFile('documents', doc.file_id);
    await col.documents.deleteOne({ _id: doc._id });
    await logActivity(req.user._id, 'delete_document', `${LABELS[doc.kind]}: ${doc.original_name}`, req.ip);
    req.flash('success', 'Document removed.');
  }
  res.redirect('/dashboard#documents');
}));

router.post('/submit', ah(async (req, res) => {
  const { app, cv, passport } = await getState(req.user._id);
  if (!app.job_sector || !cv || !passport) {
    req.flash('error', 'Please choose a job sector and upload your CV and passport before submitting.');
    return res.redirect('/dashboard');
  }
  if (app.status === 'draft' || app.status === 'rejected') {
    const now = new Date();
    await col.applications.updateOne({ user_id: req.user._id }, { $set: { status: 'submitted', submitted_at: now, updated_at: now } });
    await logActivity(req.user._id, 'submit_application', null, req.ip);
    req.flash('success', 'Your profile has been submitted. Our team will review it; you will see the result here and by email.');
  }
  res.redirect('/dashboard');
}));

module.exports = router;
