// GET /api/prestamos/[id]
// Devuelve el estado actual de un préstamo. Usado por la pantalla /prestamo
// para hacer polling y reflejar cuando el admin aprueba/rechaza/confirma pago.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prestamoSnap = await adminDb.collection('prestamos').doc(params.id).get();

    if (!prestamoSnap.exists) {
      return NextResponse.json({ error: 'Préstamo no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ id: prestamoSnap.id, ...prestamoSnap.data() });
  } catch (error) {
    console.error('Error en /api/prestamos/[id]:', error);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
