// Script de un solo uso para inicializar el capital del sistema con tus
// $5,000 iniciales. Ejecutar UNA SOLA VEZ después de desplegar, vía:
//   npx tsx scripts/inicializar-capital.ts
//
// Si lo corres de nuevo después de tener préstamos activos, NO sobreescribe
// capitalPrestado — solo ajusta capitalTotal y recalcula disponible
// (mismo comportamiento que POST /api/admin/capital).

import { adminDb } from '../lib/firebase-admin';

const CAPITAL_INICIAL = 5000;
const TOPE_MAXIMO_POR_PRESTAMO = 200;

async function main() {
  const capitalRef = adminDb.collection('configuracion').doc('capital');
  const existente = await capitalRef.get();

  if (existente.exists) {
    console.log('Ya existe configuración de capital:', existente.data());
    console.log('Si quieres cambiar el monto, usa POST /api/admin/capital en vez de este script.');
    return;
  }

  await capitalRef.set({
    capitalTotal: CAPITAL_INICIAL,
    capitalPrestado: 0,
    capitalDisponible: CAPITAL_INICIAL,
    topeMaximoPorPrestamo: TOPE_MAXIMO_POR_PRESTAMO,
  });

  console.log(`Capital inicializado: $${CAPITAL_INICIAL} disponible.`);
}

main().catch((err) => {
  console.error('Error al inicializar capital:', err);
  process.exit(1);
});
