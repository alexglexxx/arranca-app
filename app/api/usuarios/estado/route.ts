import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, isAdminUid, requireUser } from '@/lib/auth';
import { resolveUserRouteState } from '@/lib/user-state';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(request);

    if (isAdminUid(actor.uid)) {
      return NextResponse.json({
        ok: true,
        usuarioId: actor.uid,
        usuario: { estado: 'admin' },
        estadoUsuario: 'admin',
        estadoSolicitud: 'sin_solicitud',
        estadoPrestamo: 'sin_prestamo',
        prestamoId: null,
        nextRoute: '/admin/solicitudes',
      });
    }

    const estado = await resolveUserRouteState(actor.uid);
    return NextResponse.json(estado);
  } catch (error) {
    return errorResponse(error, 'Error en /api/usuarios/estado:');
  }
}
