/**
 * CLIENT_ORIGIN may hold one origin or a comma-separated list
 * (e.g. "https://wajd-fragrance-store.vercel.app,http://localhost:3000").
 */
function allowedOrigins() {
  const list = (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (process.env.NODE_ENV !== "production") {
    list.push("http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000");
  }
  return [...new Set(list)];
}

/** Where Stripe should send the buyer back: their own origin if allowed, else the first configured one. */
function clientOriginFor(req) {
  const origins = allowedOrigins();
  const origin = (req.get("origin") || "").replace(/\/$/, "");
  if (origin && origins.includes(origin)) return origin;
  return origins[0] || "http://localhost:3000";
}

module.exports = { allowedOrigins, clientOriginFor };
