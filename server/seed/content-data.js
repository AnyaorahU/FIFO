// Site content: navigation, info pages, branches, news, testimonials, values.
// Copy is original; edit freely.

const sectors = require('./sectors-data');

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const CONTRACT_TYPES = ['Temporary', 'Temp to perm', 'Permanent', 'Contract'];
const WORK_RIGHTS = {
  citizen: 'Australian or NZ citizen',
  resident: 'Permanent resident',
  visa: 'Visa with work rights',
  sponsorship: 'I need visa sponsorship',
};
const LICENCES = ['Forklift (LF)', 'Order picker (LO)', 'Car licence (C)', 'Light rigid (LR)', 'Medium rigid (MR)',
  'Heavy rigid (HR)', 'Heavy combination (HC)', 'Multi combination (MC)', 'White Card', 'EWP', 'First aid', 'Working with Children Check'];

const sectorLinks = sectors.slice(0, 5).map(s => ({ label: s.name, href: `/sectors/${s.slug}` }))
  .concat([{ label: 'All our sectors', href: '/sectors' }]);

const nav = {
  candidates: [
    { label: 'Find a Job', columns: [
      { title: 'Find a Job', links: [
        { label: 'Job search', href: '/jobs' },
        { label: 'Submit your CV', href: '/register' },
        { label: 'Saved jobs', href: '/jobs/saved' },
        { label: 'Job alerts', href: '#job-alerts', alerts: true },
      ] },
    ] },
    { label: 'Work with us', columns: [
      { title: 'Working with us', links: [
        { label: 'Your first FIFO job', href: '/candidates/first-temporary-job' },
        { label: 'Are you a specialist?', href: '/candidates/specialists' },
        { label: 'Partners in safety', href: '/candidates/safety' },
        { label: 'Work for us', href: '/join-us' },
      ] },
      { title: 'Our ethics', links: [
        { label: 'Values & mission', href: '/about' },
        { label: 'Corporate social responsibility', href: '/about/csr' },
        { label: 'Our recruitment process', href: '/candidates/recruitment-process' },
        { label: 'International candidates', href: '/candidates/international' },
      ] },
      { title: 'Our expertise', links: sectorLinks },
    ] },
    { label: 'Employment Advice', columns: [
      { title: 'Tips & trends', links: [
        { label: 'Crafting a great CV', href: '/advice/cv' },
        { label: 'Writing a cover letter', href: '/advice/cover-letter' },
        { label: 'Acing your interview', href: '/advice/interview' },
        { label: 'Online interviews', href: '/advice/online-interviews' },
      ] },
    ] },
    { label: 'Timesheets', href: '/dashboard' },
  ],
  companies: [
    { label: 'Your Challenges', columns: [
      { title: 'Our solutions', links: [
        { label: '360° HR solutions', href: '/companies/hr-solutions' },
        { label: 'Free workforce health check', href: '/companies/enquiry?type=health-check' },
        { label: 'Corporate social responsibility', href: '/about/csr' },
      ] },
      { title: 'Areas of expertise', links: sectorLinks },
    ] },
    { label: 'Our Services', columns: [
      { title: 'Hire talent', links: [
        { label: 'Temporary recruitment', href: '/companies/temporary' },
        { label: 'Permanent recruitment', href: '/companies/permanent' },
        { label: 'Specialist recruitment', href: '/companies/specialist' },
        { label: 'International recruitment', href: '/companies/international' },
        { label: 'Onsite solutions', href: '/companies/onsite' },
      ] },
      { title: 'Outsourcing', links: [
        { label: 'Payroll services', href: '/companies/payroll' },
        { label: 'Safety consultancy', href: '/companies/safety' },
        { label: 'Diversity & inclusion', href: '/companies/diversity' },
        { label: 'HR consultancy', href: '/companies/hr-solutions' },
      ] },
    ] },
    { label: 'Employment Advice', href: '/news' },
    { label: 'Request staff', href: '/companies/enquiry' },
  ],
  utility: [
    { label: 'Contact us', href: '/contact' },
    { label: 'About us', href: '/about' },
    { label: 'News', href: '/news' },
    { label: 'Join us', href: '/join-us' },
  ],
};

