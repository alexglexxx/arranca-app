// POST /api/prestamos/aprobar
// El admin aprueba un préstamo. Usa una transacción de Firestore para
// verificar y descontar el capital disponible de forma atómica — esto evita
// la condición de carrera donde dos préstamos se aprueban "al mismo tiempo"
// y juntos exceden el capital disponible (checklist B3: nunca comprometer
// más capital del que realmente tienes).

import { NextRequest, NextResponse } from 'next/server';
import { createHttpError, errorResponse, requireAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import { ChecklistRevision, REGLAS_PRESTAMO } from '@/types';

const PLAZO_MAXIMO_MS = REGLAS_PRESTAMO.DIAS_PLAZO_MAXIMO * 24 * 60 * 60 * 1000;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const adminActor = await requireAdmin(request);
    const { prestamoId, checklistCompleto, revisadoPor } = await request.json();

    if (!prestamoId || !checklistCompleto) {
      return NextResponse.json(
        { error: 'prestamoId y checklistCompleto son obligatorios.' },
        { status: 400 }
      );
    }

    // Checklist B4: todos los puntos del checklist deben estar en true antes
    // de permitir la aprobación — esto se valida también en el backend, no
    // solo en la UI, para que no se pueda aprobar saltándose el checklist
    // con una llamada directa a la API.
    const checklist = checklistCompleto as ChecklistRevision;
    const todosLosPuntosOk = Object.values(checklist).every(Boolean);

    if (!todosLosPuntosOk) {
      return NextResponse.json(
        { error: 'No se puede aprobar: hay puntos del checklist sin confirmar.' },
        { status: 400 }
      );
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const prestamoRef = adminDb.collection('prestamos').doc(prestamoId);
      const prestamoSnap = await transaction.get(prestamoRef);

      if (!prestamoSnap.exists) {
        throw createHttpError(404, 'Préstamo no encontrado.');
      }

      const prestamo = prestamoSnap.data()!;

      if (prestamo.estado !== 'pendiente_revision') {
        throw createHttpError(
          400,
          `El préstamo ya no está pendiente de revisión (estado actual: ${prestamo.estado}).`
        );
      }

      const capitalRef = adminDb.collection('configuracion').doc('capital');
      const capitalSnap = await transaction.get(capitalRef);

      if (!capitalSnap.exists) {
        throw createHttpError(400, 'No se ha configurado el capital del sistema.');
      }

      const capital = capitalSnap.data()!;

      if (capital.capitalDisponible < prestamo.monto) {
        throw createHttpError(
          400,
          `Capital insuficiente. Disponible: $${capital.capitalDisponible}, requerido: $${prestamo.monto}.`
        );
      }

      const ahora = Date.now();
      const fechaLimite = ahora + PLAZO_MAXIMO_MS;

      transaction.update(prestamoRef, {
        estado: 'activo',
        fechaAprobacion: ahora,
        fechaLimite,
        revisadoPor: revisadoPor || adminActor.username,
        checklistCompleto: checklist,
      });

      transaction.update(capitalRef, {
        capitalPrestado: capital.capitalPrestado + prestamo.monto,
        capitalDisponible: capital.capitalDisponible - prestamo.monto,
      });

      return { fechaLimite, usuarioId: prestamo.usuarioId };
    });

    return NextResponse.json({ aprobado: true, ...resultado });
  } catch (error) {
    return errorResponse(error, 'Error en /api/prestamos/aprobar:');
  }
}
