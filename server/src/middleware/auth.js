const admin = require("../config/firebaseAdmin");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();

/**
 * Verifies the Firebase ID token sent in the Authorization header
 * ("Bearer <token>"). This is the server-side check the original app
 * was missing entirely — every product/order-mutating route used to be
 * open to anyone who could reach the API, with "isAdmin" enforced only
 * in the React UI (trivially bypassed with curl or devtools).
 *
 * On success, req.user = { uid, email } is attached for downstream
 * handlers/middleware to use.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing authentication token" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: (decoded.email || "").toLowerCase() };
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Must be used AFTER requireAuth. Rejects anyone but the admin account. */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };