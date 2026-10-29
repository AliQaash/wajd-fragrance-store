/**
 * Grants (or removes) the admin role on a Firebase account as a custom claim.
 *   node scripts/make-admin.js someone@example.com
 *   node scripts/make-admin.js someone@example.com --remove
 * The person must sign out and back in for the new role to reach their token.
 * Emails in ADMIN_EMAIL are admins anyway; this is for adding more without a redeploy.
 */
require("dotenv").config();
const admin = require("../src/config/firebaseAdmin");

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email) {
    console.error("Usage: node scripts/make-admin.js <email> [--remove]");
    process.exit(1);
  }
  const user = await admin.auth().getUserByEmail(email);
  const claims = { ...(user.customClaims || {}) };
  if (flag === "--remove") delete claims.role;
  else claims.role = "admin";
  await admin.auth().setCustomUserClaims(user.uid, claims);
  console.log(`${email}: role is now ${claims.role || "customer"}. Sign out and in again to apply.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
