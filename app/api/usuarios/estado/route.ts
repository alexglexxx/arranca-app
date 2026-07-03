import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireUser } from '@/lib/auth';
import { resolveUserRouteState } from '@/lib/user-state';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(request);
    const estado = await resolveUserRouteState(actor.uid);
    return NextResponse.json(estado);
  } catch (error) {
    return errorResponse(error, 'Error en /api/usuarios/estado:');
  }
}