const promos = {
  candidates: [
    { title: 'Our service delivers worldwide', href: '/companies/international', image: 'promo-services', variant: 'red' },
    { title: 'Your first FIFO job, step by step', href: '/candidates/first-temporary-job', image: 'sector-mining', variant: 'image-top' },
    { title: 'Are you a specialist?', href: '/candidates/specialists', image: 'promo-specialist' },
    { title: 'Your partners in safety', href: '/candidates/safety', image: 'promo-safety', variant: 'image-top' },
    { title: 'Life on roster: camps, travel & pay', href: '/candidates/first-temporary-job', image: 'sector-hospitality' },
    { title: 'Crafting a CV that gets noticed', href: '/advice/cv', image: 'news-3', variant: 'image-top' },
  ],
  companies: [
    { title: 'FIFO crews, when and where you need them', href: '/companies/temporary', image: 'sector-construction', variant: 'red' },
    { title: 'Permanent hires that stay', href: '/companies/permanent', image: 'service-team', variant: 'image-top' },
    { title: 'Our service delivers worldwide', href: '/companies/international', image: 'banner-port' },
    { title: 'Onsite workforce management', href: '/companies/onsite', image: 'service-onsite', variant: 'image-top' },
    { title: 'Request a free workforce health check', href: '/companies/enquiry?type=health-check', image: 'promo-services' },
  ],
};

