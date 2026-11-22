// Seeds MongoDB with the site content, sample jobs, the admin account and a demo candidate.
//   npm run seed            -> fills empty collections only (safe to run any time)
//   npm run seed -- --force -> replaces all site content (not users, jobs or candidate data)
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { connect, client, col } = require('../db');
const { parsePay } = require('../lib/pay');
const { passwordProblems } = require('../routes/auth');
const data = require('../seed/content-data');
const sectorRows = require('../seed/sectors-data');
const jobRows = require('../seed/jobs-data');

const force = process.argv.includes('--force');
const img = name => (name ? (name.startsWith('/') || name.startsWith('http') ? name : `/img/${name}.jpg`) : '');
const PALETTE_KEYS = ['navy', 'royal', 'orange', 'navy-2'];

// Converts the old { h, p[], list[] } page sections into the editable text format.
const toBody = sections => sections.map(s => [s.h ? `## ${s.h}` : '', ...(s.p || []), ...(s.list || []).map(li => `- ${li}`)].filter(Boolean).join('\n\n')).join('\n\n');

function contentDocs() {
  const now = new Date();
  const settings = {
    _id: 'site',
    name: process.env.SITE_NAME || 'FIFOconnect',
    tagline: 'Connecting workers to able employers around the world',
    metaDescription: 'FIFO and remote-site recruitment. Connecting workers to able employers around the world. Find a FIFO job, submit your CV or request crews.',
    phone: process.env.SITE_PHONE || '',
    email: process.env.SITE_EMAIL || '',
    logo: '/img/brand/logo-wordmark.png',
    heroTitle: 'Aspire for better,\nby working together',
    heroText: 'For almost 3 years, FIFOconnect has brought companies closer to support, recruit and develop the workers of today and tomorrow.',
    heroImage: '/img/hero-candidates.jpg',
    searchPlaceholder: 'Profession, work type, city…',
    opportunitiesHeading: 'Discover our opportunities',
    opportunitiesChipAll: 'New',
    opportunitiesCount: 4,
    opportunitiesMode: 'featured',
    opportunitiesButton: 'Discover all our offers',
    opportunitiesEmpty: 'No current jobs in this category.',
    sectorsHeading: 'Discover the FIFO sectors we are recruiting in',
    sectorsButton: 'All our sectors',
    sectorsLinkLabel: 'Learn more',
    teamsHeading: 'Our teams by your side',
    newsHeading: 'Employment news',
    portalTitle: 'Your candidate portal',
    portalPoints: ['Upload your CV, passport and licences', 'Apply for jobs in one click', 'Track your applications', 'Keep your availability up to date'],
    companiesHeroTitle: 'Skilled FIFO crews,\nwherever the work is',
    companiesHeroText: 'Mining, construction, camp services and remote healthcare: workers for FIFO and DIDO rosters, in Australia and around the world.',
    companiesHeroImage: '/img/hero-companies.jpg',
    servicesHeading: 'Our services',
    companiesSectorsHeading: 'Our FIFO areas of expertise',
    ctaTitle: 'Tell us what you need',
    ctaText: 'A consultant will call you back within one business day.',
    internationalTitle: 'Connecting workers to able employers around the world',
    internationalText: 'From remote Australian mine sites and camps to projects overseas, we match skilled workers with employers who need them, and support both every step of the way.',
    internationalImage: '/img/international.jpg',
    countries: data.countries,
    aboutBanner: '/img/banner-office.jpg',
    aboutStory: data.about.story,
    brandMission: data.about.brand[0].text,
    brandPromise: data.about.brand[1].text,
    brandUsp: data.about.brand[2].text,
    leadershipMessage: [...data.about.message, "Let's always aim higher, and keep working together."],
    leadershipSignature: 'The FIFOconnect leadership team',
    leadershipImage: '/img/service-team.jpg',
    aboutGallery: data.about.gallery.map(img),
    footerTagline: 'Connecting workers to able employers around the world',
    acknowledgement: 'We acknowledge the Traditional Custodians of the lands on which we work and pay our respects to Elders past and present.',
    socialTiktok: '', socialInstagram: '', socialLinkedin: '', socialTelegram: '',
    licences: data.LICENCES,
    updated_at: now,
  };

  const menuGroups = item => (item.columns || []).map(c => ({ title: c.title, links: c.links.map(l => ({ label: l.label, href: l.href })) }));
  const menus = [
    ...data.nav.candidates.map((m, i) => ({ location: 'candidates', label: m.label, href: m.href || '', groups: menuGroups(m), order: i + 1 })),
    ...data.nav.companies.map((m, i) => ({ location: 'companies', label: m.label, href: m.href || '', groups: menuGroups(m), order: i + 1 })),
    ...data.nav.utility.map((m, i) => ({ location: 'utility', label: m.label, href: m.href, groups: [], order: i + 1 })),
    { location: 'footer', label: 'Find a Job', href: '', order: 1, groups: [{ title: '', links: [
      { label: 'Job search', href: '/jobs' }, { label: 'Saved jobs', href: '/jobs/saved' }, { label: 'Job alerts', href: '#job-alerts' }, { label: 'Find a branch', href: '/branches' }] }] },
    { location: 'footer', label: 'Candidates', href: '', order: 2, groups: [{ title: '', links: [
      { label: 'Submit your CV', href: '/register' }, { label: 'Your first FIFO job', href: '/candidates/first-temporary-job' },
      { label: 'Are you a specialist?', href: '/candidates/specialists' }, { label: 'Partners in safety', href: '/candidates/safety' },
      { label: 'International candidates', href: '/candidates/international' }, { label: 'Crafting a great CV', href: '/advice/cv' },
      { label: 'Writing a cover letter', href: '/advice/cover-letter' }] }] },
    { location: 'footer', label: 'Companies', href: '', order: 3, groups: [{ title: '', links: [
      { label: 'Temporary recruitment', href: '/companies/temporary' }, { label: 'Permanent recruitment', href: '/companies/permanent' },
      { label: 'Specialist recruitment', href: '/companies/specialist' }, { label: 'International recruitment', href: '/companies/international' },
      { label: 'Onsite solutions', href: '/companies/onsite' }, { label: 'Payroll services', href: '/companies/payroll' },
      { label: 'Safety consultancy', href: '/companies/safety' }, { label: 'HR consultancy', href: '/companies/hr-solutions' }] }] },
    { location: 'footer', label: 'FIFOconnect', href: '', order: 4, groups: [{ title: '', links: [
      { label: 'About us', href: '/about' }, { label: 'Corporate social responsibility', href: '/about/csr' }, { label: 'Work for us', href: '/join-us' },
      { label: 'News', href: '/news' }, { label: 'Contact us', href: '/contact' }] }] },
  ].map(m => ({ ...m, created_at: now, updated_at: now }));

  const sectors = sectorRows.map((s, i) => ({
    slug: s.slug, name: s.name, blurb: s.blurb, roles: s.roles, image: img(s.image), icon: s.icon,
    color: PALETTE_KEYS[i % PALETTE_KEYS.length], order: i + 1, active: true, created_at: now, updated_at: now,
  }));

  const services = [
    ['hire', 'Temporary recruitment', 'Inducted, work-ready staff for a swing, a season or a project.', '/companies/temporary'],
    ['hire', 'Permanent recruitment', 'Hires who meet the brief and fit your culture.', '/companies/permanent'],
    ['hire', 'Specialist recruitment', 'Senior, technical and hard-to-fill roles.', '/companies/specialist'],
    ['hire', 'International recruitment', 'Skilled workers from overseas for skill-shortage roles.', '/companies/international'],
    ['hire', 'Onsite solutions', 'A dedicated coordinator embedded in your operation.', '/companies/onsite'],
    ['outsourcing', '360° HR solutions', 'Outsourced HR from first hire to ongoing compliance.', '/companies/hr-solutions'],
    ['outsourcing', 'Payroll services', 'Accurate, on-time pay and award compliance.', '/companies/payroll'],
    ['outsourcing', 'Safety consultancy', 'Audits, inductions and on-site coaching.', '/companies/safety'],
    ['outsourcing', 'Diversity & inclusion', 'Inclusive hiring and workforce programs.', '/companies/diversity'],
  ].map(([group, title, summary, href], i) => ({ group, title, summary, href, order: i + 1, created_at: now, updated_at: now }));

  const promos = ['candidates', 'companies'].flatMap(aud => data.promos[aud].map((p, i) => ({
    audience: aud, title: p.title, href: p.href, image: img(p.image), variant: p.variant || '', order: i + 1, created_at: now, updated_at: now,
  })));

  const pages = data.pages.map(p => ({
    path: p.path, title: p.title, audience: p.audience || (p.path.startsWith('/companies') ? 'companies' : 'candidates'),
    intro: p.intro || '', banner: img(p.banner), body: toBody(p.sections),
    ctaLabel: p.cta ? p.cta.label : '', ctaHref: p.cta ? p.cta.href : '', created_at: now, updated_at: now,
  }));

  const branches = data.branches.map((b, i) => ({ city: b.city, state: b.state, country: 'Australia', address: '', phone: '', lat: b.lat, lng: b.lng, order: i + 1, created_at: now, updated_at: now }));
  const news = data.news.map(a => ({ slug: a.slug, title: a.title, date: new Date(a.date), tag: a.tag, image: img(a.image), excerpt: a.excerpt, body: a.body, highlight: Boolean(a.highlight), created_at: now, updated_at: now }));
  const testimonials = data.testimonials.map((t, i) => ({ name: t.name, org: t.org, quote: t.quote, photo: img(t.photo), order: i + 1, created_at: now, updated_at: now }));
  const missionSlides = data.missionSlides.map((m, i) => ({ title: m.title, text: m.text, order: i + 1, created_at: now, updated_at: now }));
  const values = data.about.values.map((v, i) => ({ tag: v.tag, name: v.name, subtitle: v.subtitle, text: v.text, order: i + 1, created_at: now, updated_at: now }));

  return { settings: [settings], menus, sectors, services, promos, pages, branches, news, testimonials, missionSlides, values };
}

