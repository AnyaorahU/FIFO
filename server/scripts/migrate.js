// One-off updates for databases created before FIFOconnect went worldwide. Safe to run more than once.
//   npm run migrate
// 1. Jobs, candidate profiles, job alerts and branches get a country (existing records = Australia).
// 2. Job pay is re-read so weekly/daily rates filter correctly.
// 3. The sectors renamed in the admin to "Entry-level positions" and "Operators" get matching URL slugs,
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
  await sectors();
  console.log('Done. Changes appear on the site within 30 seconds.');
})().catch(e => { console.error('Migration failed:', e.message); process.exitCode = 1; }).finally(() => client.close());
