// Editable content types for Admin > Content. The admin forms, validation and storage are driven by these definitions.
const { COUNTRIES } = require('./constants');

const ICONS = ['mountain', 'hardhat', 'heart', 'shield', 'truck', 'gear', 'building', 'leaf', 'briefcase', 'recycle', 'landmark', 'award', 'users', 'globe', 'clock', 'file', 'passport', 'user'];
const PALETTE = { navy: '#0b1f4d', royal: '#1f56a8', orange: '#fb7a05', 'navy-2': '#163a7a' };

const types = {
  settings: {
    label: 'Site settings', single: true, id: 'site',
    groups: [
      { title: 'Brand & contact', fields: [
        { name: 'name', label: 'Site name', type: 'text', required: true },
        { name: 'tagline', label: 'Tagline', type: 'text' },
        { name: 'metaDescription', label: 'Search engine description', type: 'textarea' },
        { name: 'phone', label: 'Phone', type: 'text' },
        { name: 'email', label: 'Email', type: 'text' },
        { name: 'logo', label: 'Header logo', type: 'image' },
      ] },
      { title: 'Home: Hero', key: 'hero', fields: [
        { name: 'heroTitle', label: 'Hero heading (press Enter for a line break)', type: 'textarea', required: true },
        { name: 'heroText', label: 'Hero text', type: 'textarea' },
        { name: 'heroImage', label: 'Hero image', type: 'image' },
        { name: 'searchPlaceholder', label: 'Search placeholder', type: 'text' },
      ] },
      { title: 'Home: Opportunities section', key: 'opportunities', help: 'The job cards come from Admin → Jobs. Tick "Feature on home page" on a job to pin it here.', fields: [
        { name: 'opportunitiesHeading', label: 'Heading', type: 'text' },
        { name: 'opportunitiesChipAll', label: 'First filter chip label', type: 'text' },
        { name: 'opportunitiesCount', label: 'Number of job cards shown', type: 'number' },
        { name: 'opportunitiesMode', label: 'Which jobs to show', type: 'select', options: { featured: 'Featured jobs first, then newest', latest: 'Newest jobs only' } },
        { name: 'opportunitiesButton', label: 'Button label', type: 'text' },
        { name: 'opportunitiesEmpty', label: 'Message when there are no jobs', type: 'text' },
      ] },
      { title: 'Home: Sectors section', key: 'sectors', help: 'The sector cards come from Content → Sectors (name, text, image, colour, order, show/hide).', fields: [
        { name: 'sectorsHeading', label: 'Heading', type: 'text' },
        { name: 'sectorsButton', label: 'Button label', type: 'text' },
        { name: 'sectorsLinkLabel', label: 'Card link label', type: 'text' },
      ] },
      { title: 'Home: Other sections', key: 'home-other', fields: [
        { name: 'teamsHeading', label: 'Branches heading', type: 'text' },
        { name: 'newsHeading', label: 'News heading', type: 'text' },
        { name: 'portalTitle', label: 'Portal card title', type: 'text' },
        { name: 'portalPoints', label: 'Portal card points (one per line)', type: 'list' },
      ] },
      { title: 'Companies home page', fields: [
        { name: 'companiesHeroTitle', label: 'Hero heading (press Enter for a line break)', type: 'textarea' },
        { name: 'companiesHeroText', label: 'Hero text', type: 'textarea' },
        { name: 'companiesHeroImage', label: 'Hero image', type: 'image' },
        { name: 'servicesHeading', label: 'Services heading', type: 'text' },
        { name: 'companiesSectorsHeading', label: 'Sectors heading', type: 'text' },
        { name: 'ctaTitle', label: 'Call-to-action title', type: 'text' },
        { name: 'ctaText', label: 'Call-to-action text', type: 'text' },
      ] },
      { title: 'International section', fields: [
        { name: 'internationalTitle', label: 'Heading', type: 'text' },
        { name: 'internationalText', label: 'Text', type: 'textarea' },
        { name: 'internationalImage', label: 'Background image', type: 'image' },
        { name: 'countries', label: 'Countries (one per line)', type: 'list' },
      ] },
      { title: 'About page', fields: [
        { name: 'aboutBanner', label: 'Banner image', type: 'image' },
        { name: 'aboutStory', label: 'Our story (blank line between paragraphs)', type: 'paragraphs' },
        { name: 'brandMission', label: 'Our mission', type: 'textarea' },
        { name: 'brandPromise', label: 'Our promise', type: 'textarea' },
        { name: 'brandUsp', label: 'Our USP', type: 'textarea' },
        { name: 'leadershipMessage', label: 'Leadership message (blank line between paragraphs)', type: 'paragraphs' },
        { name: 'leadershipSignature', label: 'Signature', type: 'text' },
        { name: 'leadershipImage', label: 'Message background image', type: 'image' },
        { name: 'aboutGallery', label: 'Gallery images (one URL per line)', type: 'list' },
      ] },
      { title: 'Footer & social', fields: [
        { name: 'footerTagline', label: 'Footer tagline', type: 'text' },
        { name: 'acknowledgement', label: 'Acknowledgement of Country', type: 'textarea' },
        { name: 'socialTiktok', label: 'TikTok URL', type: 'link' },
        { name: 'socialInstagram', label: 'Instagram URL', type: 'link' },
        { name: 'socialLinkedin', label: 'LinkedIn URL', type: 'link' },
        { name: 'socialTelegram', label: 'Telegram URL (e.g. https://t.me/yourchannel)', type: 'link' },
      ] },
      { title: 'Candidate profile', fields: [
        { name: 'licences', label: 'Licences & tickets candidates can tick (one per line)', type: 'list' },
      ] },
    ],
  },
  menus: {
    label: 'Menus & footer links', titleField: 'label', sort: { location: 1, order: 1 },
    columns: ['location', 'label', 'href'],
    fields: [
      { name: 'location', label: 'Where', type: 'select', options: { candidates: 'Candidates header menu', companies: 'Companies header menu', utility: 'Top utility links', footer: 'Footer column' }, required: true },
      { name: 'label', label: 'Label / column title', type: 'text', required: true },
      { name: 'href', label: 'Link (leave empty for a dropdown or footer column)', type: 'link' },
      { name: 'groups', label: 'Dropdown / footer links', type: 'linkgroups',
        help: 'Start each group with "# Group title", then one link per line as "Label | /path". Footer columns use a single group. Use "#job-alerts" to open the job alerts form.' },
      { name: 'order', label: 'Order', type: 'number' },
    ],
  },
  sectors: {
    label: 'Sectors', titleField: 'name', sort: { order: 1 }, columns: ['name', 'slug', 'active'],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'slug', label: 'URL slug (changing it also updates the jobs and profiles that use it)', type: 'slug', required: true },
      { name: 'blurb', label: 'Short description', type: 'textarea', required: true },
      { name: 'roles', label: 'Roles we recruit (one per line)', type: 'list' },
      { name: 'image', label: 'Image', type: 'image', required: true },
      { name: 'icon', label: 'Icon', type: 'select', options: Object.fromEntries(ICONS.map(i => [i, i])) },
      { name: 'color', label: 'Card colour', type: 'select', options: { navy: 'Navy', royal: 'Royal blue', orange: 'Orange', 'navy-2': 'Mid navy' } },
      { name: 'order', label: 'Order', type: 'number' },
      { name: 'active', label: 'Show on site', type: 'checkbox' },
    ],
  },
  services: {
    label: 'Services', titleField: 'title', sort: { group: 1, order: 1 }, columns: ['title', 'group', 'href'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'summary', label: 'Summary', type: 'text', required: true },
      { name: 'href', label: 'Link', type: 'link', required: true },
      { name: 'group', label: 'Group', type: 'select', options: { hire: 'Hire talent', outsourcing: 'Outsourcing' }, required: true },
      { name: 'order', label: 'Order', type: 'number' },
    ],
  },
  promos: {
    label: 'Promo cards', titleField: 'title', sort: { audience: 1, order: 1 }, columns: ['title', 'audience', 'variant'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'href', label: 'Link', type: 'link', required: true },
      { name: 'image', label: 'Image', type: 'image', required: true },
      { name: 'audience', label: 'Shown on', type: 'select', options: { candidates: 'Candidates home', companies: 'Companies home' }, required: true },
      { name: 'variant', label: 'Style', type: 'select', options: { '': 'Text on top, image below', red: 'Highlight colour', 'image-top': 'Image on top' } },
      { name: 'order', label: 'Order', type: 'number' },
    ],
  },
  pages: {
    label: 'Info pages', titleField: 'title', sort: { path: 1 }, columns: ['title', 'path', 'audience'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'path', label: 'URL path (e.g. /advice/cv)', type: 'path', required: true },
      { name: 'audience', label: 'Audience', type: 'select', options: { candidates: 'Candidates', companies: 'Companies' } },
      { name: 'intro', label: 'Intro', type: 'textarea' },
      { name: 'banner', label: 'Banner image', type: 'image' },
      { name: 'body', label: 'Content', type: 'markdown',
        help: 'Use "## Heading" for sections, blank lines between paragraphs and "- " for bullet points.' },
      { name: 'ctaLabel', label: 'Button label', type: 'text' },
      { name: 'ctaHref', label: 'Button link', type: 'link' },
    ],
  },
  branches: {
    label: 'Branches', titleField: 'city', sort: { country: 1, order: 1 }, columns: ['city', 'country', 'phone'],
    fields: [
      { name: 'city', label: 'City / suburb', type: 'text', required: true },
      { name: 'state', label: 'State / region', type: 'text' },
      { name: 'country', label: 'Country', type: 'select', options: Object.fromEntries(COUNTRIES.map(c => [c, c])), required: true },
      { name: 'address', label: 'Address', type: 'text' },
      { name: 'phone', label: 'Phone (blank = main number)', type: 'text' },
      { name: 'lat', label: 'Latitude', type: 'number', required: true },
      { name: 'lng', label: 'Longitude', type: 'number', required: true },
      { name: 'order', label: 'Order', type: 'number' },
    ],
  },
  news: {
    label: 'News articles', titleField: 'title', sort: { date: -1 }, columns: ['title', 'tag', 'date'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'slug', label: 'URL slug', type: 'slug', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'tag', label: 'Tag', type: 'select', options: { Companies: 'Companies', Candidates: 'Candidates', Jobs: 'Jobs' } },
      { name: 'image', label: 'Image', type: 'image', required: true },
      { name: 'excerpt', label: 'Excerpt', type: 'textarea', required: true },
      { name: 'body', label: 'Article (blank line between paragraphs)', type: 'paragraphs' },
      { name: 'highlight', label: 'Highlight card on home page', type: 'checkbox' },
    ],
  },
  testimonials: {
    label: 'Testimonials', titleField: 'name', sort: { order: 1 }, columns: ['name', 'org'],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'org', label: 'Role / company', type: 'text' },
      { name: 'quote', label: 'Quote', type: 'textarea', required: true },
      { name: 'photo', label: 'Photo', type: 'image' },
      { name: 'order', label: 'Order', type: 'number' },
    ],
  },
  missionSlides: {
    label: 'Mission slides', titleField: 'title', sort: { order: 1 }, columns: ['title'],
    fields: [
      { name: 'title', label: 'Statement', type: 'text', required: true },
      { name: 'text', label: 'Text', type: 'textarea' },
      { name: 'order', label: 'Order', type: 'number' },
    ],
  },
  values: {
    label: 'Values (About page)', titleField: 'name', sort: { order: 1 }, columns: ['name', 'tag'],
    fields: [
      { name: 'tag', label: 'Tagline', type: 'text', required: true },
      { name: 'name', label: 'Value', type: 'text', required: true },
      { name: 'subtitle', label: 'Subtitle', type: 'text' },
      { name: 'text', label: 'Text', type: 'textarea', required: true },
      { name: 'order', label: 'Order', type: 'number' },
    ],
  },
};

