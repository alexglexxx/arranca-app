import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireUser } from '@/lib/auth';
import { isTestResetEnabled, resetMiSolicitud } from '@/lib/dev-reset';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(request);

    if (!isTestResetEnabled()) {
      return NextResponse.json(
        {
          error:
            'El reset de solicitud de prueba esta deshabilitado en produccion. Solo se permite fuera de produccion o con ENABLE_TEST_RESET=true.',
        },
        { status: 403 }
      );
    }

    const resultado = await resetMiSolicitud(actor.uid);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    return errorResponse(error, 'Error en /api/dev/reset-mi-solicitud:');
  }
}
