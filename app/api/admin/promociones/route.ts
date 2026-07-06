import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import type {
  EstadoPromocion,
  Promocion,
  TipoRecompensaPromocion,
  TipoTriggerPromocion,
} from '@/types';

export const dynamic = 'force-dynamic';

const TRIGGERS_SOPORTADOS: TipoTriggerPromocion[] = [
  'referido_primer_pago_completo',
  'usuario_pago_puntual',
  'usuario_completa_kyc',
  'racha_pagos_puntuales',
];
const RECOMPENSAS_SOPORTADAS: TipoRecompensaPromocion[] = [
  'bono_dinero',
  'impulsos',
  'descuento_comision',
];
const ESTADOS_CREACION: EstadoPromocion[] = ['activa', 'pausada'];
const TIPOS_PRESUPUESTO = ['dinero', 'unidades', 'ilimitado'] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const snapshot = await adminDb
      .collection('promociones')
      .orderBy('creadoEn', 'desc')
      .limit(100)
      .get();

    const promociones = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Promocion, 'id'>),
    }));

    return NextResponse.json({ ok: true, promociones });
  } catch (error) {
    return errorResponse(error, 'Error en GET /api/admin/promociones:');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const ahora = Date.now();
    const validacion = validarPromocionNueva(body, ahora);

    if (!validacion.ok) {
      return NextResponse.json({ ok: false, error: validacion.error }, { status: 400 });
    }

    const promocionRef = adminDb.collection('promociones').doc();
    const promocion: Promocion = {
      id: promocionRef.id,
      nombre: validacion.nombre,
      descripcion: validacion.descripcion,
      estado: validacion.estado,
      trigger: validacion.trigger,
      recompensa: validacion.recompensa,
      presupuesto: validacion.presupuesto,
      limitePorUsuario: validacion.limitePorUsuario,
      fechaInicio: validacion.fechaInicio,
      fechaFin: validacion.fechaFin,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };

    await promocionRef.set(promocion);
    return NextResponse.json({ ok: true, promocion }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Error en POST /api/admin/promociones:');
  }
}

type ValidacionPromocionNueva =
  | { ok: false; error: string }
  | ({
      ok: true;
    } & Pick<
      Promocion,
      | 'nombre'
      | 'descripcion'
      | 'estado'
      | 'trigger'
      | 'recompensa'
      | 'presupuesto'
      | 'limitePorUsuario'
      | 'fechaInicio'
      | 'fechaFin'
    >);

function validarPromocionNueva(body: Record<string, unknown>, ahora: number): ValidacionPromocionNueva {
  const nombre = String(body.nombre || '').trim();
  if (!nombre) {
    return { ok: false, error: 'nombre es obligatorio.' };
  }

  const estado = String(body.estado || 'pausada') as EstadoPromocion;
  if (!ESTADOS_CREACION.includes(estado)) {
    return { ok: false, error: 'estado debe ser activa o pausada.' };
  }

  const trigger = String(body.trigger || '') as TipoTriggerPromocion;
  if (!TRIGGERS_SOPORTADOS.includes(trigger)) {
    return { ok: false, error: 'trigger no soportado.' };
  }

  const recompensaBody = body.recompensa as Record<string, unknown> | undefined;
  const recompensaTipo = String(recompensaBody?.tipo || '') as TipoRecompensaPromocion;
  if (!RECOMPENSAS_SOPORTADAS.includes(recompensaTipo)) {
    return { ok: false, error: 'recompensa.tipo no soportado.' };
  }

  const recompensaCantidad = Number(recompensaBody?.cantidad || 0);
  if (!Number.isFinite(recompensaCantidad) || recompensaCantidad <= 0) {
    return { ok: false, error: 'recompensa.cantidad debe ser mayor a 0.' };
  }

  const presupuestoBody = body.presupuesto as Record<string, unknown> | undefined;
  const presupuestoTipo = String(presupuestoBody?.tipo || '') as Promocion['presupuesto']['tipo'];
  if (!TIPOS_PRESUPUESTO.includes(presupuestoTipo)) {
    return { ok: false, error: 'presupuesto.tipo no soportado.' };
  }

  const presupuesto =
    presupuestoTipo === 'ilimitado'
      ? { tipo: presupuestoTipo, total: null, disponible: null }
      : normalizarPresupuestoLimitado(presupuestoBody);

  if (!presupuesto) {
    return { ok: false, error: 'presupuesto.total y presupuesto.disponible deben ser >= 0.' };
  }

  const limitePorUsuario =
    body.limitePorUsuario === null || body.limitePorUsuario === undefined || body.limitePorUsuario === ''
      ? null
      : Number(body.limitePorUsuario);
  if (limitePorUsuario !== null && (!Number.isFinite(limitePorUsuario) || limitePorUsuario < 0)) {
    return { ok: false, error: 'limitePorUsuario no puede ser negativo.' };
  }

  const fechaInicio = body.fechaInicio ? Number(body.fechaInicio) : ahora;
  const fechaFin = body.fechaFin ? Number(body.fechaFin) : null;
  if (!Number.isFinite(fechaInicio) || (fechaFin !== null && !Number.isFinite(fechaFin))) {
    return { ok: false, error: 'Fechas inválidas.' };
  }

  return {
    ok: true,
    nombre,
    descripcion: body.descripcion ? String(body.descripcion).trim() : null,
    estado,
    trigger,
    recompensa: {
      tipo: recompensaTipo,
      cantidad: recompensaCantidad,
    },
    presupuesto,
    limitePorUsuario,
    fechaInicio,
    fechaFin,
  };
}

function normalizarPresupuestoLimitado(body?: Record<string, unknown>) {
  const total = Number(body?.total);
  const disponible = body?.disponible === undefined || body?.disponible === ''
    ? total
    : Number(body.disponible);

  if (!Number.isFinite(total) || !Number.isFinite(disponible) || total < 0 || disponible < 0) {
    return null;
  }

  return {
    tipo: String(body?.tipo) as 'dinero' | 'unidades',
    total,
    disponible,
  };
}
