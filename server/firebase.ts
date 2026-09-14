import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Khởi tạo Firebase Admin SDK từ biến môi trường (xem .env.example).
 * Hỗ trợ 2 cách cấu hình credential:
 * 1. FIREBASE_SERVICE_ACCOUNT: dán nguyên nội dung file JSON service account (khuyên dùng cho Vercel).
 * 2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY: 3 trường tách riêng.
 */
function loadServiceAccount() {
  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (jsonRaw) {
    return JSON.parse(jsonRaw);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Trên nhiều nền tảng (Vercel...), xuống dòng trong biến môi trường bị chuyển thành "\n" dạng chữ.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Thiếu cấu hình Firebase. Hãy đặt FIREBASE_SERVICE_ACCOUNT hoặc bộ 3 biến " +
        "FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY trong .env. " +
        "Xem hướng dẫn trong .env.example.",
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
