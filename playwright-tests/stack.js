/**
 * Starts a throwaway backend for the end-to-end tests: an in-memory MongoDB
 * seeded with the real catalog, and the API pointed at it and at the Firebase
 * Auth emulator. Nothing touches the live database or real Firebase users.
 * Playwright starts this (and the emulator and the client) via webServer.
 */
const path = require("path");
const { spawn } = require("child_process");
const { MongoMemoryServer } = require("mongodb-memory-server");

const root = path.resolve(__dirname, "..");
const serverDir = path.join(root, "server");

async function main() {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri("wajd-e2e");

  // Seed with the server's own models and catalog.
  const mongoose = require(path.join(serverDir, "node_modules/mongoose"));
  const Product = require(path.join(serverDir, "src/models/Product"));
  const { products } = require(path.join(serverDir, "scripts/seed"));
  await mongoose.connect(uri);
  await Product.deleteMany({});
  await Product.insertMany(products);
  await mongoose.disconnect();
  console.log(`[stack] seeded ${products.length} products`);

  const api = spawn(process.execPath, ["src/index.js"], {
    cwd: serverDir,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: process.env.E2E_API_PORT || "5055",
      MONGODB_URI: uri,
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIREBASE_PROJECT_ID: "demo-wajd",
      ADMIN_EMAIL: "admin@wajd.test",
      CLIENT_ORIGIN: "http://localhost:3000",
      STRIPE_SECRET_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
  });

  const stop = async () => {
    api.kill();
    await mongo.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  api.on("exit", (code) => {
    console.log(`[stack] API exited (${code})`);
    mongo.stop().then(() => process.exit(code || 0));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
