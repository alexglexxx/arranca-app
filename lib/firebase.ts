// Firebase del lado del navegador. Usa las variables NEXT_PUBLIC_* porque
// estas SÍ se exponen al cliente (son las claves públicas de configuración,
// no credenciales secretas — eso vive solo en lib/firebase-admin.ts).

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Evita reinicializar la app en hot-reload (común en Next.js dev mode)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Phone Auth en web requiere reCAPTCHA (invisible o visible) como parte del
// flujo anti-bot de Firebase. Se inicializa en la pantalla de registro, no
// aquí, porque necesita un elemento DOM ya montado.
export default app;
