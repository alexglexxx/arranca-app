// POST /api/prestamos/pagar
// Dos pasos separados a propósito (checklist D): el chofer sube su comprobante
// (esto NO marca como pagado automáticamente), y el admin confirma manualmente
// que el dinero llegó antes de liberar el capital y actualizar el historial.
//
// Este archivo expone ambos pasos en una sola route, diferenciados por el
// campo "accion" en el body.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { REFERIDOS } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accion, prestamoId } = body;

    if (accion === 'subir_comprobante') {
      return await subirComprobante(prestamoId, body.comprobantePagoUrl);
    }

    if (accion === 'confirmar_pago') {
      return await confirmarPago(prestamoId, body.montoFinalPagado, body.confirmadoPor);
    }

    return NextResponse.json(
      { error: 'accion debe ser "subir_comprobante" o "confirmar_pago".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error en /api/prestamos/pagar:', error);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

async function subirComprobante(prestamoId: string, comprobantePagoUrl: string) {
  if (!prestamoId || !comprobantePagoUrl) {
    return NextResponse.json(
      { error: 'prestamoId y comprobantePagoUrl son obligatorios.' },
      { status: 400 }
    );
  }

  const prestamoRef = adminDb.collection('prestamos').doc(prestamoId);
  const prestamoSnap = await prestamoRef.get();

  if (!prestamoSnap.exists) {
    return NextResponse.json({ error: 'Préstamo no encontrado.' }, { status: 404 });
  }

  if (prestamoSnap.data()!.estado !== 'activo') {
    return NextResponse.json(
      { error: 'Solo se puede subir comprobante de préstamos activos.' },
      { status: 400 }
    );
  }

  await prestamoRef.update({ comprobantePagoUrl });

  return NextResponse.json({ comprobanteSubido: true });
}

async function confirmarPago(
  prestamoId: string,
  montoFinalPagado: number,
  confirmadoPor: string
) {
  if (!prestamoId || !montoFinalPagado) {
    return NextResponse.json(
      { error: 'prestamoId y montoFinalPagado son obligatorios.' },
      { status: 400 }
    );
  }

  const resultado = await adminDb.runTransaction(async (transaction) => {
    const prestamoRef = adminDb.collection('prestamos').doc(prestamoId);
    const prestamoSnap = await transaction.get(prestamoRef);

    if (!prestamoSnap.exists) {
      throw new Error('Préstamo no encontrado.');
    }

    const prestamo = prestamoSnap.data()!;

    if (prestamo.estado !== 'activo') {
      throw new Error('Solo se puede confirmar pago de préstamos activos.');
    }

    const capitalRef = adminDb.collection('configuracion').doc('capital');
    const capitalSnap = await transaction.get(capitalRef);
    const capital = capitalSnap.data()!;

    const usuarioRef = adminDb.collection('usuarios').doc(prestamo.usuarioId);
    const usuarioSnap = await transaction.get(usuarioRef);
    const usuario = usuarioSnap.data()!;

    // Programa de referidos: la recompensa se otorga SOLO cuando este es el
    // PRIMER préstamo que el usuario completa (prestamosCompletados === 0
    // todavía, antes de incrementarlo abajo) Y tiene un referidor registrado.
    // Esto evita pagar recompensa múltiples veces por la misma persona.
    const esPrimerPrestamoCompletado = (usuario.prestamosCompletados || 0) === 0;
    const tieneReferidor = !!usuario.referidoPor;
    let referidorId: string | null = null;

    if (esPrimerPrestamoCompletado && tieneReferidor) {
      const referidorRef = adminDb.collection('usuarios').doc(usuario.referidoPor);
      const referidorSnap = await transaction.get(referidorRef);

      // Solo se otorga si el referidor todavía existe (no debería pasar que
      // no exista, pero es una validación defensiva barata)
      if (referidorSnap.exists) {
        const referidor = referidorSnap.data()!;
        referidorId = referidorRef.id;

        transaction.update(referidorRef, {
          referidosExitosos: (referidor.referidosExitosos || 0) + 1,
          saldoRecompensas: (referidor.saldoRecompensas || 0) + REFERIDOS.RECOMPENSA_MXN,
        });

        // La recompensa sale del capital real — es dinero que efectivamente
        // vas a transferir al referidor, no solo margen no cobrado. Por eso
        // se descuenta de capitalDisponible, igual que un préstamo nuevo.
        transaction.update(capitalRef, {
          capitalDisponible: capital.capitalDisponible - REFERIDOS.RECOMPENSA_MXN,
        });
      }
    }

    transaction.update(prestamoRef, {
      estado: 'pagado',
      fechaPago: Date.now(),
      montoFinalPagado,
      revisadoPor: confirmadoPor || 'admin',
    });

    // Libera el capital prestado de vuelta al disponible (checklist: el
    // capital se recicla — esto es justo el mecanismo de "graduación" que
    // permite atender más usuarios con el mismo capital)
    transaction.update(capitalRef, {
      capitalPrestado: capital.capitalPrestado - prestamo.monto,
      capitalDisponible: capital.capitalDisponible + prestamo.monto,
    });

    transaction.update(usuarioRef, {
      prestamosCompletados: (usuario.prestamosCompletados || 0) + 1,
      enMora: false,
    });

    return { usuarioId: prestamo.usuarioId, recompensaOtorgadaA: referidorId };
  });

  return NextResponse.json({ pagoConfirmado: true, ...resultado });
}
