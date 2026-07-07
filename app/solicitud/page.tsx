'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { fetchEstadoUsuario, getBearerHeaders } from '@/lib/auth-client';
import { DevResetSolicitudButton } from '@/components/DevResetSolicitudButton';
import { Button, Card, CardRow, Field } from '@/components/ui';
import { obtenerResumenImpulsoBase } from '@/types';
import type {
  EstadoSolicitudAdelanto,
  HistorialSolicitudResumen,
  MetodoPagoManual,
  SolicitudAdelanto,
} from '@/types';

type SolicitudActualResponse = {
  ok: boolean;
  tieneSolicitud: boolean;
  solicitud: SolicitudAdelanto | null;
  puedeSolicitar: boolean;
};

type HistorialResponse = {
  ok: boolean;
  historial: HistorialSolicitudResumen[];
};

type FormState = {
  montoReportado: string;
  metodoReportado: MetodoPagoManual;
  referencia: string;
  notaUsuario: string;
};

const RESUMEN_IMPULSO = obtenerResumenImpulsoBase();

const INITIAL_FORM: FormState = {
  montoReportado: String(RESUMEN_IMPULSO.totalAPagar),
  metodoReportado: 'transferencia',
  referencia: '',
  notaUsuario: '',
};

export default function SolicitudPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<User | null>(null);
  const [solicitud, setSolicitud] = useState<SolicitudAdelanto | null>(null);
  const [historial, setHistorial] = useState<HistorialSolicitudResumen[]>([]);
  const [puedeSolicitar, setPuedeSolicitar] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [enviandoComprobante, setEnviandoComprobante] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  useEffect(() => {
    let activo = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!activo) return;

      if (!user) {
        router.replace('/registro');
        return;
      }

      setUsuario(user);

      try {
        const estado = await fetchEstadoUsuario(user);
        if (!activo) return;

        if (estado.nextRoute !== '/solicitud') {
          router.replace(estado.nextRoute);
          return;
        }

        await cargarDatos(user);
      } catch {
        if (!activo) return;
        setError('No se pudo cargar tu estado actual.');
        setCargando(false);
      }
    });

    return () => {
      activo = false;
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!solicitud) return;

    setForm((prev) => ({
      ...prev,
      montoReportado:
        prev.montoReportado === INITIAL_FORM.montoReportado
          ? String(solicitud.totalAPagar || 210)
          : prev.montoReportado,
    }));
  }, [solicitud]);

  async function cargarDatos(user: User) {
    const [actualResponse, historialResponse] = await Promise.all([
      fetch('/api/solicitudes/actual', {
        headers: await getBearerHeaders(user),
        cache: 'no-store',
      }),
      fetch('/api/solicitudes/historial', {
        headers: await getBearerHeaders(user),
        cache: 'no-store',
      }),
    ]);

    const actualData = (await actualResponse.json()) as SolicitudActualResponse;
    const historialData = (await historialResponse.json()) as HistorialResponse;

    if (!actualResponse.ok) {
      throw new Error('No se pudo cargar la solicitud.');
    }

    if (!historialResponse.ok) {
      throw new Error('No se pudo cargar el historial.');
    }

    setSolicitud(actualData.solicitud);
    setPuedeSolicitar(actualData.puedeSolicitar);
    setHistorial(historialData.historial || []);
    setError(null);
    setCargando(false);
  }

  async function handleCrearSolicitud() {
    if (!usuario) return;

    setCreando(true);
    setError(null);
    setMensaje(null);

    try {
      const response = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: await getBearerHeaders(usuario),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'No se pudo crear la solicitud.');
        return;
      }

      setSolicitud(data.solicitud);
      setPuedeSolicitar(false);
      setMensaje('Tu solicitud fue creada. Ahora la vamos a revisar manualmente.');
      await cargarDatos(usuario);
    } catch {
      setError('No se pudo crear la solicitud.');
    } finally {
      setCreando(false);
    }
  }

  async function handleReportarPago(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!usuario || !solicitud) return;

    setEnviandoComprobante(true);
    setError(null);
    setMensaje(null);

    try {
      const response = await fetch(`/api/solicitudes/${solicitud.id}/reportar-pago`, {
        method: 'POST',
        headers: await getBearerHeaders(usuario, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          montoReportado: Number(form.montoReportado),
          metodoReportado: form.metodoReportado,
          referencia: form.referencia,
          notaUsuario: form.notaUsuario,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'No se pudo enviar el comprobante.');
        return;
      }

      setMensaje(data.message || 'Comprobante enviado para revision.');
      setForm((prev) => ({ ...prev, referencia: '', notaUsuario: '' }));
      await cargarDatos(usuario);
    } catch {
      setError('No se pudo enviar el comprobante.');
    } finally {
      setEnviandoComprobante(false);
    }
  }

  if (cargando) {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  const estado = solicitud?.estado || null;

  return (
    <div className="max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+5rem)] pb-10 min-h-screen flex flex-col">

      <h1 className="font-display text-[28px] font-semibold leading-[1.15] -tracking-wide mb-2 text-on-dark text-soft-outline">
        Impulso para gasolina
      </h1>
      <p className="text-on-dark-muted text-[14.5px] leading-relaxed mb-6">
        Solicita {formatCurrency(RESUMEN_IMPULSO.monto)} hoy. Si se aprueba, depositando el mismo dia liquidaras{' '}
        {formatCurrency(RESUMEN_IMPULSO.totalAPagar)}.
      </p>

      <Card>
        <ResumenCobrosRows
          monto={RESUMEN_IMPULSO.monto}
          comisionMonto={RESUMEN_IMPULSO.comisionMonto}
          ivaMonto={RESUMEN_IMPULSO.ivaMonto}
          totalAPagar={RESUMEN_IMPULSO.totalAPagar}
        />
      </Card>

      {renderEstadoCard(estado, solicitud)}

      {solicitud && (estado === 'aprobada' || estado === 'vencida') && (
        <>
          <AdeudoCard solicitud={solicitud} />
          <InstruccionesPagoCard solicitud={solicitud} />
          <EstadoComprobanteCard solicitud={solicitud} />
          {puedeMostrarFormularioComprobante(solicitud) && (
            <Card>
              <p className="text-[15px] font-semibold mb-2">Reportar pago</p>
              <p className="text-[14.5px] text-textDim leading-relaxed mb-4">
                Despues de pagar, registra tu comprobante para que podamos validar tu pago.
              </p>

              <form onSubmit={handleReportarPago}>
                <Field
                  label="Monto pagado"
                  inputMode="decimal"
                  value={form.montoReportado}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, montoReportado: event.target.value }))
                  }
                />

                <div className="mb-4">
                  <label className="label-readable block text-[14.5px] mb-2 font-semibold">
                    Metodo de pago
                  </label>
                  <select
                    className="input-readable w-full rounded-[16px] px-4 py-[16px] text-base outline-none transition-colors"
                    value={form.metodoReportado}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        metodoReportado: event.target.value as MetodoPagoManual,
                      }))
                    }
                  >
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <Field
                  label="Referencia / folio / ultimos digitos"
                  value={form.referencia}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, referencia: event.target.value }))
                  }
                />

                <div className="mb-4">
                  <label className="label-readable block text-[14.5px] mb-2 font-semibold">
                    Nota opcional
                  </label>
                  <textarea
                    className="input-readable w-full min-h-[112px] rounded-[16px] px-4 py-[16px] text-base outline-none transition-colors"
                    value={form.notaUsuario}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, notaUsuario: event.target.value }))
                    }
                  />
                </div>

                <Button type="submit" disabled={enviandoComprobante}>
                  {enviandoComprobante ? 'Enviando comprobante...' : 'Enviar comprobante'}
                </Button>
              </form>
            </Card>
          )}
        </>
      )}

      {mensaje && (
        <Card className="border-green/30">
          <p className="text-sm text-green">{mensaje}</p>
        </Card>
      )}

      {error && (
        <p className="text-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <HistorialCard historial={historial} />

      <div className="mt-auto pt-2">
        {puedeSolicitar ? (
          <Button onClick={handleCrearSolicitud} disabled={creando}>
            {creando ? 'Creando solicitud...' : 'Solicitar impulso'}
          </Button>
        ) : (
          <Button disabled>
            {labelAccionBloqueada(estado, solicitud)}
          </Button>
        )}
        <DevResetSolicitudButton />
      </div>
    </div>
  );
}

