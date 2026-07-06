import { NextRequest, NextResponse } from 'next/server';
import { assertAdminOrOwner, errorResponse, requireAdmin, requireUserOrAdmin } from '@/lib/auth';
import {
  actualizarEstadoSolicitud,
  obtenerSolicitudPorId,
  reportarPagoSolicitudLegacy,
} from '@/lib/solicitudes';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accion, prestamoId } = body;

    if (!prestamoId) {
      return NextResponse.json({ error: 'prestamoId es obligatorio.' }, { status: 400 });
    }

    if (accion === 'subir_comprobante') {
      if (!body.comprobantePagoUrl) {
        return NextResponse.json(
          { error: 'comprobantePagoUrl es obligatorio.' },
          { status: 400 }
        );
      }

      const actor = await requireUserOrAdmin(request);
      const solicitud = await obtenerSolicitudPorId(prestamoId);

      if (!solicitud) {
        return NextResponse.json({ error: 'Prestamo no encontrado.' }, { status: 404 });
      }

      assertAdminOrOwner(actor, solicitud.userId);

      const actualizada = await reportarPagoSolicitudLegacy({
        solicitudId: prestamoId,
        actorId: actor.kind === 'admin' ? actor.username : actor.uid,
        actorRol: actor.kind === 'admin' ? 'admin' : 'usuario',
        ownerUserId: solicitud.userId,
        comprobantePagoUrl: body.comprobantePagoUrl,
        montoReportado: Number(body.montoReportado || solicitud.totalAPagar),
        referencia: body.referencia,
        notaUsuario: body.notaUsuario,
      });

      return NextResponse.json({
        comprobanteSubido: true,
        ok: true,
        solicitud: actualizada,
      });
    }

    if (accion === 'confirmar_pago') {
      const adminActor = await requireAdmin(request);
      const solicitud = await obtenerSolicitudPorId(prestamoId);

      if (!solicitud) {
        return NextResponse.json({ error: 'Prestamo no encontrado.' }, { status: 404 });
      }

      const accionAdmin =
        solicitud.comprobante?.estadoRevision === 'pendiente_revision'
          ? 'validar_pago_reportado'
          : 'marcar_pagada';

      const actualizada = await actualizarEstadoSolicitud({
        solicitudId: prestamoId,
        accion: accionAdmin,
        actorId: body.confirmadoPor || adminActor.username,
        montoFinalPagado: Number(body.montoFinalPagado || solicitud.totalAPagar),
        notaAdmin: 'Confirmado desde el endpoint legacy /api/prestamos/pagar.',
      });

      return NextResponse.json({
        pagoConfirmado: true,
        ok: true,
        solicitud: actualizada,
      });
    }

    return NextResponse.json(
      { error: 'accion debe ser "subir_comprobante" o "confirmar_pago".' },
      { status: 400 }
    );
  } catch (error) {
    return errorResponse(error, 'Error en /api/prestamos/pagar:');
  }
}
