// MongoDB connection, collections, indexes and GridFS buckets.
const { MongoClient, ObjectId, GridFSBucket } = require('mongodb');
const config = require('./config');

const client = new MongoClient(config.mongoUri, {
  maxPoolSize: 20,
  serverSelectionTimeoutMS: 10000,
  appName: 'fifoconnect',
});

let db;
const col = {};
const buckets = {};

const COLLECTIONS = [
  // accounts & recruitment
  'users', 'applications', 'documents', 'jobs', 'jobApplications', 'jobAlerts', 'messages', 'activity',
  // site content (edited in Admin > Content)
  'settings', 'menus', 'sectors', 'services', 'promos', 'pages', 'branches', 'news', 'testimonials', 'missionSlides', 'values',
];

async function connect() {
  await client.connect();
  db = client.db(config.mongoDb);
  for (const name of COLLECTIONS) col[name] = db.collection(name);
  buckets.documents = new GridFSBucket(db, { bucketName: 'documentFiles' });
  buckets.media = new GridFSBucket(db, { bucketName: 'media' });
  await applyValidators();
  await ensureIndexes();
  return db;
}

async function ensureIndexes() {
  // Job alerts moved from Australian state to country.
  await col.jobAlerts.dropIndex('email_1_state_1').catch(() => {});
  await Promise.all([
    col.users.createIndex({ email: 1 }, { unique: true }),
    col.users.createIndex({ role: 1, created_at: -1 }),
    col.applications.createIndex({ user_id: 1 }, { unique: true }),
    col.documents.createIndex({ user_id: 1 }),
    col.jobs.createIndex({ status: 1, published_at: -1 }),
    col.jobs.createIndex({ sector: 1 }),
    col.jobApplications.createIndex({ job_id: 1, user_id: 1 }, { unique: true }),
    col.jobApplications.createIndex({ user_id: 1 }),
    col.jobAlerts.createIndex({ email: 1, country: 1 }, { unique: true, partialFilterExpression: { country: { $type: 'string' } } }),
    col.activity.createIndex({ created_at: -1 }),
    col.activity.createIndex({ user_id: 1, created_at: -1 }),
    col.messages.createIndex({ created_at: -1 }),
    col.sectors.createIndex({ slug: 1 }, { unique: true }),
    col.pages.createIndex({ path: 1 }, { unique: true }),
    col.news.createIndex({ slug: 1 }, { unique: true }),
  ]);
}

// Database-level rules for the most sensitive collections, so malformed records are rejected by MongoDB itself.
// Needs a database user allowed to run collMod (e.g. dbAdmin); otherwise the app keeps working and logs a note.
const VALIDATORS = {
  users: { $jsonSchema: { bsonType: 'object', required: ['email', 'password_hash', 'role'], properties: {
    email: { bsonType: 'string', maxLength: 200 }, password_hash: { bsonType: 'string' },
    role: { enum: ['candidate', 'admin'] }, active: { bsonType: 'bool' } } } },
  applications: { $jsonSchema: { bsonType: 'object', required: ['user_id', 'status'], properties: {
    user_id: { bsonType: 'objectId' }, status: { enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected'] } } } },
  documents: { $jsonSchema: { bsonType: 'object', required: ['user_id', 'kind', 'file_id'], properties: {
    user_id: { bsonType: 'objectId' }, file_id: { bsonType: 'objectId' }, kind: { enum: ['cv', 'passport', 'certificate'] } } } },
  jobApplications: { $jsonSchema: { bsonType: 'object', required: ['job_id', 'user_id', 'status'], properties: {
    job_id: { bsonType: 'objectId' }, user_id: { bsonType: 'objectId' }, status: { enum: ['new', 'shortlisted', 'placed', 'unsuccessful'] } } } },
  jobs: { $jsonSchema: { bsonType: 'object', required: ['title', 'status'], properties: {
    title: { bsonType: 'string', maxLength: 200 }, status: { enum: ['open', 'closed'] } } } },
};

async function applyValidators() {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
  try {
    for (const [name, validator] of Object.entries(VALIDATORS)) {
      if (existing.has(name)) await db.command({ collMod: name, validator, validationLevel: 'moderate', validationAction: 'error' });
      else await db.createCollection(name, { validator, validationLevel: 'moderate', validationAction: 'error' });
    }
  } catch (e) {
    if (e.code === 13 || /not authorized|unauthorized/i.test(e.message)) {
      console.warn('[db] Schema validation rules not applied: the database user lacks permission (optional; see README).');
    } else throw e;
  }
}

// Parses an id from user input; returns null for anything that isn't a valid ObjectId.
function oid(value) {
  const s = String(value || '');
  return /^[a-f0-9]{24}$/i.test(s) ? new ObjectId(s) : null;
}

// Adds a string `id` so templates can use doc.id.
function withId(doc) {
  if (!doc) return doc;
  doc.id = String(doc._id);
  return doc;
}
const withIds = docs => docs.map(withId);

async function logActivity(userId, action, detail, ip) {
  await col.activity.insertOne({
    user_id: userId ? oid(userId) : null, action, detail: detail ?? null, ip: ip ?? null, created_at: new Date(),
  });
}

module.exports = { connect, client, col, buckets, oid, withId, withIds, logActivity, ObjectId, getDb: () => db };
