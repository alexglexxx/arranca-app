import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/auth';
import { actualizarEstadoSolicitud } from '@/lib/solicitudes';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminActor = await requireAdmin(request);
    const body = await request.json();
    const solicitud = await actualizarEstadoSolicitud({
      solicitudId: params.id,
      accion: body.accion,
      actorId: adminActor.username,
      motivoRechazo: body.motivoRechazo,
      notaAdmin: body.notaAdmin,
    });

    return NextResponse.json({ ok: true, solicitud });
  } catch (error) {
    return errorResponse(error, 'Error en PATCH /api/admin/solicitudes/[id]:');
  }
}
