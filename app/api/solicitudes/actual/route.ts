import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireUser } from '@/lib/auth';
import {
  canCreateNewSolicitud,
  obtenerSolicitudActualUsuario,
} from '@/lib/solicitudes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(request);
    const solicitud = await obtenerSolicitudActualUsuario(actor.uid);
    const puedeSolicitar = canCreateNewSolicitud(solicitud?.estado || null);
    const tieneSolicitud = Boolean(solicitud);

    return NextResponse.json({
      ok: true,
      tieneSolicitud,
      solicitud,
      puedeSolicitar,
    });
  } catch (error) {
    return errorResponse(error, 'Error en GET /api/solicitudes/actual:');
  }
}