// Info pages. Each: path, audience, title, intro, banner image, sections [{ h, p[], list[] }], cta.
const pages = [
  { path: '/about/csr', title: 'Corporate social responsibility', banner: 'sector-sustainability', intro: 'Good work should be safe, fair and open to everyone.',
    sections: [
      { h: 'Health and safety', p: ['Safety audits, site inductions and access to an employee assistance program for every worker we place, plus mental health training for our consultants.'] },
      { h: 'Fair and decent work', p: ['Transparent pay, correct award rates, and free upskilling for candidates in high-demand sectors.'] },
      { h: 'Inclusion', p: ['Programs that open doors for First Nations Australians, people with disability, mature-age workers and migrants.'] },
      { h: 'Environment', p: ['Paperless onboarding, hybrid working and lower-emission offices, plus placements in sustainability roles.'] },
    ] },
  { path: '/join-us', title: 'Work for us', banner: 'banner-office', intro: 'Join a team of recruiters who care about people and results.',
    sections: [
      { h: 'Why join us', list: ['A supportive team culture and real career paths', 'Ongoing training and coaching', 'Hybrid and flexible arrangements', 'Recognition, incentives and team events'] },
      { h: 'Roles we hire for', p: ['Recruitment consultants, onsite coordinators, payroll officers, safety advisers and branch managers across Australia.'] },
    ], cta: { label: 'Send us your CV', href: '/register' } },
  { path: '/candidates/first-temporary-job', title: 'Your first FIFO job', banner: 'sector-mining', intro: 'Fly-in fly-out work means great pay, blocks of time off and real career progression. Here is how to get started.',
    sections: [
      { h: 'How it works', list: ['Create your account and upload your CV.', 'A consultant calls to talk about your experience, tickets and preferred rosters.', 'We check your work rights, licences and references.', 'You complete your pre-employment medical, drug and alcohol test and any site inductions.', 'We confirm flights and accommodation, and you fly out for your first swing.'] },
      { h: 'Common rosters', list: ['2 weeks on, 1 week off (2:1)', '8 days on, 6 days off (8:6)', '14 days on, 14 days off (14:14)', 'Shutdown work: short, intense blocks'] },
      { h: 'What to have ready', list: ['An up-to-date CV', 'Passport or other proof of your right to work', 'Licences and tickets (e.g. HR/MC, forklift, White Card, working at heights)', 'Two work references', 'A Working with Children Check or police check if the role requires it'] },
      { h: 'Life on site', p: ['Most sites provide flights from a capital or regional airport, camp accommodation and meals. Shifts are long, typically 12 hours, so look after your fatigue, stay hydrated and speak up about safety. Your consultant stays in touch for the whole assignment.'] },
    ], cta: { label: 'Create your account', href: '/register' } },
  { path: '/candidates/specialists', title: 'Are you a specialist?', banner: 'promo-specialist', intro: 'Senior and hard-to-find professionals deserve a recruiter who understands their field.',
    sections: [
      { h: 'Specialist recruitment', p: ['Our specialist team places engineers, managers, safety and quality professionals, and technical experts in permanent roles. We take time to understand your career goals and present you only to employers that fit.'] },
      { h: 'Confidential and personal', p: ['Your search stays confidential. We never send your CV anywhere without your permission.'] },
    ], cta: { label: 'Submit your CV', href: '/register' } },
  { path: '/candidates/safety', title: 'Your partners in safety', banner: 'promo-safety', intro: 'Everyone should go home safe at the end of every shift.',
    sections: [
      { h: 'Before you start', p: ['Every placement includes a site-specific induction and a check that you have the right PPE and training for the role.'] },
      { h: 'While you work', p: ['Our safety team audits client sites, and your consultant is always a phone call away. If something feels unsafe, stop and tell us. You will never be penalised for raising a safety concern.'] },
    ] },
  { path: '/candidates/recruitment-process', title: 'Our recruitment process', banner: 'banner-office', intro: 'Clear steps, regular updates and no surprises.',
    sections: [
      { h: 'Step by step', list: ['Application: apply for a job or submit your CV.', 'Conversation: a consultant learns about your experience and goals.', 'Screening: right-to-work check, licence validation and references.', 'Matching: we present you to suitable employers.', 'Onboarding: contracts, induction and safety briefing.', 'Support: regular check-ins and prompt weekly pay.'] },
    ] },
  { path: '/candidates/international', title: 'International candidates', banner: 'international', intro: 'Moving to Australia, or already here on a visa? Here is what you need to know.',
    sections: [
      { h: 'Already in Australia', p: ['If you hold a visa with work rights (for example a working holiday, graduate or student visa), you can register with us and we will match you with roles that suit your visa conditions.'] },
      { h: 'Coming from overseas', p: ['For skill-shortage roles, some employers sponsor workers through the employer-sponsored visa program. Upload your passport, CV and qualifications so we can tell you whether a sponsored role may suit you.'] },
      { h: 'Important', p: ['We are a recruitment agency, not a registered migration agent. We cannot give visa advice or lodge visa applications. For migration advice, please speak with a registered migration agent or lawyer.'] },
    ], cta: { label: 'Create your account', href: '/register' } },
  { path: '/advice/cv', title: 'Crafting a great CV', banner: 'news-3', intro: 'Your CV has about ten seconds to make an impression. Make them count.',
    sections: [
      { h: 'Keep it clear', list: ['Two pages is plenty for most roles.', 'Put your most recent job first.', 'Use short bullet points that start with an action.'] },
      { h: 'Show what you achieved', p: ['Numbers stand out: pallets picked per hour, safety record, projects delivered, customers served.'] },
      { h: 'Don\'t forget', list: ['Licences and tickets with expiry dates', 'Your availability and preferred locations', 'A phone number you actually answer'] },
    ] },
  { path: '/advice/cover-letter', title: 'Writing a cover letter', banner: 'news-1', intro: 'A short, specific cover letter can set you apart.',
    sections: [
      { h: 'Three paragraphs', list: ['Why this role and this employer.', 'Two or three examples that prove you can do the job.', 'Your availability and a thank you.'] },
    ] },
  { path: '/advice/interview', title: 'Acing your interview', banner: 'news-2', intro: 'Preparation beats nerves every time.',
    sections: [
      { h: 'Before', list: ['Research the company and re-read the job ad.', 'Prepare examples using the situation-action-result format.', 'Plan your route and arrive ten minutes early.'] },
      { h: 'During', list: ['Listen to the whole question before answering.', 'Be honest about what you don\'t know.', 'Ask about the team, the roster and safety.'] },
    ] },
  { path: '/advice/online-interviews', title: 'Online interviews', banner: 'news-5', intro: 'Video interviews are here to stay. Treat them like the real thing.',
    sections: [
      { h: 'Checklist', list: ['Test your camera, microphone and connection beforehand.', 'Choose a quiet, well-lit spot.', 'Look at the camera, not the screen, when you speak.', 'Keep your CV and the job ad open in another window.'] },
    ] },
  // Companies
  { path: '/companies/temporary', title: 'Temporary recruitment & labour hire', banner: 'sector-construction', audience: 'companies', intro: 'Reliable people for a day, a season or a long project.',
    sections: [
      { h: 'Cover for every situation', p: ['Unplanned absences, seasonal peaks, new contracts: we supply inducted, work-ready staff, often within 24 hours.'] },
      { h: 'What\'s included', list: ['Screening, right-to-work and licence checks', 'Site inductions and PPE checks', 'Payroll, awards and compliance handled by us', 'A dedicated consultant who knows your site'] },
    ], cta: { label: 'Request staff', href: '/companies/enquiry' } },
  { path: '/companies/permanent', title: 'Permanent recruitment', banner: 'service-team', audience: 'companies', intro: 'Hires who meet the brief and fit your culture.',
    sections: [
      { h: 'Our approach', list: ['A detailed brief: role, team, culture and growth plans', 'Targeted search across our database and networks', 'Structured interviews and reference checks', 'A shortlist of candidates who genuinely fit', 'Replacement guarantee'] },
    ], cta: { label: 'Start a search', href: '/companies/enquiry' } },
  { path: '/companies/specialist', title: 'Specialist recruitment', banner: 'promo-specialist', audience: 'companies', intro: 'Senior, technical and hard-to-fill roles, handled by specialists.',
    sections: [
      { h: 'Where we specialise', list: ['Engineering and technical', 'Operations and supply chain management', 'Health, safety and environment', 'Finance, HR and business support leadership'] },
    ], cta: { label: 'Talk to a specialist', href: '/companies/enquiry' } },
  { path: '/companies/international', title: 'International recruitment', banner: 'banner-port', audience: 'companies', intro: 'One partner, many countries, clear outcomes.',
    sections: [
      { h: 'Hiring beyond Australia', p: ['When local talent is scarce, we source skilled workers from our international network for trades, manufacturing, logistics and engineering roles.'] },
      { h: 'How it works', list: ['Brief: role, location, start date, pay range and site requirements', 'A plan with milestones and agreed screening criteria', 'Shortlisting, interviews and reference checks', 'Coordination with your registered migration adviser', 'Arrival and onboarding support'] },
      { h: 'Please note', p: ['We are not a registered migration agent and do not provide visa advice. Employer sponsorship must follow Department of Home Affairs requirements.'] },
    ], cta: { label: 'Discuss your needs', href: '/companies/enquiry' } },
  { path: '/companies/onsite', title: 'Onsite solutions', banner: 'service-onsite', audience: 'companies', intro: 'A dedicated workforce partner, embedded in your operation.',
    sections: [
      { h: 'What you get', list: ['An onsite coordinator who manages rosters, attendance and inductions', 'Workforce reporting and KPIs', 'Fast response to peaks and changes', 'Recruitment process outsourcing for high-volume hiring'] },
    ], cta: { label: 'Request a proposal', href: '/companies/enquiry' } },
  { path: '/companies/payroll', title: 'Payroll services', banner: 'banner-office', audience: 'companies', intro: 'Accurate, on-time pay and full compliance.',
    sections: [
      { h: 'We take care of', list: ['Award interpretation and penalty rates', 'Superannuation and tax obligations', 'Single Touch Payroll reporting', 'Payslips and employee queries'] },
    ], cta: { label: 'Talk to us', href: '/companies/enquiry' } },
  { path: '/companies/safety', title: 'Safety consultancy', banner: 'promo-safety', audience: 'companies', intro: 'Practical safety systems that protect your people.',
    sections: [
      { h: 'Services', list: ['Site safety audits and risk assessments', 'Induction design and delivery', 'On-site coaching for supervisors', 'Incident investigation support'] },
    ], cta: { label: 'Book an audit', href: '/companies/enquiry' } },
  { path: '/companies/diversity', title: 'Diversity & inclusion', banner: 'service-team', audience: 'companies', intro: 'Diverse teams perform better. We help you build them.',
    sections: [
      { h: 'How we help', list: ['Inclusive job ads and recruitment processes', 'Pathways for First Nations, mature-age and disabled candidates', 'Unconscious bias training for hiring managers'] },
    ], cta: { label: 'Talk to us', href: '/companies/enquiry' } },
  { path: '/companies/hr-solutions', title: '360° HR solutions', banner: 'banner-office', audience: 'companies', intro: 'Outsourced HR support, from first hire to ongoing compliance.',
    sections: [
      { h: 'How it works', list: ['Enquiry: tell us about your business and challenges.', 'Discovery: we get to know your operation.', 'Embedded support: onsite or remote, as you need.', 'Ongoing HR: contracts, onboarding, policy reviews and compliance checks.'] },
    ], cta: { label: 'Request a free workforce health check', href: '/companies/enquiry?type=health-check' } },
];

