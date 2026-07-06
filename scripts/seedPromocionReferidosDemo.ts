// Script opcional para crear una promoción demo de referidos.
// No se ejecuta automáticamente. Uso sugerido:
//   npx tsx scripts/seedPromocionReferidosDemo.ts

import { adminDb } from '../lib/firebase-admin';
import type { Promocion } from '../types';

const PROMOCION_ID = 'referidos-fundadores';

async function main() {
  const promocionRef = adminDb.collection('promociones').doc(PROMOCION_ID);
  const existente = await promocionRef.get();

  if (existente.exists) {
    console.log('Ya existe la promoción demo:', existente.data());
    return;
  }

  const ahora = Date.now();
  const promocion: Promocion = {
    id: PROMOCION_ID,
    nombre: 'Referidos fundadores',
    descripcion: 'Promoción demo para otorgar impulsos por primer pago completo de referido.',
    estado: 'pausada',
    trigger: 'referido_primer_pago_completo',
    recompensa: {
      tipo: 'impulsos',
      cantidad: 3,
    },
    presupuesto: {
      tipo: 'unidades',
      total: 300,
      disponible: 300,
    },
    limitePorUsuario: null,
    fechaInicio: ahora,
    fechaFin: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };

  await promocionRef.set(promocion);
  console.log('Promoción demo creada en estado pausada:', PROMOCION_ID);
}

main().catch((error) => {
  console.error('Error al crear promoción demo:', error);
  process.exit(1);
});
