const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { dbReady } = require("./config/db");
const { allowedOrigins } = require("./config/origins");
const payments = require("./services/payments");
const { requireAuth } = require("./middleware/auth");

const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");
const aiRoutes = require("./routes/ai");

const app = express();
app.set("trust proxy", 1); // Render sits behind a proxy; needed for per-IP rate limits

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // No Origin header = same-origin, curl or server-to-server: allowed.
      if (!origin || allowedOrigins().includes(origin.replace(/\/$/, ""))) return cb(null, true);
      cb(null, false);
    },
  })
);
app.use(express.json({ limit: "100kb" }));

const limiter = (max, windowMin = 15) =>
  rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a few minutes and try again." },
  });

app.get("/api/ping", (req, res) => res.json({ ok: true, db: dbReady() ? "up" : "down" }));

// Public config the client needs to decide what to show.
app.get("/api/config", (req, res) => res.json({ cardPayments: payments.cardPaymentsEnabled(), currency: "USD" }));

// Everything below needs the database.
app.use("/api", (req, res, next) => {
  if (!dbReady()) {
    return res.status(503).json({ error: "The store is waking up its database. Please try again in a minute." });
  }
  next();
});

app.use("/api", limiter(600));
app.get("/api/me", requireAuth, (req, res) => res.json(req.user));
app.use("/api/products", productRoutes);
app.use("/api/orders", limiter(120), orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", limiter(20), aiRoutes);

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Last-resort error handler: log the detail, send a plain message.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Something went wrong. Please try again." });
});

module.exports = app;
