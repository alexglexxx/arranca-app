import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import type { EstadoPromocion, Promocion } from '@/types';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const promocionId = context.params.id;

    if (!promocionId) {
      return NextResponse.json({ ok: false, error: 'id es obligatorio.' }, { status: 400 });
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const promocionRef = adminDb.collection('promociones').doc(promocionId);
      const promocionSnap = await transaction.get(promocionRef);

      if (!promocionSnap.exists) {
        return { status: 404, body: { ok: false, error: 'Promoción no encontrada.' } };
      }

      const promocion = {
        id: promocionSnap.id,
        ...(promocionSnap.data() as Omit<Promocion, 'id'>),
      };
      const update = construirUpdatePromocion(promocion, body);

      if (!update.ok) {
        return { status: 400, body: { ok: false, error: update.error } };
      }

      transaction.update(promocionRef, update.data);

      return {
        status: 200,
        body: {
          ok: true,
          promocion: {
            ...promocion,
            ...update.data,
          },
        },
      };
    });

    return NextResponse.json(resultado.body, { status: resultado.status });
  } catch (error) {
    return errorResponse(error, 'Error en PATCH /api/admin/promociones/[id]:');
  }
}

type UpdatePromocionResult =
  | { ok: false; error: string }
  | { ok: true; data: Partial<Promocion> };

function construirUpdatePromocion(
  promocion: Promocion,
  body: Record<string, unknown>
): UpdatePromocionResult {
  const ahora = Date.now();
  const update: Partial<Promocion> = {
    actualizadoEn: ahora,
  };

  if (body.nombre !== undefined) {
    const nombre = String(body.nombre || '').trim();
    if (!nombre) {
      return { ok: false, error: 'nombre no puede estar vacío.' };
    }
    update.nombre = nombre;
  }

  if (body.descripcion !== undefined) {
    update.descripcion = body.descripcion ? String(body.descripcion).trim() : null;
  }

  if (body.limitePorUsuario !== undefined) {
    const limite =
      body.limitePorUsuario === null || body.limitePorUsuario === ''
        ? null
        : Number(body.limitePorUsuario);
    if (limite !== null && (!Number.isFinite(limite) || limite < 0)) {
      return { ok: false, error: 'limitePorUsuario no puede ser negativo.' };
    }
    update.limitePorUsuario = limite;
  }

  if (body.fechaFin !== undefined) {
    const fechaFin = body.fechaFin === null || body.fechaFin === '' ? null : Number(body.fechaFin);
    if (fechaFin !== null && !Number.isFinite(fechaFin)) {
      return { ok: false, error: 'fechaFin inválida.' };
    }
    update.fechaFin = fechaFin;
  }

  const agregarPresupuesto = Number(body.agregarPresupuesto || 0);
  if (body.agregarPresupuesto !== undefined) {
    if (!Number.isFinite(agregarPresupuesto) || agregarPresupuesto < 0) {
      return { ok: false, error: 'No se permite presupuesto negativo.' };
    }

    if (agregarPresupuesto > 0) {
      if (promocion.presupuesto.tipo === 'ilimitado') {
        return { ok: false, error: 'No se agrega presupuesto a promociones ilimitadas.' };
      }

      update.presupuesto = {
        ...promocion.presupuesto,
        total: Number(promocion.presupuesto.total || 0) + agregarPresupuesto,
        disponible: Number(promocion.presupuesto.disponible || 0) + agregarPresupuesto,
      };
    }
  }

  const accion = String(body.accion || '');
  const estadoSolicitado = body.estado ? String(body.estado) : null;
  const siguienteEstado = resolverEstadoSolicitado(accion, estadoSolicitado);

  if (!siguienteEstado.ok) {
    return siguienteEstado;
  }

  if (siguienteEstado.estado) {
    const validacionEstado = validarCambioEstado(promocion, siguienteEstado.estado, update);
    if (!validacionEstado.ok) {
      return validacionEstado;
    }
    update.estado = siguienteEstado.estado;
  }

  return { ok: true, data: update };
}

function resolverEstadoSolicitado(
  accion: string,
  estado: string | null
): { ok: true; estado: EstadoPromocion | null } | { ok: false; error: string } {
  if (accion === 'pausar') return { ok: true, estado: 'pausada' };
  if (accion === 'reactivar') return { ok: true, estado: 'activa' };
  if (accion === 'finalizar') return { ok: true, estado: 'finalizada' };

  if (!estado) {
    return { ok: true, estado: null };
  }

  if (estado === 'activa' || estado === 'pausada' || estado === 'agotada' || estado === 'finalizada') {
    return { ok: true, estado };
  }

  return { ok: false, error: 'Estado no soportado.' };
}

function validarCambioEstado(
  promocion: Promocion,
  estado: EstadoPromocion,
  update: Partial<Promocion>
): { ok: true } | { ok: false; error: string } {
  if (estado !== 'activa') {
    return { ok: true };
  }

  if (promocion.estado === 'finalizada') {
    return { ok: false, error: 'No se puede reactivar una promoción finalizada.' };
  }

  const presupuesto = update.presupuesto || promocion.presupuesto;
  if (presupuesto.tipo === 'ilimitado') {
    return { ok: true };
  }

  if (Number(presupuesto.disponible || 0) < Number(promocion.recompensa.cantidad || 0)) {
    return {
      ok: false,
      error: 'No hay presupuesto suficiente para reactivar esta promoción.',
    };
  }

  return { ok: true };
}
