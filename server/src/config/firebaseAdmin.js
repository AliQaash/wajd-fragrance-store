const admin = require("firebase-admin");

/**
 * Firebase Admin is used ONLY to verify ID tokens issued by Firebase Auth
 * on the client. There is no Firestore/Realtime DB usage here — all
 * product and order data lives in MongoDB. Keeping auth and data storage
 * separate means we get Firebase's auth UX without coupling the whole
 * backend to a Firestore project.
 *
 * Credentials come from environment variables, never a committed JSON
 * file. If FIREBASE_PRIVATE_KEY has literal "\n" sequences (common when
 * pasting into a .env or a hosting provider's dashboard), they're
 * converted to real newlines below.
 */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

module.exports = admin;
