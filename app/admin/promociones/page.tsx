'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui';
import type {
  ActivacionPromocion,
  EstadoPromocion,
  Promocion,
  TipoRecompensaPromocion,
  TipoTriggerPromocion,
} from '@/types';

const TRIGGERS: TipoTriggerPromocion[] = [
  'referido_primer_pago_completo',
  'usuario_pago_puntual',
  'usuario_completa_kyc',
  'racha_pagos_puntuales',
];

const RECOMPENSAS: TipoRecompensaPromocion[] = [
  'bono_dinero',
  'impulsos',
  'descuento_comision',
];

export default function AdminPromocionesPage() {
  const router = useRouter();
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [activaciones, setActivaciones] = useState<ActivacionPromocion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    trigger: 'referido_primer_pago_completo' as TipoTriggerPromocion,
    recompensaTipo: 'impulsos' as TipoRecompensaPromocion,
    recompensaCantidad: '3',
    presupuestoTipo: 'unidades' as Promocion['presupuesto']['tipo'],
    presupuestoTotal: '300',
    limitePorUsuario: '',
  });

  const cargar = useCallback(async () => {
    setError(null);

    try {
      const [promosRes, activacionesRes] = await Promise.all([
        fetch('/api/admin/promociones', { cache: 'no-store' }),
        fetch('/api/admin/promociones/activaciones', { cache: 'no-store' }),
      ]);
      const promosData = await promosRes.json();
      const activacionesData = await activacionesRes.json();

      if (promosRes.status === 401 || activacionesRes.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (!promosRes.ok) {
        setError(promosData.error || 'No se pudieron cargar promociones.');
        return;
      }

      if (!activacionesRes.ok) {
        setError(activacionesData.error || 'No se pudieron cargar activaciones.');
        return;
      }

      setPromociones(promosData.promociones || []);
      setActivaciones(activacionesData.activaciones || []);
    } catch {
      setError('No se pudo cargar promociones.');
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function crearPromocion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setProcesandoId('crear');
    setError(null);

    const presupuesto =
      form.presupuestoTipo === 'ilimitado'
        ? { tipo: 'ilimitado', total: null, disponible: null }
        : {
            tipo: form.presupuestoTipo,
            total: Number(form.presupuestoTotal),
            disponible: Number(form.presupuestoTotal),
          };

    try {
      const res = await fetch('/api/admin/promociones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: form.nombre,
          estado: 'pausada',
          trigger: form.trigger,
          recompensa: {
            tipo: form.recompensaTipo,
            cantidad: Number(form.recompensaCantidad),
          },
          presupuesto,
          limitePorUsuario: form.limitePorUsuario ? Number(form.limitePorUsuario) : null,
        }),
      });
      const data = await res.json();

      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (!res.ok) {
        setError(data.error || 'No se pudo crear la promoción.');
        return;
      }

      setForm((actual) => ({ ...actual, nombre: '' }));
      await cargar();
    } catch {
      setError('No se pudo crear la promoción.');
    } finally {
      setProcesandoId(null);
    }
  }

  async function actualizarPromocion(id: string, body: Record<string, unknown>) {
    setProcesandoId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/promociones/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (!res.ok) {
        setError(data.error || 'No se pudo actualizar la promoción.');
        return;
      }

      await cargar();
    } catch {
      setError('No se pudo actualizar la promoción.');
    } finally {
      setProcesandoId(null);
    }
  }

  function agregarPresupuesto(promocion: Promocion) {
    const monto = window.prompt('Monto a agregar al presupuesto:');
    if (monto === null) return;

    const agregarPresupuesto = Number(monto);
    if (!Number.isFinite(agregarPresupuesto) || agregarPresupuesto <= 0) {
      setError('El presupuesto a agregar debe ser mayor a 0.');
      return;
    }

    void actualizarPromocion(promocion.id, { agregarPresupuesto });
  }

  if (cargando) {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-8 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 pt-8 pb-10 min-h-screen">
      <div className="mb-5">
        <Link href="/admin/solicitudes" className="text-sm text-amber font-semibold">
          Volver a solicitudes
        </Link>
      </div>

      <h1 className="font-display text-[28px] font-semibold leading-[1.15] mb-2">
        Promociones y activaciones
      </h1>
      <p className="text-textDim text-[14.5px] leading-relaxed mb-6">
        Administra recompensas por referidos, impulsos y descuentos.
      </p>

      {error && (
        <p className="text-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <Card>
        <form onSubmit={crearPromocion} className="space-y-3">
          <h2 className="font-semibold text-[16px]">Crear promoción</h2>
          <input
            className="w-full rounded-[14px] border border-border bg-[#17110A] px-3 py-3 text-sm text-text outline-none"
            value={form.nombre}
            onChange={(event) => setForm({ ...form, nombre: event.target.value })}
            placeholder="Nombre"
            required
          />

          <Select
            value={form.trigger}
            onChange={(value) => setForm({ ...form, trigger: value as TipoTriggerPromocion })}
            options={TRIGGERS}
          />
          <Select
            value={form.recompensaTipo}
            onChange={(value) =>
              setForm({
                ...form,
                recompensaTipo: value as TipoRecompensaPromocion,
                presupuestoTipo: value === 'bono_dinero' ? 'dinero' : 'unidades',
              })
            }
            options={RECOMPENSAS}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              className="w-full rounded-[14px] border border-border bg-[#17110A] px-3 py-3 text-sm text-text outline-none"
              value={form.recompensaCantidad}
              onChange={(event) => setForm({ ...form, recompensaCantidad: event.target.value })}
              inputMode="numeric"
              placeholder="Cantidad recompensa"
              required
            />
            <Select
              value={form.presupuestoTipo}
              onChange={(value) =>
                setForm({ ...form, presupuestoTipo: value as Promocion['presupuesto']['tipo'] })
              }
              options={['dinero', 'unidades', 'ilimitado']}
            />
            <input
              className="w-full rounded-[14px] border border-border bg-[#17110A] px-3 py-3 text-sm text-text outline-none disabled:opacity-50"
              value={form.presupuestoTotal}
              onChange={(event) => setForm({ ...form, presupuestoTotal: event.target.value })}
              inputMode="numeric"
              placeholder="Presupuesto total"
              disabled={form.presupuestoTipo === 'ilimitado'}
            />
          </div>

          <input
            className="w-full rounded-[14px] border border-border bg-[#17110A] px-3 py-3 text-sm text-text outline-none"
            value={form.limitePorUsuario}
            onChange={(event) => setForm({ ...form, limitePorUsuario: event.target.value })}
            inputMode="numeric"
            placeholder="Límite por usuario (opcional)"
          />

          <button
            type="submit"
            disabled={procesandoId === 'crear'}
            className="w-full rounded-[14px] bg-amber px-4 py-3 text-sm font-bold text-[#1A1304] disabled:opacity-50"
          >
            {procesandoId === 'crear' ? 'Creando...' : 'Crear pausada'}
          </button>
        </form>
      </Card>

      <div className="space-y-3 mt-5">
        {promociones.length === 0 && (
          <Card>
            <p className="text-[14.5px] text-textDim">No hay promociones registradas.</p>
          </Card>
        )}

        {promociones.map((promocion) => (
          <Card key={promocion.id}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="font-semibold text-[15px] break-words">{promocion.nombre}</p>
                <p className="text-xs text-textDim break-words">{formatTrigger(promocion.trigger)}</p>
              </div>
              <span className={estadoClassName(promocion.estado)}>
                {formatEstado(promocion.estado)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[13px] text-textDim mb-3">
              <Metric label="Recompensa" value={formatRecompensa(promocion)} />
              <Metric label="Total" value={formatPresupuestoTotal(promocion)} />
              <Metric label="Disponible" value={formatPresupuestoDisponible(promocion)} />
              <Metric label="Límite" value={promocion.limitePorUsuario ?? 'Sin límite'} />
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton
                disabled={procesandoId === promocion.id || promocion.estado === 'pausada'}
                onClick={() => actualizarPromocion(promocion.id, { accion: 'pausar' })}
              >
                Pausar
              </ActionButton>
              <ActionButton
                disabled={procesandoId === promocion.id || promocion.estado === 'activa'}
                onClick={() => actualizarPromocion(promocion.id, { accion: 'reactivar' })}
              >
                Reactivar
              </ActionButton>
              <ActionButton
                disabled={procesandoId === promocion.id || promocion.estado === 'finalizada'}
                onClick={() => actualizarPromocion(promocion.id, { accion: 'finalizar' })}
              >
                Finalizar
              </ActionButton>
              {promocion.presupuesto.tipo !== 'ilimitado' && (
                <ActionButton
                  disabled={procesandoId === promocion.id}
                  onClick={() => agregarPresupuesto(promocion)}
                >
                  Agregar presupuesto
                </ActionButton>
              )}
            </div>
          </Card>
        ))}
      </div>

      <section className="mt-7">
        <h2 className="font-semibold text-[16px] mb-3">Activaciones recientes</h2>
        <div className="space-y-3">
          {activaciones.slice(0, 10).map((activacion) => (
            <Card key={activacion.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{formatRecompensaActivacion(activacion)}</p>
                  <p className="text-xs text-textDim break-words">
                    {formatTrigger(activacion.trigger)} · {formatUid(activacion.usuarioId)}
                  </p>
                  {activacion.referidoId && (
                    <p className="text-xs text-textDim break-words">
                      Referido {formatUid(activacion.referidoId)}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold text-textDim">
                  {activacion.estado}
                </span>
              </div>
            </Card>
          ))}

          {activaciones.length === 0 && (
            <Card>
              <p className="text-[14.5px] text-textDim">No hay activaciones registradas.</p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      className="w-full rounded-[14px] border border-border bg-[#17110A] px-3 py-3 text-sm text-text outline-none"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-border bg-[#17110A] p-3">
      <p className="text-[11px] text-textDim">{label}</p>
      <p className="mt-1 break-words font-mono text-sm font-semibold text-text">{value}</p>
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-[12px] border border-border px-3 py-2 text-sm font-semibold text-textDim disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatEstado(estado: EstadoPromocion) {
  const mapa: Record<EstadoPromocion, string> = {
    activa: 'Activa',
    pausada: 'Pausada',
    agotada: 'Agotada',
    finalizada: 'Finalizada',
  };

  return mapa[estado];
}

function estadoClassName(estado: EstadoPromocion) {
  const mapa: Record<EstadoPromocion, string> = {
    activa: 'rounded-full bg-greenDim px-2.5 py-1 text-xs font-semibold text-green',
    pausada: 'rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold text-textDim',
    agotada: 'rounded-full bg-amberDim px-2.5 py-1 text-xs font-semibold text-amber',
    finalizada: 'rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger',
  };

  return mapa[estado];
}

function formatTrigger(trigger: TipoTriggerPromocion) {
  const mapa: Record<TipoTriggerPromocion, string> = {
    referido_primer_pago_completo: 'Referido primer pago completo',
    usuario_pago_puntual: 'Pago puntual',
    usuario_completa_kyc: 'KYC completo',
    racha_pagos_puntuales: 'Racha pagos puntuales',
  };

  return mapa[trigger];
}

function formatRecompensa(promocion: Promocion) {
  if (promocion.recompensa.tipo === 'bono_dinero') {
    return formatCurrency(promocion.recompensa.cantidad);
  }

  return `${promocion.recompensa.cantidad} ${promocion.recompensa.tipo}`;
}

function formatPresupuestoTotal(promocion: Promocion) {
  if (promocion.presupuesto.tipo === 'ilimitado') {
    return 'Ilimitado';
  }

  return promocion.presupuesto.tipo === 'dinero'
    ? formatCurrency(Number(promocion.presupuesto.total || 0))
    : Number(promocion.presupuesto.total || 0);
}

function formatPresupuestoDisponible(promocion: Promocion) {
  if (promocion.presupuesto.tipo === 'ilimitado') {
    return 'Ilimitado';
  }

  return promocion.presupuesto.tipo === 'dinero'
    ? formatCurrency(Number(promocion.presupuesto.disponible || 0))
    : Number(promocion.presupuesto.disponible || 0);
}

function formatRecompensaActivacion(activacion: ActivacionPromocion) {
  if (activacion.recompensaTipo === 'bono_dinero') {
    return formatCurrency(activacion.cantidad);
  }

  return `${activacion.cantidad} ${activacion.recompensaTipo}`;
}

function formatUid(uid: string) {
  if (uid.length <= 14) {
    return uid;
  }

  return `${uid.slice(0, 8)}...${uid.slice(-4)}`;
}
