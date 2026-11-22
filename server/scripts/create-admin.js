// Creates an admin account, or resets an existing admin's password.
//   npm run create-admin -- admin@company.com "a-strong-password-123" "Full Name"
const bcrypt = require('bcryptjs');
const { connect, client, col } = require('../db');
const { passwordProblems } = require('../routes/auth');

const [emailArg, password, name] = process.argv.slice(2);
const email = (emailArg || '').trim().toLowerCase();

(async () => {
  if (!email || !password) throw new Error('Usage: npm run create-admin -- <email> <password> [name]');
  const problems = passwordProblems(password, 'admin');
  if (problems.length) throw new Error(problems.join(' '));
  await connect();
  const hash = await bcrypt.hash(password, 12);
  const existing = await col.users.findOne({ email });
  if (existing) {
    await col.users.updateOne({ _id: existing._id }, { $set: { role: 'admin', active: true, password_hash: hash, failed_logins: 0, locked_until: null } });
    console.log(`Updated ${email}: admin role and new password set.`);
  } else {
    await col.users.insertOne({ name: name || 'Administrator', email, phone: null, password_hash: hash, role: 'admin', active: true,
      created_at: new Date(), last_login_at: null, failed_logins: 0, locked_until: null });
    console.log(`Created admin ${email}.`);
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => client.close());
