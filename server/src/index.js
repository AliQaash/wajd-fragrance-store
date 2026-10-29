require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");
const connectDB = require("./config/db");
const { dbReady } = require("./config/db");
const runMigrations = require("./migrations");

const PORT = process.env.PORT || 5000;

// Listen first so the service is reachable (and /api/ping answers) even while
// the database is still connecting or paused.
app.listen(PORT, () => console.log(`Wajd API listening on http://localhost:${PORT}`));

/**
 * Migrations run the first time the database is reachable, however that
 * happens. A paused Atlas cluster can come back through the driver's own
 * reconnect rather than through connectDB() resolving, so waiting only on
 * connectDB() could leave them unrun. Each migration is recorded once, so
 * calling this more than once is harmless.
 */
let migrated = false;
let running = false;
async function migrateWhenReady() {
  if (migrated || running || !dbReady()) return;
  running = true;
  try {
    await runMigrations();
    migrated = true;
    clearInterval(timer);
  } catch (err) {
    console.error("Migration error (will retry):", err.message);
  } finally {
    running = false;
  }
}
const timer = setInterval(migrateWhenReady, 15000);
mongoose.connection.on("connected", migrateWhenReady);

connectDB()
  .then(migrateWhenReady)
  .catch((err) => console.error("Startup error:", err.message));
