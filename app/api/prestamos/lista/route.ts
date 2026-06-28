// GET /api/prestamos/lista?estado=pendiente_revision
// Devuelve préstamos filtrados por estado, con los datos del usuario incluidos
// (para no requerir una segunda llamada desde el frontend del admin).

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { EstadoPrestamo } from '@/types';
import type { Query, DocumentData } from 'firebase-admin/firestore';

// Esta ruta lee request.nextUrl.searchParams, requiere ser dinámica
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const estado = request.nextUrl.searchParams.get('estado') as EstadoPrestamo | null;

    let query: Query<DocumentData> = adminDb
      .collection('prestamos')
      .orderBy('fechaSolicitud', 'desc');

    if (estado) {
      query = query.where('estado', '==', estado);
    }

    const snapshot = await query.limit(50).get();

    const prestamos = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const prestamo = doc.data();
        const usuarioSnap = await adminDb.collection('usuarios').doc(prestamo.usuarioId).get();
        const usuario = usuarioSnap.data();

        return {
          id: doc.id,
          ...prestamo,
          usuario: usuario
            ? {
                nombre: usuario.nombre,
                telefono: usuario.telefono,
                prestamosCompletados: usuario.prestamosCompletados,
                enMora: usuario.enMora,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ prestamos });
  } catch (error) {
    console.error('Error en /api/prestamos/lista:', error);
    return NextResponse.json({ error: 'Error interno al listar préstamos.' }, { status: 500 });
  }
}
