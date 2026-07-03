// GET /api/prestamos/[id]
// Devuelve el estado actual de un préstamo. Usado por la pantalla /prestamo
// para hacer polling y reflejar cuando el admin aprueba/rechaza/confirma pago.

import { NextRequest, NextResponse } from 'next/server';
import { assertAdminOrOwner, errorResponse, requireUserOrAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const actor = await requireUserOrAdmin(request);
    const prestamoSnap = await adminDb.collection('prestamos').doc(params.id).get();

    if (!prestamoSnap.exists) {
      return NextResponse.json({ error: 'Préstamo no encontrado.' }, { status: 404 });
    }

    const prestamo = prestamoSnap.data()!;
    assertAdminOrOwner(actor, prestamo.usuarioId);

    return NextResponse.json({ id: prestamoSnap.id, ...prestamo });
  } catch (error) {
    return errorResponse(error, 'Error en /api/prestamos/[id]:');
  }
}