function ResumenCobrosRows({
  monto,
  comisionMonto,
  ivaMonto = 0,
  totalAPagar,
}: {
  monto: number;
  comisionMonto: number;
  ivaMonto?: number;
  totalAPagar: number;
}) {
  return (
    <>
      <CardRow label="Monto recibido" value={formatCurrency(monto)} valueClassName="font-mono text-amber" />
      <CardRow label="Comision" value={formatCurrency(comisionMonto)} valueClassName="font-mono" />
      {ivaMonto > 0 && (
        <CardRow label="IVA" value={formatCurrency(ivaMonto)} valueClassName="font-mono" />
      )}
      <CardRow label="Total a pagar" value={formatCurrency(totalAPagar)} valueClassName="font-mono" />
    </>
  );
}

function AdeudoCard({ solicitud }: { solicitud: SolicitudAdelanto }) {
  return (
    <Card className={solicitud.estado === 'vencida' ? 'border-danger/30' : ''}>
      <p className="text-[15px] font-semibold mb-3">Tu impulso para gasolina</p>
      <ResumenCobrosRows
        monto={solicitud.monto}
        comisionMonto={solicitud.comisionMonto}
        totalAPagar={solicitud.totalAPagar}
      />
      <CardRow
        label="Estado"
        value={solicitud.estado === 'vencida' ? 'Pendiente de pago vencido' : 'Pendiente de pago'}
      />
      {solicitud.fechaLimite && (
        <p className="text-xs text-textDim mt-3">
          Fecha limite: {formatFecha(solicitud.fechaLimite)}
        </p>
      )}
    </Card>
  );
}

