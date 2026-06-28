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
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
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

    await usuarioRef.update({ saldoRecompensas: 0 });

    // Se guarda un registro histórico simple del pago, por si luego hace
    // falta auditar cuánto se ha pagado en total por el programa
    await adminDb.collection('pagos-referidos').add({
      usuarioId,
      monto: saldoPagado,
      fecha: Date.now(),
    });

    return NextResponse.json({ pagado: true, monto: saldoPagado });
  } catch (error) {
    console.error('Error en /api/admin/referidos/pagar:', error);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
