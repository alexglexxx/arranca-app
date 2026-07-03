// GET /api/admin/referidos/pendientes
// Lista usuarios que tienen saldoRecompensas > 0 — para que el admin sepa
// a quién le debe transferir, sin tener que revisar uno por uno.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
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
    return errorResponse(error, 'Error en /api/admin/referidos/pendientes:');
  }
}
