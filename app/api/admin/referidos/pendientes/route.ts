// GET /api/admin/referidos/pendientes
// Lista usuarios que tienen saldoRecompensas > 0 — para que el admin sepa
// a quién le debe transferir, sin tener que revisar uno por uno.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import type { ActivacionPromocion } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const snapshot = await adminDb
      .collection('usuarios')
      .where('saldoRecompensas', '>', 0)
      .get();
    const activacionesSnap = await adminDb
      .collection('activacionesPromocion')
      .where('estado', '==', 'pendiente')
      .get();
    const activacionesPorUsuario = new Map<
      string,
      { total: number; cantidad: number }
    >();

    activacionesSnap.docs.forEach((doc) => {
      const activacion = doc.data() as ActivacionPromocion;
      if (activacion.recompensaTipo !== 'bono_dinero') {
        return;
      }

      const actual = activacionesPorUsuario.get(activacion.usuarioId) || {
        total: 0,
        cantidad: 0,
      };

      actual.total += Number(activacion.cantidad || 0);
      actual.cantidad += 1;
      activacionesPorUsuario.set(activacion.usuarioId, actual);
    });

    const pendientes = snapshot.docs.map((doc) => ({
      usuarioId: doc.id,
      nombre: doc.data().nombre,
      telefono: doc.data().telefono,
      saldoRecompensas: doc.data().saldoRecompensas,
      referidosExitosos: doc.data().referidosExitosos,
      bonoDineroPendienteActivaciones: activacionesPorUsuario.get(doc.id)?.total || 0,
      activacionesBonoPendientes: activacionesPorUsuario.get(doc.id)?.cantidad || 0,
    }));

    return NextResponse.json({ pendientes });
  } catch (error) {
    return errorResponse(error, 'Error en /api/admin/referidos/pendientes:');
  }
}
