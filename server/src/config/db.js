const mongoose = require("mongoose");

/**
 * Connects to MongoDB and keeps retrying instead of exiting. A free Atlas
 * cluster pauses after 30 idle days; exiting on that made Render restart the
 * service in a loop with the whole site down. Now the API stays up, /api/ping
 * reports the database state, and requests get a clear 503 until it is back.
 */
async function connectDB({ retryMs = 15000 } = {}) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set — check your .env file");
  mongoose.set("strictQuery", true);

  for (;;) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
      console.log(`MongoDB connected: ${mongoose.connection.name}`);
      return;
    } catch (err) {
      console.error(`MongoDB connection failed (${err.message}). Retrying in ${retryMs / 1000}s.`);
      await new Promise((r) => setTimeout(r, retryMs));
    }
  }
}

function dbReady() {
  return mongoose.connection.readyState === 1;
}

module.exports = connectDB;
module.exports.dbReady = dbReady;