async function seedContent() {
  const docs = contentDocs();
  for (const [name, rows] of Object.entries(docs)) {
    const existing = await col[name].countDocuments();
    if (existing && !force) { console.log(`  ${name}: ${existing} existing, skipped`); continue; }
    if (existing) await col[name].deleteMany({});
    await col[name].insertMany(rows);
    console.log(`  ${name}: ${rows.length} inserted`);
  }
}

async function seedJobs() {
  if (await col.jobs.countDocuments()) { console.log('  jobs: existing, skipped'); return; }
  const now = Date.now();
  const rows = jobRows.map(([title, sector, location, state, contract_type, pay, summary, description, requirements, country = 'Australia'], i) => {
    const p = parsePay(pay);
    const published = new Date(now - i * 2 * 86400000);
    return { title, sector, location, state, country, contract_type, pay, pay_rate: p.rate, pay_unit: p.unit, summary, description, requirements, status: 'open', featured: i < 2, published_at: published, updated_at: published };
  });
  await col.jobs.insertMany(rows);
  console.log(`  jobs: ${rows.length} inserted`);
}

async function ensureUser({ name, email, password, role }) {
  const existing = await col.users.findOne({ email });
  if (existing) { console.log(`  ${role}: ${email} already exists (password unchanged)`); return false; }
  await col.users.insertOne({ name, email, phone: null, password_hash: await bcrypt.hash(password, 12), role, active: true,
    created_at: new Date(), last_login_at: null, failed_logins: 0, locked_until: null });
  return true;
}

