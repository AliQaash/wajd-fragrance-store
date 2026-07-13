import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Values come from env, not hardcoded — see .env.example. The Firebase
// web config is not a secret (Google designed it to be public), but
// keeping it in env still makes swapping projects (dev/prod) trivial.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
