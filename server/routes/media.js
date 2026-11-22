const express = require('express');
const { buckets, oid } = require('../db');
const { ah } = require('../lib/middleware');

const router = express.Router();

// Public content images uploaded in Admin > Content (logos, banners, sector photos...).
router.get('/:id', ah(async (req, res, next) => {
  const id = oid(req.params.id);
  const file = id && await buckets.media.find({ _id: id }).next();
  if (!file) return next();
  res.set({
    'Content-Type': (file.metadata && file.metadata.contentType) || 'application/octet-stream',
    'Cache-Control': 'public, max-age=604800',
    'X-Content-Type-Options': 'nosniff',
  });
  buckets.media.openDownloadStream(id).on('error', () => res.destroy()).pipe(res);
}));

module.exports = router;
