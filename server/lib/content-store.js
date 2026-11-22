// Loads site content from MongoDB for the public pages, with a short in-memory cache.
// Admin edits call invalidate() so changes show immediately.
const { col, withIds } = require('../db');
const { PALETTE } = require('./content-schema');
const { parsePageBody } = require('./markdown');

const TTL_MS = 30 * 1000;
let cache = null;
let loadedAt = 0;
let loading = null;

const DEFAULTS = { name: 'FIFOconnect', phone: '', email: '', countries: [], portalPoints: [], licences: [], aboutStory: [], leadershipMessage: [], aboutGallery: [] };

async function load() {
  const [settings, menus, sectors, services, promos, pages, branches, news, testimonials, missionSlides, values] = await Promise.all([
    col.settings.findOne({ _id: 'site' }),
    col.menus.find().sort({ location: 1, order: 1 }).toArray(),
    col.sectors.find({ active: { $ne: false } }).sort({ order: 1, name: 1 }).toArray(),
    col.services.find().sort({ group: 1, order: 1 }).toArray(),
    col.promos.find().sort({ order: 1 }).toArray(),
    col.pages.find().toArray(),
    col.branches.find().sort({ country: 1, order: 1, city: 1 }).toArray(),
    col.news.find().sort({ date: -1 }).toArray(),
    col.testimonials.find().sort({ order: 1 }).toArray(),
    col.missionSlides.find().sort({ order: 1 }).toArray(),
    col.values.find().sort({ order: 1 }).toArray(),
  ]);
  const byLocation = loc => withIds(menus.filter(m => m.location === loc));
  return {
    site: { ...DEFAULTS, ...(settings || {}) },
    menus: { candidates: byLocation('candidates'), companies: byLocation('companies'), utility: byLocation('utility'), footer: byLocation('footer') },
    sectors: withIds(sectors).map(s => {
      const color = PALETTE[s.color] || PALETTE.navy;
      return { ...s, color, text: color === PALETTE.orange ? PALETTE.navy : '#ffffff' };
    }),
    services: { hire: withIds(services.filter(s => s.group === 'hire')), outsourcing: withIds(services.filter(s => s.group === 'outsourcing')) },
    promos: { candidates: withIds(promos.filter(p => p.audience === 'candidates')), companies: withIds(promos.filter(p => p.audience === 'companies')) },
    pages: Object.fromEntries(pages.map(p => [p.path, { ...p, sections: parsePageBody(p.body) }])),
    branches: branches.map(b => ({ city: b.city, state: b.state || '', country: b.country || 'Australia', address: b.address || '', phone: b.phone || '', lat: b.lat, lng: b.lng })),
    news: withIds(news),
    testimonials: withIds(testimonials),
    missionSlides: withIds(missionSlides),
    values: withIds(values),
  };
}

async function getContent() {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  if (!loading) {
    loading = load().then(c => { cache = c; loadedAt = Date.now(); return c; }).finally(() => { loading = null; });
  }
  return loading;
}

function invalidate() { cache = null; loadedAt = 0; }

module.exports = { getContent, invalidate };
