require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const runMigrations = require("./migrations");

const PORT = process.env.PORT || 5000;

// Listen first so the service is reachable (and /api/ping answers) even while
// the database is still connecting or paused.
app.listen(PORT, () => console.log(`Wajd API listening on http://localhost:${PORT}`));

connectDB()
  .then(runMigrations)
  .catch((err) => console.error("Startup error:", err.message));