pages.push(
  { path: '/privacy', title: 'Privacy policy', banner: null, intro: 'How we collect, use and protect your personal information.',
    sections: [
      { h: 'What we collect', p: ['Your contact details, work history, job preferences, right-to-work status and the documents you upload, such as your CV, passport and licences.'] },
      { h: 'Why we collect it', p: ['To assess your suitability for roles, verify your identity and work rights, meet our legal obligations, and contact you about opportunities.'] },
      { h: 'Who can see it', p: ['Only you and our authorised recruitment staff. We share your details with an employer only after you agree to be put forward for a role.'] },
      { h: 'Security and retention', p: ['Documents are stored securely and are never publicly accessible. You can delete documents from your dashboard at any time, or ask us to close your account and remove your data.'] },
      { h: 'Contact', p: ['For privacy questions or requests, please use our contact page.'] },
    ] },
  { path: '/terms', title: 'Terms of use', banner: null, intro: 'The rules for using this website and candidate portal.',
    sections: [
      { h: 'Your account', p: ['Keep your login details private. The information and documents you provide must be accurate and belong to you.'] },
      { h: 'Job ads', p: ['Job ads are provided in good faith and may change or be withdrawn at any time.'] },
      { h: 'Visa information', p: ['We are not a registered migration agent. Nothing on this site is migration advice.'] },
    ] },
);

