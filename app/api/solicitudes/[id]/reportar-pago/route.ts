import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireUser } from '@/lib/auth';
import { reportarPagoSolicitudUsuario } from '@/lib/solicitudes';
import type { MetodoPagoManual } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const actor = await requireUser(request);
    const body = await request.json();

    const montoReportado = Number(body.montoReportado);
    const metodoReportado = body.metodoReportado as MetodoPagoManual;
    const referencia = String(body.referencia || '').trim();
    const notaUsuario =
      typeof body.notaUsuario === 'string' ? body.notaUsuario.trim() : undefined;
    const imagenUrl = typeof body.imagenUrl === 'string' ? body.imagenUrl.trim() : undefined;

    if (!Number.isFinite(montoReportado) || montoReportado <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Ingresa un monto pagado valido.' },
        { status: 400 }
      );
    }

    if (!['transferencia', 'efectivo', 'otro'].includes(metodoReportado)) {
      return NextResponse.json(
        { ok: false, error: 'Selecciona un metodo de pago valido.' },
        { status: 400 }
      );
    }

    if (!referencia) {
      return NextResponse.json(
        { ok: false, error: 'La referencia es obligatoria.' },
        { status: 400 }
      );
    }

    await reportarPagoSolicitudUsuario({
      solicitudId: params.id,
      userId: actor.uid,
      montoReportado,
      metodoReportado,
      referencia,
      notaUsuario,
      imagenUrl,
    });

    return NextResponse.json({
      ok: true,
      message: 'Comprobante enviado para revision.',
    });
  } catch (error) {
    return errorResponse(error, 'Error en POST /api/solicitudes/[id]/reportar-pago:');
  }
}
