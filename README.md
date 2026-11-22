# FIFOconnect

*Connecting workers to able employers around the world.* FIFO and remote-site recruitment website with a candidate portal and an admin console.

FIFO (fly-in fly-out) recruitment worldwide. Layout inspired by established labour-hire agency sites (background notes in `docs/research.md`), with its own brand and copy.

- **Public site**:
  - Candidates/Companies switch and mega-menus.
  - Hero with job search.
  - Promo carousel.
  - Job listings with category chips.
  - Sectors carousel.
  - Branch map (Leaflet + OpenStreetMap).
  - News, testimonials, mission and portal cards.
  - International section, footer.
  - Floating Job Alerts sign-up.
  - Info pages for candidates, companies and advice.
  - Business enquiry and free health-check forms.
- **Job board**:
  - Keyword search with sector, country, work-type, date-listed and salary filters, plus pagination.
  - Job detail pages and one-click apply (needs an account and a CV).
  - Saved jobs, stored on the device.
- **Candidates**:
  - Register and log in.
  - Profile: country, sector, availability, right to work / visa type, licences and tickets.
  - Uploads: CV and passport/ID (required), certificates (optional).
  - Submit the profile for review, and track job applications and their status.
- **Admin** (`/admin`):
  - Overview of key numbers.
  - Candidates: search, filter, CSV export, review and status, internal notes, disable or delete.
  - **Jobs**: create, edit, close, delete, with an applicant list per job and an applicant status (New, Shortlisted, Placed, Unsuccessful).
  - **Job alert** subscribers.
  - **Enquiries** inbox (contact, business enquiry, health check).
  - **Content** manager for everything on the public site, **Admin users**, **My account** (password).
  - Full activity log.

## Run

1. **MongoDB Atlas**: in `.env`, replace `<db_username>` and `<db_password>` in `MONGODB_URI` with a database user
   (Atlas → Database Access). URL-encode special characters in the password. Allow your server's IP
   under Atlas → Network Access.
2. Set `SESSION_SECRET` (32+ random characters) and `ADMIN_EMAIL` / `ADMIN_PASSWORD`
   (12+ characters with letters and numbers).
3. Install, seed and start:

```bash
npm install
npm run seed     # site content, sample jobs, admin account, demo candidate (only fills empty collections)
npm start        # http://localhost:3000   (npm run dev to auto-reload)
```

**Upgrading an existing database?** Run `npm run migrate` once: it adds countries to existing jobs, profiles, alerts and
branches (as Australia), re-reads job pay, and gives renamed sectors matching URLs, photos and roles. Safe to run again.

`npm run seed:force` replaces all site content with the defaults (users, jobs and candidate data are kept).
`npm run create-admin -- email@company.com "StrongPassword123" "Name"` creates an admin or resets their password.

## Project structure

```
client/        Public website + candidate dashboard: views/ (EJS) and public/ (css, js, img)
admin/         Admin console at /admin: routes.js, content-routes.js (Content manager), views/, public/admin.css
server/
  index.js     App entry: security headers, MongoDB sessions, content loading, routes
  config.js    Environment settings (validated at start-up)
  db.js        MongoDB connection, collections, indexes, GridFS buckets
  routes/      public, auth, jobs, dashboard (candidate), files (private documents), media (content images)
  lib/         content-schema (editable content types), content-store (cached content), middleware,
               uploads (GridFS), constants, pay parser, icons, page-text parser
  seed/        Default content used only by `npm run seed`
  lib/security.js  Input sanitising, session binding, admin-area guard
  scripts/     seed.js, migrate.js, create-admin.js
test/          Security & user-isolation tests (node:test)
.github/       CI workflow: runs the tests against MongoDB on every push
```

## Data (MongoDB)

- **Site content** (all editable in Admin → Content): settings, menus and footer links, sectors, services,
  promo cards, info pages, branches, news, testimonials, mission slides, values.
- **Recruitment data**: users, applications (candidate profiles), documents, jobs, jobApplications,
  jobAlerts, messages (contact and business enquiries), activity (audit log), sessions.
- **Files** in GridFS: `documentFiles` (CVs, passports, certificates: private, downloaded only by the
  owner or an admin) and `media` (content images: public).

## Brand

