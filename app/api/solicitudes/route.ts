import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireUser } from '@/lib/auth';
import { crearSolicitudParaUsuario } from '@/lib/solicitudes';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(request);
    const solicitud = await crearSolicitudParaUsuario(actor.uid);
    return NextResponse.json({ ok: true, solicitud });
  } catch (error) {
    return errorResponse(error, 'Error en POST /api/solicitudes:');
  }
}
