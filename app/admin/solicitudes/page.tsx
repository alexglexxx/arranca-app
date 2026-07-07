'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui';
import type {
  AdminCapitalResumen,
  EstadoSolicitudAdelanto,
  HistorialUsuarioAdminResumen,
  SolicitudAdelanto,
} from '@/types';

type AdminAction =
  | 'aprobar'
  | 'rechazar'
  | 'cancelar'
  | 'eliminar'
  | 'marcar_pagada'
  | 'marcar_vencida'
  | 'validar_pago_reportado'
  | 'rechazar_comprobante';

type SolicitudAdminItem = SolicitudAdelanto & {
  usuario: {
    nombre: string;
    telefono: string;
    correo: string;
  } | null;
  historialUsuario: HistorialUsuarioAdminResumen;
};

export default function AdminSolicitudesPage() {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<SolicitudAdminItem[]>([]);
  const [capitalResumen, setCapitalResumen] = useState<AdminCapitalResumen | null>(null);
  const [cargandoCapital, setCargandoCapital] = useState(false);
  const [capitalError, setCapitalError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargarSolicitudes = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/solicitudes', {
        cache: 'no-store',
      });
      const data = await response.json();

      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (!response.ok) {
        setError(data.error || 'No se pudo cargar el panel admin.');
        setSolicitudes([]);
        return;
      }

      setSolicitudes(data.solicitudes || []);
    } catch {
      setError('No se pudo cargar el panel admin.');
    } finally {
      setCargando(false);
    }
  }, [router]);

  const cargarCapital = useCallback(async () => {
    setCargandoCapital(true);
    setCapitalError(null);

    try {
      const response = await fetch('/api/admin/capital', {
        cache: 'no-store',
      });
      const data = await response.json();

      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (!response.ok) {
        setCapitalResumen(null);
        setCapitalError('No se pudo cargar el resumen financiero.');
        return;
      }

      setCapitalResumen(data as AdminCapitalResumen);
    } catch {
      setCapitalResumen(null);
      setCapitalError('No se pudo cargar el resumen financiero.');
    } finally {
      setCargandoCapital(false);
    }
  }, [router]);

  useEffect(() => {
    void cargarCapital();
    void cargarSolicitudes();
  }, [cargarCapital, cargarSolicitudes]);

  async function ejecutarAccion(solicitudId: string, accion: AdminAction) {
    let motivoRechazo: string | undefined;
    let notaAdmin: string | undefined;

    if (accion === 'rechazar') {
      const motivo = window.prompt('Motivo del rechazo:');
      if (motivo === null) return;
      motivoRechazo = motivo.trim() || 'No cumple requisitos mínimos.';
    }

    if (accion === 'rechazar_comprobante') {
      const nota = window.prompt('Motivo para rechazar el comprobante:');
      if (nota === null) return;
      notaAdmin = nota.trim() || 'No coincide la informacion reportada.';
    }

    if (accion === 'eliminar') {
      const confirmado = window.confirm(
        'Esto eliminará completamente la solicitud de prueba. No quedará historial de esta solicitud. ¿Continuar?'
      );
      if (!confirmado) return;
    }

    setProcesandoId(solicitudId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/solicitudes/${solicitudId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accion,
          motivoRechazo,
          notaAdmin,
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (!response.ok) {
        setError(data.error || 'No se pudo actualizar la solicitud.');
        return;
      }

      await cargarSolicitudes();
      void cargarCapital();
    } catch {
      setError('No se pudo actualizar la solicitud.');
    } finally {
      setProcesandoId(null);
    }
  }

  if (cargando) {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-8 pb-10 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 pt-8 pb-10 min-h-screen">
      <h1 className="font-display text-[28px] font-semibold leading-[1.15] -tracking-wide mb-2">
        Panel admin de solicitudes
      </h1>
      <p className="text-textDim text-[14.5px] leading-relaxed mb-6">
        Revisa solicitudes, adeudos y comprobantes manuales.
      </p>

      <ResumenFinancieroAdmin
        resumen={capitalResumen}
        cargando={cargandoCapital}
        error={capitalError}
      />

      {error && (
        <p className="text-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-4">
        {solicitudes.length === 0 && (
          <Card>
            <p className="text-[14.5px] text-textDim">No hay solicitudes registradas.</p>
          </Card>
        )}

        {solicitudes.map((solicitud) => (
          <Card key={solicitud.id}>
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[15px]">
                    {solicitud.usuario?.nombre || 'Usuario sin perfil'}
                  </p>
                  <p className="text-[13.5px] text-textDim break-words">
                    {solicitud.usuario?.telefono || 'Sin telefono'} ·{' '}
                    {solicitud.usuario?.correo || 'Sin correo'}
                  </p>
                </div>
                <span className={badgeClassName(solicitud.estado)}>
                  {formatEstado(solicitud.estado)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13.5px] text-textDim">
                <div>
                  Monto:{' '}
                  <strong className="text-text font-mono">
                    {formatCurrency(solicitud.monto)}
                  </strong>
                </div>
                <div>
                  Total a pagar:{' '}
                  <strong className="text-text font-mono">
                    {formatCurrency(solicitud.totalAPagar)}
                  </strong>
                </div>
                <div>
                  Creada: <strong className="text-text">{formatFecha(solicitud.creadoEn)}</strong>
                </div>
                <div>
                  UID:{' '}
                  <strong className="text-text font-mono text-xs" title={solicitud.userId}>
                    {formatUid(solicitud.userId)}
                  </strong>
                </div>
              </div>

              {solicitud.fechaLimite && (
                <p className="text-[13.5px] text-textDim">
                  Fecha limite de pago: {formatFecha(solicitud.fechaLimite)}
                </p>
              )}

              {solicitud.motivoRechazo && (
                <p className="text-[13.5px] text-danger">
                  Motivo rechazo: {solicitud.motivoRechazo}
                </p>
              )}

              {(solicitud.estado === 'aprobada' || solicitud.estado === 'vencida') && (
                <div className="card-dark-readable rounded-[16px] p-4">
                  <p className="text-[14.5px] font-semibold mb-2">Adeudo actual</p>
                  <p className="text-[13.5px] text-textDim leading-relaxed">
                    Monto recibido {formatCurrency(solicitud.monto)} · Comision{' '}
                    {formatCurrency(solicitud.comisionMonto)} · Total pendiente{' '}
                    {formatCurrency(solicitud.totalAPagar)}
                  </p>
                </div>
              )}

              <div className="card-dark-readable rounded-[16px] p-4">
                <p className="text-[14.5px] font-semibold mb-2">Historial del usuario</p>
                <p className="text-[13.5px] text-textDim">
                  {solicitud.historialUsuario.totalSolicitudes} solicitudes anteriores
                </p>
                <p className="text-[13.5px] text-textDim">
                  {solicitud.historialUsuario.pagadas} adelantos pagados
                </p>
                <p className="text-[13.5px] text-textDim">
                  {solicitud.historialUsuario.vencidas} vencidos
                </p>
                <p className="text-[13.5px] text-textDim">
                  {solicitud.historialUsuario.rechazadas} rechazados
                </p>
              </div>

              {solicitud.comprobante && solicitud.comprobante.estadoRevision !== 'sin_comprobante' && (
                <div
                  className={`rounded-[16px] border p-4 ${
                    solicitud.comprobante.estadoRevision === 'pendiente_revision'
                      ? 'border-amber/40 bg-amberDim/10'
                      : solicitud.comprobante.estadoRevision === 'rechazado'
                        ? 'border-danger/40 bg-danger/5'
                        : 'border-green/40 bg-greenDim/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[14.5px] font-semibold">Comprobante reportado</p>
                    <span className={badgeComprobanteClassName(solicitud.comprobante.estadoRevision)}>
                      {formatEstadoComprobante(solicitud.comprobante.estadoRevision)}
                    </span>
                  </div>
                  <div className="space-y-1 text-[13.5px] text-textDim">
                    <p>
                      Monto reportado:{' '}
                      <strong className="text-text font-mono">
                        {solicitud.comprobante.montoReportado
                          ? formatCurrency(solicitud.comprobante.montoReportado)
                          : 'Sin dato'}
                      </strong>
                    </p>
                    <p>
                      Metodo reportado:{' '}
                      <strong className="text-text">
                        {formatMetodo(solicitud.comprobante.metodoReportado)}
                      </strong>
                    </p>
                    <p>
                      Referencia:{' '}
                      <strong className="text-text">
                        {solicitud.comprobante.referencia || 'Sin referencia'}
                      </strong>
                    </p>
                    <p>
                      Nota usuario:{' '}
                      <strong className="text-text">
                        {solicitud.comprobante.notaUsuario || 'Sin nota'}
                      </strong>
                    </p>
                    <p>
                      Reportado en:{' '}
                      <strong className="text-text">
                        {solicitud.comprobante.reportadoEn
                          ? formatFecha(solicitud.comprobante.reportadoEn)
                          : 'Sin fecha'}
                      </strong>
                    </p>
                    {solicitud.comprobante.notaAdmin && (
                      <p>
                        Nota admin:{' '}
                        <strong className="text-text">{solicitud.comprobante.notaAdmin}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {solicitud.bitacoraAdmin && solicitud.bitacoraAdmin.length > 0 && (
                <div className="card-dark-readable rounded-[16px] p-4">
                  <p className="text-[14.5px] font-semibold mb-2">Bitacora admin</p>
                  <div className="space-y-2">
                    {solicitud.bitacoraAdmin.slice(0, 4).map((evento, index) => (
                      <div key={`${evento.tipo}-${evento.creadoEn}-${index}`} className="text-[13.5px] text-textDim">
                        <p>
                          <strong className="text-text">{formatEventoBitacora(evento.tipo)}</strong>{' '}
                          · {formatFecha(evento.creadoEn)}
                        </p>
                        <p>
                          Por <strong className="text-text">{evento.actorId}</strong>
                          {evento.nota ? ` · ${evento.nota}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {accionesPorEstado(solicitud).map((accion) => (
                  <button
                    key={accion.id}
                    type="button"
                    disabled={procesandoId === solicitud.id}
                    onClick={() => ejecutarAccion(solicitud.id, accion.id)}
                    className={`px-3 py-2 rounded-[12px] text-sm font-semibold border transition-colors disabled:opacity-70 disabled:saturate-50 ${accion.className}`}
                  >
                    {procesandoId === solicitud.id ? 'Procesando...' : accion.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ResumenFinancieroAdmin({
  resumen,
  cargando,
  error,
}: {
  resumen: AdminCapitalResumen | null;
  cargando: boolean;
  error: string | null;
}) {
  const metricas = resumen
    ? [
        { label: 'Capital operativo', value: resumen.capitalOperativoTotal },
        { label: 'Disponible para transferir', value: resumen.disponibleParaTransferir },
        { label: 'Bonos referidos pendientes', value: resumen.bonosReferidosPendientes },
        { label: 'Disponible real', value: resumen.disponibleRealDespuesDeBonos },
        { label: 'Capital prestado activo', value: resumen.capitalPrestadoActivo },
        { label: 'Total por recuperar', value: resumen.totalPorRecuperar },
        {
          label: 'Ganancia esperada',
          value: resumen.gananciaEsperada,
          helper:
            resumen.gananciaGenerada === null
              ? null
              : `Generada ${formatCurrency(resumen.gananciaGenerada)}`,
        },
      ]
    : [];
  const metricasPromociones = resumen
    ? [
        { label: 'Promociones activas', value: resumen.promocionesActivas, currency: false },
        {
          label: 'Presupuesto promocional',
          value: resumen.presupuestoPromocionalDisponible,
          currency: true,
        },
        { label: 'Activaciones pendientes', value: resumen.activacionesPendientes, currency: false },
      ]
    : [];

  return (
    <section className="mb-6">
      {cargando && (
        <div className="rounded-[14px] border border-border bg-surface px-4 py-3 text-[13.5px] text-textDim mb-3">
          Cargando resumen financiero...
        </div>
      )}

      {error && (
        <p className="text-amber text-sm mb-3" role="status">
          {error}
        </p>
      )}

      {resumen && !resumen.configurado && (
        <p className="text-amber text-sm mb-3" role="status">
          Capital no configurado. El resumen muestra $0 hasta inicializarlo.
        </p>
      )}

      {metricas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
          {metricas.map((metrica) => (
            <div
              key={metrica.label}
              className="min-w-0 rounded-[14px] border border-border bg-surface p-3"
            >
              <p className="text-[11px] leading-tight text-textDim">{metrica.label}</p>
              <p className="font-mono text-[18px] font-bold leading-tight text-text mt-1 break-words">
                {formatCurrency(metrica.value)}
              </p>
              {metrica.helper && (
                <p className="text-[11px] leading-tight text-textDim mt-1">{metrica.helper}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {resumen && resumen.bonosReferidosPendientes > 0 && (
        <div className="rounded-[14px] border border-amber/40 bg-amberDim/10 px-4 py-3 text-[13.5px] leading-relaxed text-amber mb-3">
          Hay {formatCurrency(resumen.bonosReferidosPendientes)} en bonos de referidos pendientes.
          Considera esto antes de aprobar nuevos adelantos.
        </div>
      )}

      {metricasPromociones.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
          {metricasPromociones.map((metrica) => (
            <div
              key={metrica.label}
              className="card-dark-readable min-w-0 rounded-[14px] p-3"
            >
              <p className="text-[11px] leading-tight text-textDim">{metrica.label}</p>
              <p className="font-mono text-[16px] font-bold leading-tight text-text mt-1">
                {metrica.currency ? formatCurrency(metrica.value) : metrica.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Link
          href="/admin/referidos"
          className="card-dark-readable inline-flex w-full items-center justify-center rounded-[14px] px-4 py-3 text-center text-sm font-semibold text-on-dark transition-colors active:scale-[0.99]"
        >
          Ver y pagar bonos de referidos
        </Link>
        <Link
          href="/admin/promociones"
          className="inline-flex w-full items-center justify-center rounded-[14px] border border-amber/40 bg-amberDim/10 px-4 py-3 text-center text-sm font-semibold text-amber transition-colors active:scale-[0.99]"
        >
          Promociones y activaciones
        </Link>
      </div>
    </section>
  );
}

function accionesPorEstado(solicitud: SolicitudAdminItem) {
  const acciones: Array<{ id: AdminAction; label: string; className: string }> = [];
  const revision = solicitud.comprobante?.estadoRevision || 'sin_comprobante';
  const eliminarAction: { id: AdminAction; label: string; className: string } = {
    id: 'eliminar',
    label: 'Eliminar',
    className: 'border-danger/50 bg-danger/10 text-danger',
  };

  switch (solicitud.estado) {
    case 'pendiente':
      acciones.push(
        { id: 'aprobar', label: 'Aprobar', className: 'border-green/50 bg-greenDim/30 text-green' },
        { id: 'rechazar', label: 'Rechazar', className: 'border-danger/50 bg-danger/10 text-danger' },
        eliminarAction
      );
      break;
    case 'aprobada':
      if (revision === 'pendiente_revision') {
        acciones.push(
          {
            id: 'validar_pago_reportado',
            label: 'Validar pago',
            className: 'border-green/50 bg-greenDim/30 text-green',
          },
          {
            id: 'rechazar_comprobante',
            label: 'Rechazar comprobante',
            className: 'border-danger/50 bg-danger/10 text-danger',
          },
          eliminarAction
        );
      } else {
        acciones.push(
          { id: 'marcar_pagada', label: 'Marcar pagada', className: 'border-green/50 bg-greenDim/30 text-green' },
          { id: 'marcar_vencida', label: 'Marcar vencida', className: 'border-danger/50 bg-danger/10 text-danger' },
          eliminarAction
        );
      }
      break;
    case 'vencida':
      if (revision === 'pendiente_revision') {
        acciones.push(
          {
            id: 'validar_pago_reportado',
            label: 'Validar pago',
            className: 'border-green/50 bg-greenDim/30 text-green',
          },
          {
            id: 'rechazar_comprobante',
            label: 'Rechazar comprobante',
            className: 'border-danger/50 bg-danger/10 text-danger',
          },
          eliminarAction
        );
      } else {
        acciones.push(
          { id: 'marcar_pagada', label: 'Marcar pagada', className: 'border-green/50 bg-greenDim/30 text-green' },
          eliminarAction
        );
      }
      break;
    case 'rechazada':
    case 'cancelada':
      acciones.push(eliminarAction);
      break;
    default:
      break;
  }

  return acciones as Array<{ id: AdminAction; label: string; className: string }>;
}

function formatEstado(estado: EstadoSolicitudAdelanto) {
  const mapa: Record<EstadoSolicitudAdelanto, string> = {
    pendiente: 'Pendiente',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada',
    pagada: 'Pagada',
    vencida: 'Vencida',
  };

  return mapa[estado];
}

function formatEstadoComprobante(
  estado:
    | NonNullable<SolicitudAdminItem['comprobante']>['estadoRevision']
) {
  const mapa = {
    sin_comprobante: 'Sin comprobante',
    pendiente_revision: 'Pendiente de revision',
    validado: 'Validado',
    rechazado: 'Rechazado',
  };

  return mapa[estado];
}

function formatMetodo(
  value: NonNullable<SolicitudAdminItem['comprobante']>['metodoReportado']
) {
  if (value === 'transferencia') return 'Transferencia';
  if (value === 'efectivo') return 'Efectivo';
  if (value === 'otro') return 'Otro';
  return 'Sin dato';
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUid(uid: string) {
  if (uid.length <= 14) {
    return uid;
  }

  return `${uid.slice(0, 8)}...${uid.slice(-4)}`;
}

function formatFecha(valor: number) {
  return new Date(valor).toLocaleString('es-MX');
}

function badgeClassName(estado: EstadoSolicitudAdelanto) {
  const mapa: Record<EstadoSolicitudAdelanto, string> = {
    pendiente: 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-amberDim text-amber',
    aprobada: 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-greenDim text-green',
    rechazada: 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-danger/10 text-danger',
    cancelada: 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-surface2 text-textDim',
    pagada: 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-greenDim text-green',
    vencida: 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-danger/10 text-danger',
  };

  return mapa[estado];
}

function badgeComprobanteClassName(
  estado: NonNullable<SolicitudAdminItem['comprobante']>['estadoRevision']
) {
  const mapa = {
    sin_comprobante: 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-surface2 text-textDim',
    pendiente_revision:
      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-amberDim text-amber',
    validado: 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-greenDim text-green',
    rechazado: 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-danger/10 text-danger',
  };

  return mapa[estado];
}

function formatEventoBitacora(tipo: NonNullable<SolicitudAdminItem['bitacoraAdmin']>[number]['tipo']) {
  const mapa = {
    solicitud_aprobada: 'Solicitud aprobada',
    solicitud_rechazada: 'Solicitud rechazada',
    solicitud_cancelada: 'Solicitud cancelada',
    solicitud_vencida: 'Solicitud vencida',
    pago_marcado_manual: 'Pago marcado manualmente',
    pago_reportado_usuario: 'Pago reportado por usuario',
    pago_reportado_admin: 'Pago reportado por admin',
    comprobante_validado: 'Comprobante validado',
    comprobante_rechazado: 'Comprobante rechazado',
  };

  return mapa[tipo];
}
