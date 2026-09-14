import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Initializes the Firebase Admin SDK from environment variables (see .env.example).
 * Supports 2 credential configuration methods:
 * 1. FIREBASE_SERVICE_ACCOUNT: paste the full service account JSON content (recommended for Vercel).
 * 2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY: 3 separate fields.
 */
function loadServiceAccount() {
  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (jsonRaw) {
    return JSON.parse(jsonRaw);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // On many platforms (Vercel, etc.), newlines in env vars get turned into literal "\n".
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase configuration. Set FIREBASE_SERVICE_ACCOUNT or the trio " +
        "FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env. " +
        "See .env.example for details.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

function createFirebaseApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const serviceAccount = loadServiceAccount();
  return initializeApp({
    credential: cert(serviceAccount),
  });
}

let app: App | undefined;
let db: Firestore | undefined;

export function getFirebaseApp(): App {
  if (!app) app = createFirebaseApp();
  return app;
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}
