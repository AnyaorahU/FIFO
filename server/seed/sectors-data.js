// FIFO and remote-work sectors. `color`/`text` drive the sector cards and rotate through the brand palette
// (navy, royal, orange, navy-2). `image` is in client/public/img. Slugs are stored on jobs: don't rename them.
const PALETTE = [
  ['#0b1f4d', '#ffffff'],   // navy
  ['#1f56a8', '#ffffff'],   // royal blue
  ['#fb7a05', '#0b1f4d'],   // orange (navy text)
  ['#163a7a', '#ffffff'],   // navy-2
];

const list = [
  { slug: 'entry-level', name: 'Entry-level positions', icon: 'users', image: 'sector-entry-level',
    blurb: 'Zero FIFO experience? No problem. FIFOconnect partners with facilities services across industries to provide staff who maintain, manage and elevate work environments.',
    roles: ['General hands & labourers', 'Trades assistants', 'Utility workers', 'Kitchen hands', 'Cleaners & housekeepers', 'Trainee operators'] },
  { slug: 'operators', name: 'Operators', icon: 'truck', image: 'sector-operators',
    blurb: 'FIFOconnect connects heavy machinery operators (most common in mining and oil & gas) and warehouse operators (common in logistics and manufacturing) with employers.',
    roles: ['Haul truck operators', 'Excavator & dozer operators', 'Loader & grader operators', 'Drill rig operators', 'Forklift & reach truck operators', 'Warehouse & process operators'] },
  { slug: 'hospitality-camp', name: 'Hospitality & Camp Services', icon: 'heart', image: 'sector-hospitality',
    blurb: 'Chefs, cooks, kitchen hands and housekeepers who keep remote camps and village accommodation running.',
    roles: ['Chefs & cooks', 'Kitchen hands', 'Housekeepers', 'Camp attendants', 'Village managers'] },
  { slug: 'healthcare-remote', name: 'Remote Healthcare', icon: 'shield', image: 'sector-healthcare',
    blurb: 'Nurses, paramedics and medics for remote sites, clinics and communities, on FIFO rotations.',
    roles: ['Remote area nurses', 'Site paramedics', 'Emergency service officers', 'Occupational health advisers'] },
  { slug: 'transport-logistics', name: 'Transport & Logistics', icon: 'truck', image: 'sector-transport',
    blurb: 'Drivers, forklift operators and logistics crews who move people, fuel and freight to remote operations.',
    roles: ['Truck drivers (HR to MC)', 'Forklift operators (LF/LO)', 'Storepersons', 'Logistics coordinators', 'Bus drivers'] },
  { slug: 'manufacturing-engineering', name: 'Engineering & Trades', icon: 'gear', image: 'sector-manufacturing',
    blurb: 'Fitters, welders, electricians and engineers who build, maintain and repair the equipment remote sites rely on.',
    roles: ['Boilermakers & welders', 'Mechanical fitters', 'Electricians', 'Maintenance planners', 'Engineers'] },
  { slug: 'facilities-services', name: 'Facilities Services', icon: 'building', image: 'sector-facilities',
    blurb: 'Cleaners, maintenance crews and security officers for camps, sites and accommodation villages.',
    roles: ['Cleaners', 'Maintenance staff', 'Security officers', 'Grounds keepers'] },
  { slug: 'sustainability-environment', name: 'Energy & Renewables', icon: 'leaf', image: 'sector-sustainability',
    blurb: 'Crews for wind, solar and energy projects in regional and remote locations.',
    roles: ['Solar & wind technicians', 'Electricians', 'Environmental officers', 'HSE advisers'] },
  { slug: 'business-support', name: 'Site Administration', icon: 'briefcase', image: 'sector-business',
    blurb: 'Site administrators, coordinators and payroll staff who keep FIFO operations organised.',
    roles: ['Site administrators', 'Roster & travel coordinators', 'Payroll officers', 'Document controllers'] },
  { slug: 'waste-management', name: 'Waste Management', icon: 'recycle', image: 'sector-waste',
    blurb: 'Operators and drivers for waste, recycling and environmental services on remote sites.',
    roles: ['Collection drivers', 'Plant operators', 'Yard hands'] },
  { slug: 'public-sector', name: 'Public & Community Services', icon: 'landmark', image: 'sector-public',
    blurb: 'Staff for regional councils, agencies and remote community services.',
    roles: ['Customer service officers', 'Outdoor workers', 'Community officers'] },
];

module.exports = list.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length][0], text: PALETTE[i % PALETTE.length][1] }));
