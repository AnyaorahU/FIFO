// Admin > Content: generic create/edit/delete for every content type in server/lib/content-schema.js.
const express = require('express');
const path = require('path');
const { col, oid, withId, withIds, logActivity } = require('../server/db');
const { ah } = require('../server/lib/middleware');
const { types, allFields, parseForm, formValue } = require('../server/lib/content-schema');
const { invalidate } = require('../server/lib/content-store');
const { uploader, hasValidSignature, saveFile, MAX_MB } = require('../server/lib/uploads');

const view = name => path.join(__dirname, 'views', name);

async function renameSectorSlug(from, to) {
  await Promise.all([
    col.jobs.updateMany({ sector: from }, { $set: { sector: to } }),
    col.applications.updateMany({ job_sector: from }, { $set: { job_sector: to } }),
    col.messages.updateMany({ sector: from }, { $set: { sector: to } }),
  ]);
}
const router = express.Router();

// Paths owned by the application; info pages may not use them.
const RESERVED = ['/', '/login', '/logout', '/register', '/dashboard', '/jobs', '/files', '/media', '/admin', '/companies', '/companies/enquiry',
  '/about', '/sectors', '/branches', '/news', '/contact', '/job-alerts', '/css', '/js', '/img'];
const isReserved = p => RESERVED.some(r => p === r || (r !== '/' && r !== '/companies' && p.startsWith(r + '/')));

const getType = (req, res, next) => {
  const def = types[req.params.type];
  if (!def) return res.status(404).render('error', { title: 'Not found', message: 'Unknown content type.' });
  req.def = def;
  req.typeName = req.params.type;
  next();
};

// Image fields accept an uploaded file (stored in GridFS) or a typed URL.
function withUploads(req, res, next) {
  const imageFields = allFields(req.typeName).filter(f => f.type === 'image').map(f => ({ name: f.name, maxCount: 1 }));
  if (!imageFields.length) return next();
  uploader('media', { maxFiles: imageFields.length }).fields(imageFields)(req, res, err => {
    if (err) {
      req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? `Images must be ${MAX_MB} MB or smaller.` : err.message;
      return next();
    }
    (async () => {
      req.uploads = {};
      for (const [field, files] of Object.entries(req.files || {})) {
        const f = files[0];
        if (!hasValidSignature(f)) { req.uploadError = `"${f.originalname}" is not a valid image.`; continue; }
        const id = await saveFile('media', f, { uploaded_by: req.user._id });
        req.uploads[field] = `/media/${id}`;
      }
      next();
    })().catch(next);
  });
}

function formData(def, typeName, doc) {
  const fields = allFields(typeName);
  return Object.fromEntries(fields.map(f => [f.name, formValue(f, doc ? doc[f.name] : undefined)]));
}

async function validateDoc(typeName, doc, id) {
  const errors = [];
  if (typeName === 'pages') {
    if (isReserved(doc.path)) errors.push(`The path ${doc.path} is used by the site itself. Choose another.`);
    const clash = await col.pages.findOne({ path: doc.path, ...(id ? { _id: { $ne: id } } : {}) });
    if (clash) errors.push(`Another page already uses ${doc.path}.`);
  }
  if (typeName === 'sectors' || typeName === 'news') {
    const clash = await col[typeName].findOne({ slug: doc.slug, ...(id ? { _id: { $ne: id } } : {}) });
    if (clash) errors.push(`Another item already uses the slug "${doc.slug}".`);
  }
  if (typeName === 'menus' && !doc.href && !(doc.groups || []).length) errors.push('Add a link, or some dropdown/footer links.');
  return errors;
}

router.get('/', ah(async (req, res) => {
  const counts = {};
  for (const name of Object.keys(types)) counts[name] = types[name].single ? null : await col[name].countDocuments();
  res.render(view('content-index'), { title: 'Content', types, counts });
}));

// ---- Single-document types (site settings) ----
router.get('/settings', ah(async (req, res) => {
  const doc = await col.settings.findOne({ _id: 'site' });
  res.render(view('content-form'), { title: types.settings.label, def: types.settings, typeName: 'settings', values: formData(types.settings, 'settings', doc), id: 'site' });
}));

router.post('/settings', (req, res, next) => { req.params.type = 'settings'; next(); }, getType, withUploads, ah(async (req, res) => {
  const { doc, errors } = parseForm('settings', req.body, req.uploads);
  if (req.uploadError) errors.push(req.uploadError);
  if (errors.length) {
    res.locals.flash = errors.map(text => ({ type: 'error', text }));
    return res.status(400).render(view('content-form'), { title: types.settings.label, def: types.settings, typeName: 'settings', values: formData(types.settings, 'settings', doc), id: 'site' });
  }
  await col.settings.updateOne({ _id: 'site' }, { $set: { ...doc, updated_at: new Date() } }, { upsert: true });
  invalidate();
  await logActivity(req.user._id, 'content_update', 'Site settings', req.ip);
  req.flash('success', 'Site settings saved.');
  res.redirect('/admin/content/settings');
}));

