const admin = require("../config/firebaseAdmin");

function adminEmails() {
  return (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * A user is an admin if their token carries the custom claim role: "admin"
 * (set with scripts/make-admin.js) or their email is listed in ADMIN_EMAIL.
 * The email list keeps existing deployments working without a migration.
 */
function isAdminToken(decoded) {
  const email = (decoded.email || "").toLowerCase();
  return decoded.role === "admin" || (email && adminEmails().includes(email));
}

async function decodeRequest(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const decoded = await admin.auth().verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: (decoded.email || "").toLowerCase(),
    isAdmin: isAdminToken(decoded),
  };
}

/** Verifies the Firebase ID token ("Authorization: Bearer <token>"). */
async function requireAuth(req, res, next) {
  try {
    const user = await decodeRequest(req);
    if (!user) return res.status(401).json({ error: "Please sign in first" });
    req.user = user;
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}

/** Must run after requireAuth. */
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, isAdminToken };
