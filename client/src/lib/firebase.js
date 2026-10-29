import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// The Firebase web config is public by design; it lives in env so dev and
// prod projects can be swapped. REACT_APP_AUTH_EMULATOR points the app at the
// local Auth emulator for automated tests.
const env = import.meta.env;
const app = initializeApp({
  apiKey: env.REACT_APP_FIREBASE_API_KEY || "demo-key",
  authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: env.REACT_APP_FIREBASE_PROJECT_ID || "demo-wajd",
  appId: env.REACT_APP_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
if (env.REACT_APP_AUTH_EMULATOR) {
  connectAuthEmulator(auth, env.REACT_APP_AUTH_EMULATOR, { disableWarnings: true });
}
