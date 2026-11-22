const express = require('express');
const { col, oid, logActivity } = require('../db');
const { requireAuth, ah } = require('../lib/middleware');
const { openFile } = require('../lib/uploads');

const router = express.Router();

// Candidate documents are private: only the owner or an admin can download them.
router.get('/:id', requireAuth, ah(async (req, res, next) => {
  const id = oid(req.params.id);
  // Candidates can only ever load their own documents; admins can load any.
  const filter = req.user.role === 'admin' ? { _id: id } : { _id: id, user_id: req.user._id };
  const doc = id && await col.documents.findOne(filter);
  if (!doc) return next();
  if (req.user.role === 'admin' && !doc.user_id.equals(req.user._id)) {
    await logActivity(req.user._id, 'admin_download', `document ${doc._id} of user ${doc.user_id}`, req.ip);
  }
  res.set({
    'Content-Type': doc.mime || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.original_name).replace(/%20/g, ' ')}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  openFile('documents', doc.file_id).on('error', () => res.destroy()).pipe(res);
}));

module.exports = router;
