// GET /api/admin/capital — lee el estado actual del capital
// POST /api/admin/capital — permite ajustar capitalTotal manualmente (ej. si
// el admin decide inyectar más capital al pool). NO toca capitalPrestado:
// ese campo solo lo modifican las transacciones de /aprobar y /pagar.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const capitalSnap = await adminDb.collection('configuracion').doc('capital').get();

    if (!capitalSnap.exists) {
      return NextResponse.json(
        { error: 'Capital no configurado. Usa POST para inicializarlo.' },
        { status: 404 }
      );
    }

    return NextResponse.json(capitalSnap.data());
  } catch (error) {
    console.error('Error en GET /api/admin/capital:', error);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { capitalTotal, topeMaximoPorPrestamo } = await request.json();

    const capitalRef = adminDb.collection('configuracion').doc('capital');
    const capitalSnap = await capitalRef.get();

    if (!capitalSnap.exists) {
      // Inicialización por primera vez: todo el capital empieza disponible
      await capitalRef.set({
        capitalTotal,
        capitalPrestado: 0,
        capitalDisponible: capitalTotal,
        topeMaximoPorPrestamo: topeMaximoPorPrestamo || 200,
      });
    } else {
      const actual = capitalSnap.data()!;
      const diferencia = capitalTotal - actual.capitalTotal;
      await capitalRef.update({
        capitalTotal,
        capitalDisponible: actual.capitalDisponible + diferencia,
        ...(topeMaximoPorPrestamo ? { topeMaximoPorPrestamo } : {}),
      });
    }

    const actualizado = await capitalRef.get();
    return NextResponse.json(actualizado.data());
  } catch (error) {
    console.error('Error en POST /api/admin/capital:', error);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