// Branch locations (suburb-level). Contact details use the site-wide phone/email.
const branches = [
  { city: 'Melbourne CBD', state: 'VIC', lat: -37.8136, lng: 144.9631 },
  { city: 'Sunshine', state: 'VIC', lat: -37.7880, lng: 144.8330 },
  { city: 'Mickleham', state: 'VIC', lat: -37.5400, lng: 144.8900 },
  { city: 'Dandenong', state: 'VIC', lat: -37.9875, lng: 145.2150 },
  { city: 'Sydney', state: 'NSW', lat: -33.8688, lng: 151.2093 },
  { city: 'Liverpool', state: 'NSW', lat: -33.9200, lng: 150.9230 },
  { city: 'Eastern Creek', state: 'NSW', lat: -33.8030, lng: 150.8520 },
  { city: 'Darwin', state: 'NT', lat: -12.4634, lng: 130.8456 },
  { city: 'Perth', state: 'WA', lat: -31.9505, lng: 115.8605 },
  { city: 'Kalgoorlie', state: 'WA', lat: -30.7490, lng: 121.4660 },
  { city: 'Brisbane', state: 'QLD', lat: -27.4698, lng: 153.0251 },
  { city: 'Townsville', state: 'QLD', lat: -19.2590, lng: 146.8169 },
  { city: 'Rockhampton', state: 'QLD', lat: -23.3780, lng: 150.5100 },
  { city: 'Cairns', state: 'QLD', lat: -16.9186, lng: 145.7781 },
  { city: 'Bundaberg', state: 'QLD', lat: -24.8661, lng: 152.3489 },
  { city: 'Adelaide', state: 'SA', lat: -34.9285, lng: 138.6007 },
];

