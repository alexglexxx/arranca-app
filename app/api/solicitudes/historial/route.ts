import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireUser } from '@/lib/auth';
import { listarHistorialSolicitudesUsuario } from '@/lib/solicitudes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(request);
    const historial = await listarHistorialSolicitudesUsuario(actor.uid, 5);
    return NextResponse.json({ ok: true, historial });
  } catch (error) {
    return errorResponse(error, 'Error en GET /api/solicitudes/historial:');
  }
}
