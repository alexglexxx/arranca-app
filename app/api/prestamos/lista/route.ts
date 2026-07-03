// GET /api/prestamos/lista?estado=pendiente_revision
// Devuelve préstamos filtrados por estado, con los datos del usuario incluidos
// (para no requerir una segunda llamada desde el frontend del admin).

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import { EstadoPrestamo } from '@/types';
import type { Query, DocumentData } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
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
    return errorResponse(error, 'Error en /api/prestamos/lista:');
  }
}