const news = [
  { slug: 'workforce-priorities-2027', title: 'Five workforce priorities to build into your 2027 plan', date: '2026-11-18', tag: 'Companies', image: 'news-1',
    excerpt: 'Budgets and growth plans only work if you have the people to deliver them. Here is where to focus.',
    body: ['As businesses finalise budgets for 2027, workforce planning is often the piece that decides whether the plan succeeds.', 'Our consultants see five priorities again and again: a flexible labour mix, faster onboarding, safety leadership, retention of key staff, and better workforce data.', 'Start with an honest look at where you lost time or money this year because of staffing gaps, and build from there.'] },
  { slug: 'strategic-hr-advantage', title: 'Strategic HR: the advantage small businesses overlook', date: '2026-11-10', tag: 'Companies', image: 'news-2', highlight: true,
    excerpt: 'HR is more than compliance and paperwork. Done well, it is a growth tool.',
    body: ['Many small and medium businesses still treat HR as a back-office function. The businesses that grow fastest treat it as strategy.', 'Clear role design, good onboarding and regular conversations about performance reduce turnover and lift productivity.', 'If you don\'t have an in-house HR team, outsourced support can give you the same capability at a fraction of the cost.'] },
  { slug: 'sme-workforce-challenges', title: 'The workforce challenges every SME should plan for', date: '2026-11-02', tag: 'Companies', image: 'news-3',
    excerpt: 'Skills shortages, rising costs and changing workplace laws: how to stay ahead.',
    body: ['Skills shortages remain the top concern for Australian SMEs, particularly in trades, logistics and manufacturing.', 'Planning ahead with a recruitment partner, building talent pipelines and investing in training are the most reliable ways to stay staffed.'] },
  { slug: 'labour-hire-when-you-need-it', title: 'Labour hire: reliable workers when your business needs them', date: '2026-10-27', tag: 'Jobs', image: 'news-4',
    excerpt: 'How temporary labour hire keeps operations running through peaks and absences.',
    body: ['Labour hire gives you access to screened, inducted workers without the cost and time of permanent recruitment.', 'It works best when your recruitment partner understands your site, your safety requirements and your roster patterns.'] },
  { slug: 'first-week-on-site', title: 'Your first week on a new site: what to expect', date: '2026-10-15', tag: 'Candidates', image: 'news-5',
    excerpt: 'From induction to your first pay, here is how your first week usually goes.',
    body: ['Day one usually starts with a site induction covering safety rules, emergency procedures and PPE.', 'Your consultant will check in during the first few days. Tell them if anything isn\'t what you expected.', 'Pay runs weekly, so make sure your bank, tax and super details are up to date in your dashboard.'] },
  { slug: 'international-talent-skills-gap', title: 'How international talent is closing the skills gap', date: '2026-10-03', tag: 'Companies', image: 'news-6',
    excerpt: 'Employers in trades and manufacturing are looking overseas. Here is what that involves.',
    body: ['Where local candidates are scarce, many employers now recruit skilled workers from overseas.', 'Success depends on planning: realistic timelines, a registered migration adviser, and onboarding that helps new arrivals settle in.'] },
];

const testimonials = [
  { name: 'George B.', org: 'Haul truck operator, 2:1 FIFO roster', photo: 'person-1',
    quote: 'I applied online and my consultant called me the next day. She sorted my medical and site induction and had me on my first swing within two weeks. I would recommend them to anyone wanting to start FIFO work.' },
  { name: 'Hannah M.', org: 'Camp chef, Pilbara', photo: 'person-2',
    quote: 'They took the time to understand the roster and the kind of camp I wanted. Flights, accommodation and pay were all clear from day one.' },
  { name: 'Luca R.', org: 'Project manager, civil contractor', photo: 'person-3',
    quote: 'Staffing a remote project used to be our biggest risk. Now we get an inducted, ticketed crew on the plane when we need them.' },
  { name: 'Mei L.', org: 'Electrician, joined from overseas', photo: 'person-4',
    quote: 'I came to Australia on a working visa and they explained exactly which FIFO roles I could do. Very honest and supportive team.' },
];