function InstruccionesPagoCard({ solicitud }: { solicitud: SolicitudAdelanto }) {
  const instrucciones = solicitud.instruccionesPago || {};

  return (
    <Card>
      <p className="text-[15px] font-semibold mb-3">Instrucciones de pago</p>
      <CardRow label="Banco" value={instrucciones.banco || 'BANCO_PENDIENTE'} />
      <CardRow label="Titular" value={instrucciones.titular || 'TITULAR_PENDIENTE'} />
      <CardRow label="Cuenta" value={instrucciones.cuenta || 'CUENTA_PENDIENTE'} />
      <CardRow label="CLABE" value={instrucciones.clabe || 'CLABE_PENDIENTE'} />
      {instrucciones.referencia && (
        <CardRow label="Referencia" value={instrucciones.referencia} />
      )}
      <p className="text-[14.5px] text-textDim leading-relaxed mt-3">
        {instrucciones.nota ||
          'Cuando realices tu pago, envia la referencia para validar tu impulso.'}
      </p>
    </Card>
  );
}

function EstadoComprobanteCard({ solicitud }: { solicitud: SolicitudAdelanto }) {
  const comprobante = solicitud.comprobante;

  if (!comprobante) {
    return null;
  }

  if (comprobante.estadoRevision === 'pendiente_revision') {
    return (
      <Card className="border-amber/30">
        <p className="text-[15px] font-semibold mb-2">Tu comprobante esta en revision.</p>
        <p className="text-[14.5px] text-textDim leading-relaxed">
          Cuando validemos tu pago, podras solicitar otro impulso para gasolina.
        </p>
      </Card>
    );
  }

  if (comprobante.estadoRevision === 'rechazado') {
    return (
      <Card className="border-danger/30">
        <p className="text-[15px] font-semibold mb-2 text-danger">Tu comprobante fue rechazado.</p>
        <p className="text-[14.5px] text-textDim leading-relaxed">
          Revisa la informacion e intenta reportar el pago nuevamente.
        </p>
        {comprobante.notaAdmin && (
          <p className="text-[13.5px] text-danger mt-3">Nota: {comprobante.notaAdmin}</p>
        )}
      </Card>
    );
  }

  if (comprobante.estadoRevision === 'validado' || solicitud.estado === 'pagada') {
    return (
      <Card className="border-green/30">
        <p className="text-[15px] font-semibold mb-2 text-green">Pago validado.</p>
        <p className="text-[14.5px] text-textDim leading-relaxed">
          Ya puedes solicitar otro impulso para gasolina.
        </p>
      </Card>
    );
  }

  return null;
}