async function seedUsers() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) {
    console.log('  admin: skipped. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to create the admin account.');
  } else {
    const problems = passwordProblems(password, 'admin');
    if (problems.length) throw new Error(`ADMIN_PASSWORD is too weak: ${problems.join(' ')}`);
    if (await ensureUser({ name: 'Administrator', email, password, role: 'admin' })) console.log(`  admin: created ${email}`);
  }

  // Demo candidate so the candidate portal can be tried straight away.
  const demoEmail = (process.env.DEMO_CANDIDATE_EMAIL || 'candidate@example.com').toLowerCase();
  const demoPassword = process.env.DEMO_CANDIDATE_PASSWORD || `Demo-${crypto.randomBytes(6).toString('base64url')}1`;
  if (await ensureUser({ name: 'Demo Candidate', email: demoEmail, password: demoPassword, role: 'candidate' })) {
    const u = await col.users.findOne({ email: demoEmail });
    await col.applications.insertOne({ user_id: u._id, job_sector: 'operators', country: 'Australia', status: 'draft', licences: [], updated_at: new Date() });
    console.log(`  candidate: created ${demoEmail}` + (process.env.DEMO_CANDIDATE_PASSWORD ? '' : ` with password ${demoPassword} (shown once)`));
  }
}

(async () => {
  await connect();
  console.log(`Seeding database "${config.mongoDb}"${force ? ' (force: replacing site content)' : ''}`);
  await seedContent();
  await seedJobs();
  await seedUsers();
  console.log('Done.');
})().catch(e => { console.error('Seed failed:', e.message); process.exitCode = 1; }).finally(() => client.close());