// ---- Collections ----
router.get('/:type', getType, ah(async (req, res) => {
  const rows = withIds(await col[req.typeName].find().sort(req.def.sort || { _id: 1 }).toArray());
  res.render(view('content-list'), { title: req.def.label, def: req.def, typeName: req.typeName, rows });
}));

router.get('/:type/new', getType, (req, res) => {
  const defaults = req.typeName === 'sectors' ? { active: true, color: 'navy' } : {};
  res.render(view('content-form'), { title: `New: ${req.def.label}`, def: req.def, typeName: req.typeName, values: formData(req.def, req.typeName, defaults), id: null });
});

router.post('/:type', getType, withUploads, ah(async (req, res) => {
  const { doc, errors } = parseForm(req.typeName, req.body, req.uploads);
  if (req.uploadError) errors.push(req.uploadError);
  if (!errors.length) errors.push(...await validateDoc(req.typeName, doc));
  if (errors.length) {
    res.locals.flash = errors.map(text => ({ type: 'error', text }));
    return res.status(400).render(view('content-form'), { title: `New: ${req.def.label}`, def: req.def, typeName: req.typeName, values: formData(req.def, req.typeName, doc), id: null });
  }
  const { insertedId } = await col[req.typeName].insertOne({ ...doc, created_at: new Date(), updated_at: new Date() });
  invalidate();
  await logActivity(req.user._id, 'content_create', `${req.def.label}: ${doc[req.def.titleField] || insertedId}`, req.ip);
  req.flash('success', 'Saved.');
  res.redirect(`/admin/content/${req.typeName}/${insertedId}`);
}));

const loadItem = ah(async (req, res, next) => {
  const id = oid(req.params.id);
  const item = id && await col[req.typeName].findOne({ _id: id });
  if (!item) return res.status(404).render('error', { title: 'Not found', message: 'Item not found.' });
  req.item = withId(item);
  next();
});

router.get('/:type/:id', getType, loadItem, (req, res) => {
  res.render(view('content-form'), { title: req.item[req.def.titleField] || req.def.label, def: req.def, typeName: req.typeName, values: formData(req.def, req.typeName, req.item), id: req.item.id, item: req.item });
});

router.post('/:type/:id', getType, loadItem, withUploads, ah(async (req, res) => {
  const { doc, errors } = parseForm(req.typeName, req.body, req.uploads);
  if (req.uploadError) errors.push(req.uploadError);
  if (!errors.length) errors.push(...await validateDoc(req.typeName, doc, req.item._id));
  if (errors.length) {
    res.locals.flash = errors.map(text => ({ type: 'error', text }));
    return res.status(400).render(view('content-form'), { title: req.item[req.def.titleField] || req.def.label, def: req.def, typeName: req.typeName, values: formData(req.def, req.typeName, doc), id: req.item.id, item: req.item });
  }
  await col[req.typeName].updateOne({ _id: req.item._id }, { $set: { ...doc, updated_at: new Date() } });
  // A sector's slug is stored on jobs, candidate profiles and enquiries: carry a rename through to all of them.
  if (req.typeName === 'sectors' && doc.slug !== req.item.slug) {
    await renameSectorSlug(req.item.slug, doc.slug);
    await col.sectors.updateOne({ _id: req.item._id }, { $addToSet: { old_slugs: req.item.slug }, $pull: { old_slugs: doc.slug } });
  }
  invalidate();
  await logActivity(req.user._id, 'content_update', `${req.def.label}: ${doc[req.def.titleField] || req.item.id}`, req.ip);
  req.flash('success', 'Saved.');
  res.redirect(`/admin/content/${req.typeName}/${req.item.id}`);
}));

router.post('/:type/:id/delete', getType, loadItem, ah(async (req, res) => {
  if (req.typeName === 'sectors' && await col.jobs.countDocuments({ sector: req.item.slug })) {
    req.flash('error', 'This sector still has jobs. Move or delete those jobs first, or untick "Show on site" to hide it.');
    return res.redirect(`/admin/content/sectors/${req.item.id}`);
  }
  await col[req.typeName].deleteOne({ _id: req.item._id });
  invalidate();
  await logActivity(req.user._id, 'content_delete', `${req.def.label}: ${req.item[req.def.titleField] || req.item.id}`, req.ip);
  req.flash('success', 'Deleted.');
  res.redirect(`/admin/content/${req.typeName}`);
}));

module.exports = router;
module.exports.renameSectorSlug = renameSectorSlug;
