import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);
if (!firebaseConfigured) {
  console.warn("Firebase is not configured. Copy .env.example to .env and fill it in.");
}

export const app = initializeApp(firebaseConfigured ? config : { apiKey: "missing", projectId: "missing", appId: "missing" });
export const auth = getAuth(app);
