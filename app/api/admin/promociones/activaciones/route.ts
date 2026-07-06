import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import type {
  ActivacionPromocion,
  EstadoActivacionPromocion,
  TipoTriggerPromocion,
} from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const promocionId = searchParams.get('promocionId');
    const usuarioId = searchParams.get('usuarioId');
    const estado = searchParams.get('estado') as EstadoActivacionPromocion | null;
    const trigger = searchParams.get('trigger') as TipoTriggerPromocion | null;

    const snapshot = await adminDb
      .collection('activacionesPromocion')
      .orderBy('creadoEn', 'desc')
      .limit(200)
      .get();

    const activaciones = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ActivacionPromocion, 'id'>) }))
      .filter((activacion) => !promocionId || activacion.promocionId === promocionId)
      .filter((activacion) => !usuarioId || activacion.usuarioId === usuarioId)
      .filter((activacion) => !estado || activacion.estado === estado)
      .filter((activacion) => !trigger || activacion.trigger === trigger);

    return NextResponse.json({ ok: true, activaciones });
  } catch (error) {
    return errorResponse(error, 'Error en GET /api/admin/promociones/activaciones:');
  }
}
