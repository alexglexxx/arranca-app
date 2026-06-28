// GET /api/admin/referidos/pendientes
// Lista usuarios que tienen saldoRecompensas > 0 — para que el admin sepa
// a quién le debe transferir, sin tener que revisar uno por uno.

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection('usuarios')
      .where('saldoRecompensas', '>', 0)
      .get();

    const pendientes = snapshot.docs.map((doc) => ({
      usuarioId: doc.id,
      nombre: doc.data().nombre,
      telefono: doc.data().telefono,
      saldoRecompensas: doc.data().saldoRecompensas,
      referidosExitosos: doc.data().referidosExitosos,
    }));

    return NextResponse.json({ pendientes });
  } catch (error) {
    console.error('Error en /api/admin/referidos/pendientes:', error);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