function HistorialCard({ historial }: { historial: HistorialSolicitudResumen[] }) {
  return (
    <Card>
      <p className="text-[15px] font-semibold mb-3">Historial</p>
      {historial.length === 0 ? (
        <p className="text-[14.5px] text-textDim leading-relaxed">
          Aun no tienes solicitudes registradas.
        </p>
      ) : (
        <div className="space-y-3">
          {historial.map((item) => (
            <div key={item.id} className="border-t border-border first:border-t-0 pt-3 first:pt-0">
              <p className="text-[14.5px] leading-relaxed">
                {formatFechaCorta(item.fecha)} - {formatCurrency(item.monto)} -{' '}
                {formatEstado(item.estado)}
                {item.estado === 'pagada' ? ` - Total ${formatCurrency(item.totalAPagar)}` : ''}
              </p>
              {item.pagadoEn && (
                <p className="text-xs text-textDim">Pagado: {formatFecha(item.pagadoEn)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function renderEstadoCard(
  estado: EstadoSolicitudAdelanto | null,
  solicitud: SolicitudAdelanto | null
) {
  if (!estado || !solicitud) {
    return (
      <Card>
        <p className="text-[15px] font-semibold mb-2">Sin solicitud activa</p>
        <p className="text-[14.5px] text-textDim leading-relaxed">
          Puedes crear una nueva solicitud de impulso cuando quieras.
        </p>
      </Card>
    );
  }

  const creadoEnTexto = formatFecha(solicitud.creadoEn);

  switch (estado) {
    case 'pendiente':
      return (
        <Card>
          <p className="text-[15px] font-semibold mb-2">Tu solicitud esta en revision.</p>
          <p className="text-[14.5px] text-textDim leading-relaxed mb-3">
            Estamos revisando tu impulso para gasolina.
          </p>
          <p className="text-xs text-textDim">Creada: {creadoEnTexto}</p>
        </Card>
      );
    case 'aprobada':
      return (
        <Card className="border-green/30">
          <p className="text-[15px] font-semibold mb-2">Tu impulso fue aprobado.</p>
          <p className="text-[14.5px] text-textDim leading-relaxed">
            Tienes un pago pendiente. Revisa el total, las instrucciones y reporta tu comprobante.
          </p>
        </Card>
      );
    case 'pagada':
      return (
        <Card className="border-green/30">
          <p className="text-[15px] font-semibold mb-2 text-green">Tu pago fue validado.</p>
          <p className="text-[14.5px] text-textDim leading-relaxed">
            Ya puedes solicitar otro impulso para gasolina.
          </p>
        </Card>
      );
    case 'rechazada':
      return (
        <Card>
          <p className="text-[15px] font-semibold mb-2">Tu solicitud fue rechazada.</p>
          <p className="text-[14.5px] text-textDim leading-relaxed">
            {solicitud.motivoRechazo || 'Puedes volver a solicitar cuando quieras.'}
          </p>
        </Card>
      );
    case 'cancelada':
      return (
        <Card>
          <p className="text-[15px] font-semibold mb-2">Tu solicitud fue cancelada.</p>
          <p className="text-[14.5px] text-textDim leading-relaxed">
            Puedes crear una nueva solicitud.
          </p>
        </Card>
      );
    case 'vencida':
      return (
        <Card className="border-danger/30">
          <p className="text-[15px] font-semibold mb-2 text-danger">Tu impulso esta vencido.</p>
          <p className="text-[14.5px] text-textDim leading-relaxed">
            Tienes un pago pendiente. Liquida tu adeudo y reporta tu comprobante para revisarlo.
          </p>
        </Card>
      );
    default:
      return null;
  }
}

function puedeMostrarFormularioComprobante(solicitud: SolicitudAdelanto) {
  const revision = solicitud.comprobante?.estadoRevision || 'sin_comprobante';
  return revision === 'sin_comprobante' || revision === 'rechazado';
}

function labelAccionBloqueada(
  estado: EstadoSolicitudAdelanto | null,
  solicitud: SolicitudAdelanto | null
) {
  if (solicitud?.comprobante?.estadoRevision === 'pendiente_revision') {
    return 'Comprobante en revision';
  }

  switch (estado) {
    case 'pendiente':
      return 'Solicitud en revision';
    case 'aprobada':
      return 'Pago pendiente';
    case 'vencida':
      return 'Pago vencido pendiente';
    default:
      return 'Solicitar impulso';
  }
}

function formatEstado(estado: EstadoSolicitudAdelanto) {
  const mapa: Record<EstadoSolicitudAdelanto, string> = {
    pendiente: 'En revision',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada',
    pagada: 'Pagada',
    vencida: 'Vencida',
  };

  return mapa[estado];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatFecha(value: number) {
  return new Date(value).toLocaleString('es-MX');
}

function formatFechaCorta(value: number) {
  return new Date(value).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
