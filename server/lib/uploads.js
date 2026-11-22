// File uploads kept in MongoDB GridFS: candidate documents (private) and content images (public media).
const multer = require('multer');
const path = require('path');
const { Readable } = require('stream');
const { buckets, oid } = require('../db');
const config = require('../config');

const MAX_MB = config.maxUploadMb;

const ALLOWED = {
  cv: ['.pdf', '.doc', '.docx'],
  passport: ['.pdf', '.jpg', '.jpeg', '.png'],
  certificate: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
  media: ['.jpg', '.jpeg', '.png', '.webp'],
};
const LABELS = { cv: 'CV / Résumé', passport: 'Passport / ID', certificate: 'Certificate', media: 'Image' };
const MIME = { '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// File signatures, checked against the bytes so a renamed file can't slip through.
const SIGNATURES = {
  '.pdf': [[0x25, 0x50, 0x44, 0x46]],
  '.png': [[0x89, 0x50, 0x4e, 0x47]],
  '.jpg': [[0xff, 0xd8, 0xff]],
  '.jpeg': [[0xff, 0xd8, 0xff]],
  '.docx': [[0x50, 0x4b, 0x03, 0x04]],
  '.doc': [[0xd0, 0xcf, 0x11, 0xe0]],
  '.webp': [[0x52, 0x49, 0x46, 0x46]],
};

function uploader(kind, { maxFiles = 1 } = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: maxFiles },
    fileFilter(req, file, cb) {
      if (!file.originalname) return cb(null, false); // empty file input: nothing chosen
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED[kind].includes(ext)) return cb(new Error(`${LABELS[kind]}: allowed file types are ${ALLOWED[kind].join(', ')}`));
      cb(null, true);
    },
  });
}

function hasValidSignature(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const sigs = SIGNATURES[ext];
  return Boolean(sigs) && sigs.some(sig => sig.every((b, i) => file.buffer[i] === b));
}

function safeName(name) {
  return path.basename(String(name)).replace(/[^\w.\- ()]/g, '_').slice(0, 150) || 'file';
}

// Saves a multer file to a bucket and returns the new GridFS id.
function saveFile(bucketName, file, metadata = {}) {
  const ext = path.extname(file.originalname).toLowerCase();
  return new Promise((resolve, reject) => {
    const upload = buckets[bucketName].openUploadStream(safeName(file.originalname), {
      metadata: { ...metadata, contentType: MIME[ext] || 'application/octet-stream' },
    });
    Readable.from(file.buffer).pipe(upload).on('error', reject).on('finish', () => resolve(upload.id));
  });
}

async function deleteFile(bucketName, id) {
  const fid = oid(id);
  if (!fid) return;
  try { await buckets[bucketName].delete(fid); } catch { /* already gone */ }
}

function openFile(bucketName, id) {
  return buckets[bucketName].openDownloadStream(id);
}

module.exports = { uploader, hasValidSignature, saveFile, deleteFile, openFile, ALLOWED, LABELS, MIME, MAX_MB };
