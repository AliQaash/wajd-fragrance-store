const admin = require("firebase-admin");

/**
 * Firebase Admin is used ONLY to verify ID tokens issued by Firebase Auth on
 * the client; all product and order data lives in MongoDB.
 *
 * Credentials come from environment variables. Literal "\n" sequences in
 * FIREBASE_PRIVATE_KEY (common when pasted into a hosting dashboard) become
 * real newlines. When FIREBASE_AUTH_EMULATOR_HOST is set (local tests), the
 * Admin SDK talks to the Auth emulator and needs only a project id.
 */
if (!admin.apps.length) {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "demo-wajd" });
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
}

module.exports = admin;