const missionSlides = [
  { title: 'Connecting workers to able employers around the world.', text: 'We bring companies closer to support, recruit and develop the workers of today and tomorrow, from remote Australian sites to projects overseas.' },
  { title: 'Collaboration', text: 'Nobody works alone. We succeed when our candidates and clients do.' },
  { title: 'Integrity', text: 'We do what we say, and we are honest even when the answer is no.' },
  { title: 'Flexibility', text: 'Rosters, roles and solutions that bend to real life without breaking our standards.' },
  { title: 'Authenticity', text: 'We are ourselves with everyone we work with.' },
  { title: 'Ambition', text: 'We help people go further than they thought they could.' },
  { title: 'Safety first', text: 'Everyone goes home safe, every shift.' },
  { title: 'Care', text: 'We look after the people we place as if they were our own team.' },
];

const countries = ['Australia', 'New Zealand', 'United Kingdom', 'Ireland', 'South Africa', 'Philippines', 'India', 'Canada', 'Papua New Guinea', 'Fiji'];

// About page content (client/views/about.ejs). Placeholder copy: replace with your own story.
const about = {
  intro: 'Connecting workers to able employers around the world.',
  story: [
    'For almost 3 years, FIFOconnect has brought companies closer to support, recruit and develop the workers of today and tomorrow. We started with a simple belief: fly-in fly-out work changes lives, and the people who do it deserve a recruiter who understands it.',
    'Our consultants know the rosters, the camps, the tickets and the medicals. We get to know the people we place and the sites we place them on, and we stay in touch from the first flight to the last swing.',
    'Today we recruit for mining, construction, camp services, remote healthcare, energy and logistics, in Australia and around the world. Safety, honesty and fast, reliable service underpin everything we do.',
  ],
  brand: [
    { title: 'Our Mission', text: 'Connecting workers to able employers around the world. We bring companies closer to support, recruit and develop the workers of today and tomorrow.' },
    { title: 'Our Promise', text: 'We build partnerships on strong foundations: honest advice, fast and reliable service, and people who are screened, inducted and ready to work safely from day one.' },
    { title: 'Our USP', text: 'FIFO specialists. We understand rosters, remote sites, camp life and mobilisation, and we can source skilled workers locally or from overseas. We listen first and stay accountable for the outcome.' },
  ],
  values: [
    { tag: 'Nobody works alone.', name: 'Collaboration', subtitle: 'Team spirit', text: 'We work as one team with our candidates, clients and each other. We share what we know, back each other up, and celebrate wins together.' },
    { tag: 'Do the right thing.', name: 'Integrity', subtitle: 'Transparency', text: 'We do what we say, especially when nobody is watching. We are honest with candidates and clients, own our mistakes and take pride in quality work.' },
    { tag: 'Adapt, don\'t compromise.', name: 'Flexibility', subtitle: 'Agility', text: 'Workplaces change fast, and so do we. We adapt rosters, roles and solutions to real life, without ever cutting corners on safety or standards.' },
    { tag: 'Stay real.', name: 'Authenticity', subtitle: 'The human element', text: 'We bring our whole selves to work and treat every person as an individual. Real relationships build trust, and trust builds results.' },
    { tag: 'Aim higher.', name: 'Ambition', subtitle: 'Growth', text: 'There is potential in everyone. Our job is to help people find it, take on new challenges and go further than they thought they could.' },
  ],
  message: [
    'From day one, our aim has been to turn ambition into reality, for the people we place, the businesses we support and our own team.',
    'We will keep building partnerships with strong foundations. Guided by our values of collaboration, integrity, flexibility, authenticity and ambition, we will keep finding the right fit for our clients and candidates, and keep showing up in person to understand how each local job market is really moving.',
    'And we will keep investing in our communities: safer workplaces, stronger local economies, fairer access to work, and a lighter footprint on the planet.',
  ],
  gallery: ['promo-safety', 'person-3', 'sector-construction', 'promo-services', 'service-onsite', 'promo-join'],
};

module.exports = { STATES, CONTRACT_TYPES, WORK_RIGHTS, LICENCES, nav, promos, pages, branches, news, testimonials, missionSlides, countries, about };