const allFields = type => types[type].single ? types[type].groups.flatMap(g => g.fields) : types[type].fields;

// Links: relative paths, anchors, http(s), mailto and tel only (blocks javascript: and data: URLs).
const SAFE_LINK = /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i;

function parseLinkGroups(text) {
  const groups = [];
  let current = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#') && !line.startsWith('#job-alerts')) {
      current = { title: line.replace(/^#+\s*/, ''), links: [] };
      groups.push(current);
      continue;
    }
    const [label, href] = line.split('|').map(x => (x || '').trim());
    if (!label || !href) throw new Error(`Link line "${line}" must look like "Label | /path"`);
    if (!SAFE_LINK.test(href)) throw new Error(`Link "${href}" must start with /, #, https://, mailto: or tel:`);
    if (!current) { current = { title: '', links: [] }; groups.push(current); }
    current.links.push({ label: label.slice(0, 80), href: href.slice(0, 300) });
  }
  return groups;
}

function formatLinkGroups(groups) {
  return (groups || []).map(g => [g.title ? `# ${g.title}` : '', ...g.links.map(l => `${l.label} | ${l.href}`)].filter(Boolean).join('\n')).join('\n\n');
}

// Converts submitted form values into a document; returns { doc, errors }.
function parseForm(type, body, uploads = {}) {
  const doc = {};
  const errors = [];
  for (const f of allFields(type)) {
    const raw = body[f.name];
    const str = typeof raw === 'string' ? raw.trim() : '';
    let v;
    try {
      switch (f.type) {
        case 'checkbox': v = raw === 'on' || raw === '1' || raw === 'true'; break;
        case 'number': v = str === '' ? null : Number(str); if (v !== null && !Number.isFinite(v)) throw new Error(`${f.label} must be a number`); break;
        case 'list': v = str.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 100); break;
        case 'paragraphs': v = str.split(/\n\s*\n/).map(x => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean); break;
        case 'linkgroups': v = parseLinkGroups(str); break;
        case 'date': v = str ? new Date(str) : null; if (v && isNaN(v)) throw new Error(`${f.label} is not a valid date`); break;
        case 'select': v = Object.keys(f.options).includes(str) ? str : ''; break;
        case 'slug': v = str.toLowerCase(); if (v && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) throw new Error(`${f.label}: use lowercase letters, numbers and hyphens`); break;
        case 'path': v = str; if (v && !/^\/[a-z0-9\-/]*$/.test(v)) throw new Error(`${f.label}: must start with / and use lowercase letters, numbers, hyphens and slashes`); break;
        case 'link': v = str; if (v && !SAFE_LINK.test(v)) throw new Error(`${f.label} must start with /, #, https://, mailto: or tel:`); break;
        case 'image': v = uploads[f.name] || str; if (v && !/^(\/(?!\/)|https:\/\/)/.test(v)) throw new Error(`${f.label} must be an uploaded image, a /path or an https:// URL`); break;
        default: v = typeof raw === 'string' ? (f.type === 'text' ? str.slice(0, 300) : str.slice(0, 20000)) : '';
      }
    } catch (e) { errors.push(e.message); continue; }
    const empty = v === '' || v === null || (Array.isArray(v) && !v.length);
    if (f.required && empty) errors.push(`${f.label} is required.`);
    doc[f.name] = v;
  }
  return { doc, errors };
}

// Converts a stored value into a form field value.
function formValue(field, value) {
  if (value == null) return '';
  switch (field.type) {
    case 'list': return (value || []).join('\n');
    case 'paragraphs': return (value || []).join('\n\n');
    case 'linkgroups': return formatLinkGroups(value);
    case 'date': return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    default: return value;
  }
}

module.exports = { types, allFields, parseForm, formValue, PALETTE, ICONS, SAFE_LINK };
