// POST /api/admin/referidos/pagar
// El admin transfiere manualmente (fuera del sistema, por SPEI) el saldo de
// recompensas acumulado de un usuario, y aquí solo se registra que ya se
// pagó — esto resetea su saldoRecompensas a 0 para que no se duplique.
//
// NOTA: esto NO mueve capital — el descuento de capitalDisponible ya ocurrió
// en /api/prestamos/pagar cuando se otorgó la recompensa. Este endpoint solo
// lleva el control de "cuánto le debo en efectivo a cada referidor" vs
// "cuánto ya le transferí".

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import type { ActivacionPromocion } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const adminActor = await requireAdmin(request);
    const { usuarioId } = await request.json();

    if (!usuarioId) {
      return NextResponse.json({ error: 'usuarioId es obligatorio.' }, { status: 400 });
    }

    const usuarioRef = adminDb.collection('usuarios').doc(usuarioId);
    const usuarioSnap = await usuarioRef.get();

    if (!usuarioSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const saldoPagado = usuarioSnap.data()!.saldoRecompensas || 0;

    if (saldoPagado <= 0) {
      return NextResponse.json({ error: 'Este usuario no tiene saldo pendiente.' }, { status: 400 });
    }

    const pagoRef = adminDb.collection('pagos-referidos').doc();
    const activacionesSnap = await adminDb
      .collection('activacionesPromocion')
      .where('usuarioId', '==', usuarioId)
      .get();
    const activacionesPendientes = activacionesSnap.docs.filter((doc) => {
      const activacion = doc.data() as ActivacionPromocion;
      return activacion.recompensaTipo === 'bono_dinero' && activacion.estado === 'pendiente';
    });

    await adminDb.runTransaction(async (transaction) => {
      const ahora = Date.now();

      transaction.update(usuarioRef, { saldoRecompensas: 0 });

      activacionesPendientes.forEach((doc) => {
        transaction.update(doc.ref, {
          estado: 'pagada',
          pagadaEn: ahora,
          adminUid: adminActor.uid,
        });
      });

      // Histórico compatible con el reporte financiero actual. Para una auditoría
      // futura más rica puede evolucionar a pagosReferidos/{id} con metodoPago,
      // referencia, adminUid y estado.
      transaction.set(pagoRef, {
        usuarioId,
        monto: saldoPagado,
        fecha: ahora,
        fechaPago: ahora,
        adminUid: adminActor.uid,
        estado: 'pagado',
        activacionesPromocionIds: activacionesPendientes.map((doc) => doc.id),
      });
    });

    return NextResponse.json({
      pagado: true,
      monto: saldoPagado,
      activacionesPagadas: activacionesPendientes.length,
    });
  } catch (error) {
    return errorResponse(error, 'Error en /api/admin/referidos/pagar:');
  }
}
