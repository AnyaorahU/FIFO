// One-off updates for databases created before FIFOconnect went worldwide. Safe to run more than once.
//   npm run migrate
// 1. Jobs, candidate profiles, job alerts and branches get a country (existing records = Australia).
// 2. Job pay is re-read so weekly/daily rates filter correctly.
// 3. Wording that promised phone calls with a consultant is replaced (exact original sentences only).
// 4. The sectors renamed in the admin to "Entry-level positions" and "Operators" get matching URL slugs,
//    photos and roles (only where the old default photo/roles are still in place, so custom edits are kept).
const { connect, client, col } = require('../db');
const { parsePay } = require('../lib/pay');

const SECTOR_UPDATES = [
  {
    names: ['entry-level positions', 'entry level positions'], fromSlug: 'mining-resources', toSlug: 'entry-level',
    oldImage: '/img/sector-mining.jpg', image: '/img/sector-entry-level.jpg', icon: 'users',
    oldRoles: ['Haul truck & plant operators', 'Diesel fitters', 'Electricians', 'Trades assistants', 'Drillers & offsiders', 'Shutdown crews'],
    roles: ['General hands & labourers', 'Trades assistants', 'Utility workers', 'Kitchen hands', 'Cleaners & housekeepers', 'Trainee operators'],
  },
  {
    names: ['operators'], fromSlug: 'construction', toSlug: 'operators',
    oldImage: '/img/sector-construction.jpg', image: '/img/sector-operators.jpg', icon: 'truck',
    oldRoles: ['General labourers', 'Carpenters & formworkers', 'Steel fixers', 'Riggers & scaffolders', 'Site supervisors'],
    roles: ['Haul truck operators', 'Excavator & dozer operators', 'Loader & grader operators', 'Drill rig operators', 'Forklift & reach truck operators', 'Warehouse & process operators'],
  },
];

const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);

async function countries() {
  const noCountry = { $or: [{ country: { $exists: false } }, { country: null }, { country: '' }] };
  const jobs = await col.jobs.updateMany(noCountry, { $set: { country: 'Australia' } });
  const apps = await col.applications.updateMany({ ...noCountry, state: { $nin: [null, ''] } }, { $set: { country: 'Australia' } });
  const branches = await col.branches.updateMany(noCountry, { $set: { country: 'Australia' } });
  console.log(`  country set on ${jobs.modifiedCount} jobs, ${apps.modifiedCount} profiles, ${branches.modifiedCount} branches`);

  // Job alerts were per Australian state; keep one Australia alert per email.
  let moved = 0, merged = 0;
  for (const alert of await col.jobAlerts.find(noCountry).toArray()) {
    if (await col.jobAlerts.findOne({ email: alert.email, country: 'Australia' })) {
      await col.jobAlerts.deleteOne({ _id: alert._id }); merged++;
    } else {
      await col.jobAlerts.updateOne({ _id: alert._id }, { $set: { country: 'Australia' }, $unset: { state: '' } }); moved++;
    }
  }
  console.log(`  job alerts: ${moved} moved to Australia, ${merged} duplicates merged`);
}

async function socials() {
  // Facebook and YouTube were replaced by TikTok and Telegram. The old links aren't moved across (they're different sites).
  const s = await col.settings.findOne({ _id: 'site' }, { projection: { socialFacebook: 1, socialYoutube: 1 } });
  if (!s || (s.socialFacebook === undefined && s.socialYoutube === undefined)) return console.log('  socials: already up to date');
  const dropped = [s.socialFacebook && `Facebook (${s.socialFacebook})`, s.socialYoutube && `YouTube (${s.socialYoutube})`].filter(Boolean);
  await col.settings.updateOne({ _id: 'site' }, { $unset: { socialFacebook: '', socialYoutube: '' } });
  console.log(`  socials: Facebook/YouTube fields removed${dropped.length ? ` (were ${dropped.join(', ')}); add TikTok/Telegram links in Admin > Content > Site settings` : ''}`);
}

// Wording that promised phone calls with a consultant or the team. Only exact original sentences are replaced,
// so anything an admin has rewritten is left alone.
const WORDING = [
  ['A consultant calls to talk about your experience, tickets and preferred rosters.', 'Our team reviews your experience, tickets and preferred rosters.'],
  ['your consultant is always a phone call away.', 'our support team is always available by email or through your dashboard.'],
  ['Conversation: a consultant learns about your experience and goals.', 'Review: our team assesses your experience, tickets and goals.'],
  ["Your consultant will check in during the first few days. Tell them if anything isn't what you expected.", "We'll check in by email during the first few days. Let us know through your dashboard if anything isn't what you expected."],
  ['I applied online and my consultant called me the next day. She sorted', 'I applied online and the team reviewed my profile the next day. They sorted'],
  ['A consultant will call you back within one business day.', 'Send us your requirements and we will reply by email within one business day.'],
];
const LABELS = [['Talk to a specialist', 'Send your requirements'], ['Talk to us', 'Make an enquiry']];

