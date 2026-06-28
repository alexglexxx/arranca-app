// Firebase Admin SDK — SOLO se importa desde API routes (app/api/**), nunca
// desde componentes de cliente. Tiene privilegios totales sobre Firestore,
// por eso las credenciales (FIREBASE_SERVICE_ACCOUNT_KEY) deben quedarse
// en el servidor y nunca exponerse con el prefijo NEXT_PUBLIC_.

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function getAdminApp(): App {
  if (getApps().length) {
    return getApps()[0];
  }

  // La service account key se guarda completa como JSON en una variable de
  // entorno (ver .env.example) — esto evita tener que subir el archivo .json
  // por separado al VM.
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY no está definida. Revisa tu archivo .env.local'
    );
  }

  const serviceAccount = JSON.parse(serviceAccountKey);

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminApp = getAdminApp();
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
