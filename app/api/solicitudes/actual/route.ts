import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireUser } from '@/lib/auth';
import {
  canCreateNewSolicitud,
  obtenerSolicitudBloqueanteUsuario,
} from '@/lib/solicitudes';
import type { SolicitudActualUsuarioResponse } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(request);
    const solicitud = await obtenerSolicitudBloqueanteUsuario(actor.uid);
    const puedeSolicitar = canCreateNewSolicitud(solicitud?.estado || null);
    const tieneSolicitud = Boolean(solicitud);
    const estado = solicitud?.estado || 'sin_solicitud';

    const payload: SolicitudActualUsuarioResponse = {
      ok: true,
      estado,
      tieneSolicitud,
      solicitud,
      puedeSolicitar,
      mensaje: tieneSolicitud ? 'Solicitud activa' : 'Sin solicitud activa',
    };

    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(error, 'Error en GET /api/solicitudes/actual:');
  }
}