const reword = value => {
  if (typeof value === 'string') return WORDING.reduce((s, [from, to]) => s.split(from).join(to), value);
  if (Array.isArray(value)) return value.map(reword);
  return value;
};

async function wording() {
  let changed = 0;
  const targets = [['pages', ['body', 'intro']], ['news', ['body', 'excerpt']], ['testimonials', ['quote']], ['settings', ['ctaText', 'ctaTitle']]];
  for (const [name, fields] of targets) {
    for (const doc of await col[name].find({}, { projection: Object.fromEntries(fields.concat('ctaLabel').map(f => [f, 1])) }).toArray()) {
      const set = {};
      for (const f of fields) {
        const next = reword(doc[f]);
        if (JSON.stringify(next) !== JSON.stringify(doc[f])) set[f] = next;
      }
      if (name === 'pages') {
        const label = LABELS.find(([from]) => doc.ctaLabel === from);
        if (label) set.ctaLabel = label[1];
      }
      if (Object.keys(set).length) { await col[name].updateOne({ _id: doc._id }, { $set: set }); changed++; }
    }
  }
  console.log(`  wording: phone-call phrases replaced in ${changed} item${changed === 1 ? '' : 's'}`);
}

async function pay() {
  let n = 0;
  for (const job of await col.jobs.find({ pay: { $nin: [null, ''] } }, { projection: { pay: 1, pay_rate: 1, pay_unit: 1 } }).toArray()) {
    const p = parsePay(job.pay);
    if (p.rate !== job.pay_rate || p.unit !== job.pay_unit) { await col.jobs.updateOne({ _id: job._id }, { $set: { pay_rate: p.rate, pay_unit: p.unit } }); n++; }
  }
  console.log(`  pay re-read on ${n} jobs`);
}

async function renameSlug(from, to) {
  await col.sectors.updateOne({ slug: from }, { $set: { slug: to }, $addToSet: { old_slugs: from } });
  await Promise.all([
    col.jobs.updateMany({ sector: from }, { $set: { sector: to } }),
    col.applications.updateMany({ job_sector: from }, { $set: { job_sector: to } }),
    col.messages.updateMany({ sector: from }, { $set: { sector: to } }),
  ]);
  // Menu links pointing at the old sector page.
  for (const menu of await col.menus.find({ 'groups.links.href': `/sectors/${from}` }).toArray()) {
    menu.groups.forEach(g => g.links.forEach(l => { if (l.href === `/sectors/${from}`) l.href = `/sectors/${to}`; }));
    await col.menus.updateOne({ _id: menu._id }, { $set: { groups: menu.groups } });
  }
}

async function sectors() {
  for (const u of SECTOR_UPDATES) {
    let sector = await col.sectors.findOne({ slug: u.toSlug });
    if (!sector) {
      const candidate = await col.sectors.findOne({ slug: u.fromSlug });
      if (!candidate || !u.names.includes(String(candidate.name || '').trim().toLowerCase())) {
        console.log(`  sector "${u.toSlug}": not found (no sector named ${u.names[0]}), skipped`);
        continue;
      }
      if (await col.sectors.findOne({ slug: u.toSlug })) { console.log(`  slug ${u.toSlug} already used, skipped`); continue; }
      await renameSlug(u.fromSlug, u.toSlug);
      sector = await col.sectors.findOne({ slug: u.toSlug });
      console.log(`  sector "${sector.name}": URL changed /sectors/${u.fromSlug} → /sectors/${u.toSlug} (jobs, profiles and menus updated)`);
    }
    const set = {};
    if (!sector.image || sector.image === u.oldImage) set.image = u.image;
    if (!sector.roles || !sector.roles.length || sameList(sector.roles, u.oldRoles)) set.roles = u.roles;
    if (set.image) set.icon = u.icon;
    // Menu labels that still use the old sector name.
    if (Object.keys(set).length) {
      await col.sectors.updateOne({ _id: sector._id }, { $set: { ...set, updated_at: new Date() } });
      console.log(`  sector "${sector.name}": updated ${Object.keys(set).filter(k => k !== 'icon').join(' and ')}`);
    } else {
      console.log(`  sector "${sector.name}": photo and roles already customised, kept`);
    }
    for (const menu of await col.menus.find({ 'groups.links.href': `/sectors/${u.toSlug}` }).toArray()) {
      let changed = false;
      menu.groups.forEach(g => g.links.forEach(l => {
        if (l.href === `/sectors/${u.toSlug}` && l.label !== sector.name) { l.label = sector.name; changed = true; }
      }));
      if (changed) await col.menus.updateOne({ _id: menu._id }, { $set: { groups: menu.groups } });
    }
  }
}

(async () => {
  await connect();
  console.log('Migrating…');
  await countries();
  await pay();
  await socials();
  await wording();
  await sectors();
  console.log('Done. Changes appear on the site within 30 seconds.');
})().catch(e => { console.error('Migration failed:', e.message); process.exitCode = 1; }).finally(() => client.close());
