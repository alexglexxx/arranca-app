import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function getAdminApp(): App {
  if (getApps().length) {
    return getApps()[0];
  }

  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
  const serviceAccountKeyPlano = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  let serviceAccount: Record<string, unknown>;

  if (serviceAccountBase64) {
    const jsonDecodificado = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
    serviceAccount = JSON.parse(jsonDecodificado);
  } else if (serviceAccountKeyPlano) {
    serviceAccount = JSON.parse(serviceAccountKeyPlano);
  } else {
    throw new Error(
      'Falta configurar FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 o FIREBASE_SERVICE_ACCOUNT_KEY'
    );
  }

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminApp = getAdminApp();
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
