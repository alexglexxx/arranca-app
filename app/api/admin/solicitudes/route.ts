import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/auth';
import { listarSolicitudesAdmin } from '@/lib/solicitudes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const solicitudes = await listarSolicitudesAdmin();
    return NextResponse.json({ ok: true, solicitudes });
  } catch (error) {
    return errorResponse(error, 'Error en GET /api/admin/solicitudes:');
  }
}
