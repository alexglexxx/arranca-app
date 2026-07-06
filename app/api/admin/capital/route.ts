// GET /api/admin/capital — lee el estado actual del capital
// POST /api/admin/capital — permite ajustar capitalTotal manualmente (ej. si
// el admin decide inyectar más capital al pool). NO toca capitalPrestado:
// ese campo solo lo modifican las transacciones de /aprobar y /pagar.

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import { mapEstadoPrestamoToSolicitud } from '@/lib/solicitudes';
import type {
  ActivacionPromocion,
  AdminCapitalResumen,
  ConfiguracionCapital,
  EstadoSolicitudAdelanto,
  PagoReferido,
  Prestamo,
  Promocion,
  Usuario,
} from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const resumen = await construirResumenCapital();
    return NextResponse.json(resumen);
  } catch (error) {
    return errorResponse(error, 'Error en GET /api/admin/capital:');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
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
    return errorResponse(error, 'Error en POST /api/admin/capital:');
  }
}

async function construirResumenCapital(): Promise<AdminCapitalResumen> {
  const [
    capitalSnap,
    prestamosSnap,
    usuariosConSaldoSnap,
    pagosReferidosSnap,
    promocionesSnap,
    activacionesSnap,
  ] = await Promise.all([
    adminDb.collection('configuracion').doc('capital').get(),
    adminDb.collection('prestamos').get(),
    adminDb.collection('usuarios').where('saldoRecompensas', '>', 0).get(),
    adminDb.collection('pagos-referidos').get(),
    adminDb.collection('promociones').get(),
    adminDb.collection('activacionesPromocion').get(),
  ]);

  const capital = capitalSnap.exists
    ? (capitalSnap.data() as ConfiguracionCapital)
    : null;
  const capitalOperativoTotal = normalizarNumero(capital?.capitalTotal);
  const disponibleParaTransferir = normalizarNumero(capital?.capitalDisponible);
  const topeMaximoPorPrestamo = normalizarNumero(capital?.topeMaximoPorPrestamo);

  let capitalPendientePorAprobar = 0;
  let capitalPrestadoActivo = 0;
  let totalPorRecuperar = 0;
  let gananciaGenerada = 0;
  let solicitudesPagadasConBase = 0;

  prestamosSnap.docs.forEach((doc) => {
    const prestamo = doc.data() as Prestamo;
    const estado = mapEstadoPrestamoToSolicitud(prestamo.estado);
    const monto = normalizarNumero(prestamo.monto);
    const totalAPagar = obtenerTotalAPagar(prestamo);

    if (estado === 'pendiente') {
      capitalPendientePorAprobar += monto;
    }

    if (esPrestamoActivo(estado)) {
      capitalPrestadoActivo += monto;
      totalPorRecuperar += totalAPagar;
    }

    if (estado === 'pagada') {
      const totalPagado = normalizarNumero(prestamo.montoFinalPagado) || totalAPagar;
      gananciaGenerada += Math.max(0, totalPagado - monto);
      solicitudesPagadasConBase += 1;
    }
  });

  const bonosReferidosPendientes = usuariosConSaldoSnap.docs.reduce((total, doc) => {
    const usuario = doc.data() as Usuario;
    return total + normalizarNumero(usuario.saldoRecompensas);
  }, 0);

  const bonosReferidosPagados = pagosReferidosSnap.docs.reduce((total, doc) => {
    const pago = doc.data() as PagoReferido;
    return total + normalizarNumero(pago.monto);
  }, 0);

  const capitalComprometido = capitalPrestadoActivo + capitalPendientePorAprobar;
  const gananciaEsperada = totalPorRecuperar - capitalPrestadoActivo;
  const disponibleRealDespuesDeBonos = disponibleParaTransferir - bonosReferidosPendientes;
  const resumenPromocional = construirResumenPromocional(promocionesSnap, activacionesSnap);

  return {
    ok: true,
    configurado: capitalSnap.exists,
    capitalOperativoTotal,
    disponibleParaTransferir,
    capitalComprometido,
    capitalPrestadoActivo,
    totalPorRecuperar,
    gananciaEsperada,
    gananciaGenerada: solicitudesPagadasConBase > 0 ? gananciaGenerada : null,
    bonosReferidosPendientes,
    bonosReferidosPagados,
    usuariosConSaldoRecompensa: usuariosConSaldoSnap.size,
    disponibleRealDespuesDeBonos,
    topeMaximoPorPrestamo,
    capitalTotal: capitalOperativoTotal,
    capitalPrestado: normalizarNumero(capital?.capitalPrestado),
    capitalDisponible: disponibleParaTransferir,
    ...resumenPromocional,
  };
}

function esPrestamoActivo(estado: EstadoSolicitudAdelanto) {
  return estado === 'aprobada' || estado === 'vencida';
}

function obtenerTotalAPagar(prestamo: Prestamo) {
  const totalExistente = normalizarNumero(prestamo.totalAPagar || prestamo.montoSiPagaHoy);
  if (totalExistente > 0) {
    return totalExistente;
  }

  return normalizarNumero(prestamo.monto) + normalizarNumero(prestamo.comisionMonto);
}

function normalizarNumero(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function construirResumenPromocional(
  promocionesSnap: FirebaseFirestore.QuerySnapshot,
  activacionesSnap: FirebaseFirestore.QuerySnapshot
) {
  let promocionesActivas = 0;
  let promocionesAgotadas = 0;
  let presupuestoPromocionalDisponible = 0;
  let activacionesPendientes = 0;
  let impulsosEmitidos = 0;
  let bonosDineroPendientes = 0;

  promocionesSnap.docs.forEach((doc) => {
    const promocion = doc.data() as Promocion;

    if (promocion.estado === 'activa') {
      promocionesActivas += 1;
    }

    if (promocion.estado === 'agotada') {
      promocionesAgotadas += 1;
    }

    if (
      promocion.presupuesto?.tipo !== 'ilimitado' &&
      (promocion.estado === 'activa' || promocion.estado === 'pausada')
    ) {
      presupuestoPromocionalDisponible += normalizarNumero(promocion.presupuesto?.disponible);
    }
  });

  activacionesSnap.docs.forEach((doc) => {
    const activacion = doc.data() as ActivacionPromocion;

    if (activacion.estado === 'pendiente') {
      activacionesPendientes += 1;
    }

    if (activacion.recompensaTipo === 'impulsos' && activacion.estado !== 'cancelada') {
      impulsosEmitidos += normalizarNumero(activacion.cantidad);
    }

    if (activacion.recompensaTipo === 'bono_dinero' && activacion.estado === 'pendiente') {
      bonosDineroPendientes += normalizarNumero(activacion.cantidad);
    }
  });

  return {
    promocionesActivas,
    promocionesAgotadas,
    activacionesPendientes,
    impulsosEmitidos,
    bonosDineroPendientes,
    presupuestoPromocionalDisponible,
  };
}