- Logo files: `client/public/img/brand/` (full logo, header wordmark, round icon, favicon).
- Palette (from the logo), defined as CSS variables at the top of `client/public/css/style.css`:
  navy `#0b1f4d`, orange `#fb7a05`, royal blue `#1f56a8`, ice blue `#e6f1fd` (plus darker shades).
  Use navy text on orange (white on orange fails contrast); white text on navy and royal blue.
- Site name, logo, social links (TikTok, Instagram, LinkedIn, Telegram) and all text are edited in Admin → Content → Site settings.

## Content

All public content comes from MongoDB and is edited in **Admin → Content**. The defaults live in
`server/seed/` and are only used by `npm run seed`. Photos in `client/public/img/` are from Unsplash
(free to use under the Unsplash License). Upload your own images in the Content forms (stored in GridFS).

## Security

**Accounts & sessions**
- Passwords hashed with bcrypt (cost 12). Candidates need 8+ characters, admins 12+, both with letters and numbers.
- Account lockout after `LOGIN_MAX_FAILURES` failed logins for `LOGIN_LOCK_MINUTES`, plus per-IP rate limiting.
  Login errors never reveal whether an email exists.
- Sessions stored in MongoDB with a new session id on login, an idle timeout (`SESSION_IDLE_MINUTES`) and binding to
  the browser that logged in (a copied cookie used elsewhere is rejected). In production the cookie is `__Host-`
  prefixed, `Secure`, `HttpOnly` and `SameSite=Lax`.
- Disabling a user, deleting a candidate or changing a password signs out their sessions.

**Admin area**
- Every admin request re-checks the user's role from the database.
- Shorter admin idle timeout (`ADMIN_IDLE_MINUTES`) and maximum session length (`ADMIN_MAX_SESSION_HOURS`).
- Optional IP allowlist (`ADMIN_IP_ALLOWLIST`): other visitors get a 404.
- Separate rate limits for admin pages and admin changes.
- Deleting candidates and creating, disabling or enabling admins require the admin's password again.
- Admin pages are `no-store`, `noindex`, can't be framed, and access denials, downloads and changes go to the activity log.

**Database**
- Request values are coerced to strings and `$`/dotted keys are stripped; the query parser never builds nested
  objects, so MongoDB operators can't be injected. Search input is regex-escaped.
- Production refuses a non-TLS MongoDB connection.
- Optional MongoDB schema validation on users, profiles, documents, applications and jobs (applied automatically
  when the database user is allowed to run `collMod`).
- Recommended Atlas setup: a dedicated database user with `readWrite` on this database only, Network Access limited
  to your server's IP, and backups enabled.

**User isolation**
- Candidates only ever read or change their own profile, documents and applications (every query is scoped to the
  logged-in user). Documents are stored privately in GridFS and served only to their owner or an admin, as downloads.
- Automated tests check this (see Testing).

**Web**
- CSRF tokens on every form, strict Content-Security-Policy, HSTS in production and other helmet headers.
- Uploads checked by extension **and** file signature, with size limits.
- Content links restricted to safe schemes (no `javascript:`); all content is HTML-escaped; CSV export escapes formulas.
- The app refuses to start without `MONGODB_URI`, and in production without a strong `SESSION_SECRET`.

## Testing

The security and isolation tests run against a throwaway MongoDB (the test database is wiped on each run):

```bash
docker run -d --name fifo-test-mongo -p 27017:27017 mongo:7   # or any disposable MongoDB
MONGODB_URI_TEST=mongodb://127.0.0.1:27017 npm test
```

They cover: logins required for private areas, CSRF, candidates unable to see, download or delete each other's
documents, admin access denied to candidates, operator injection, account lockout, stolen-cookie rejection,
password re-confirmation for dangerous admin actions, admin idle timeout and database validation. GitHub Actions
runs them on every push (`.github/workflows/ci.yml`).

## Deployment checklist

- `NODE_ENV=production` behind HTTPS (`trust proxy` is set automatically in production).
- Strong `SESSION_SECRET`, admin password of 12+ characters, and consider `ADMIN_IP_ALLOWLIST`.
- Atlas: least-privilege database user, IP access list, backups.
- Passports are sensitive identity documents: set a retention policy that meets the privacy laws of the countries
  you operate in (e.g. the Australian Privacy Principles, GDPR).
