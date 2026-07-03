// POST /api/prestamos/rechazar
// Rechaza una solicitud pendiente. No toca el capital porque nunca se llegó
// a comprometer (eso solo pasa en /aprobar).

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const adminActor = await requireAdmin(request);
    const { prestamoId, motivoRechazo, revisadoPor } = await request.json();

    if (!prestamoId) {
      return NextResponse.json({ error: 'prestamoId es obligatorio.' }, { status: 400 });
    }

    const prestamoRef = adminDb.collection('prestamos').doc(prestamoId);
    const prestamoSnap = await prestamoRef.get();

    if (!prestamoSnap.exists) {
      return NextResponse.json({ error: 'Préstamo no encontrado.' }, { status: 404 });
    }

    if (prestamoSnap.data()!.estado !== 'pendiente_revision') {
      return NextResponse.json(
        { error: 'Solo se pueden rechazar solicitudes pendientes de revisión.' },
        { status: 400 }
      );
    }

    await prestamoRef.update({
      estado: 'rechazado',
      revisadoPor: revisadoPor || adminActor.username,
      notasAdmin: motivoRechazo || 'Rechazado sin motivo especificado.',
    });

    return NextResponse.json({ rechazado: true });
  } catch (error) {
    return errorResponse(error, 'Error en /api/prestamos/rechazar:');
  }
}
