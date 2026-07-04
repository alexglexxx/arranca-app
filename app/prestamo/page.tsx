'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { fetchEstadoUsuario, getBearerHeaders } from '@/lib/auth-client';
import { auth } from '@/lib/firebase';
import { DevResetSolicitudButton } from '@/components/DevResetSolicitudButton';
import { BrandHeader, Button, Card, CardRow, Pill, UploadBox } from '@/components/ui';
import Gauge from '@/components/Gauge';
import { Prestamo } from '@/types';
import { subirArchivo } from '@/lib/storage';

const INTERVALO_POLLING_MS = 8000;

function PrestamoContent() {
  const router = useRouter();
  const params = useSearchParams();
  const prestamoId = params.get('prestamoId') || '';

  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [authCargada, setAuthCargada] = useState(false);
  const [usuarioIdAutenticado, setUsuarioIdAutenticado] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputComprobanteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setUsuarioIdAutenticado(user?.uid || null);
      setAuthCargada(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!usuario || prestamoId) return;

    let activo = true;

    async function resolverRuta() {
      try {
        const estado = await fetchEstadoUsuario(usuario);
        if (!activo) return;

        if (estado.nextRoute !== '/prestamo') {
          router.replace(estado.nextRoute);
        }
      } catch {
        if (!activo) return;
        setError('No se pudo consultar el estado de tu préstamo.');
      }
    }

    resolverRuta();

    return () => {
      activo = false;
    };
  }, [prestamoId, router, usuario]);

  useEffect(() => {
    if (!prestamoId || !usuario) return;

    async function cargar() {
      try {
        const res = await fetch(`/api/prestamos/${prestamoId}`, {
          headers: await getBearerHeaders(usuario),
        });
        if (res.ok) {
          setPrestamo(await res.json());
        }
      } catch {
        // Silencioso
      }
    }

    cargar();
    const interval = setInterval(cargar, INTERVALO_POLLING_MS);
    return () => clearInterval(interval);
  }, [prestamoId, usuario]);

  async function handleSubirComprobante() {
    if (!comprobante || !prestamo) return;

    if (!usuarioIdAutenticado || usuarioIdAutenticado !== prestamo.usuarioId) {
      setError('Tu sesión expiró. Vuelve a entrar con tu número de teléfono para subir el comprobante.');
      return;
    }

    setSubiendoComprobante(true);
    setError(null);

    try {
      const comprobantePagoUrl = await subirArchivo(
        comprobante,
        'comprobantes-pago',
        usuarioIdAutenticado
      );

      const res = await fetch('/api/prestamos/pagar', {
        method: 'POST',
        headers: await getBearerHeaders(usuario, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          accion: 'subir_comprobante',
          prestamoId,
          comprobantePagoUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'No se pudo subir el comprobante.');
        return;
      }

      const actualizado = await fetch(`/api/prestamos/${prestamoId}`, {
        headers: await getBearerHeaders(usuario),
      });
      setPrestamo(await actualizado.json());
    } catch {
      setError('No se pudo subir tu comprobante. Intenta de nuevo.');
    } finally {
      setSubiendoComprobante(false);
    }
  }

  if (!prestamo) {
    if (authCargada && !usuario) {
      return (
        <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex flex-col items-center justify-center text-center">
          <p className="text-textDim text-[14.5px] leading-relaxed mb-4">
            Para ver el estado de tu préstamo, vuelve a entrar con tu número de teléfono.
          </p>
          <Button onClick={() => router.push('/ingresar')}>Entrar de nuevo</Button>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto px-6 pt-8 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  if (prestamo.estado === 'pendiente_revision') {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex flex-col items-center justify-center text-center">
        <Gauge estado="revisando" montoCentral="Revisando" />
        <h1 className="font-display text-[22px] font-semibold mt-4 mb-2">
          Estamos viendo
          <br />
          tu solicitud
        </h1>
        <p className="text-textDim text-[14.5px] leading-relaxed">
          Normalmente tardamos menos de 15 minutos. Te avisamos por WhatsApp.
        </p>
        <DevResetSolicitudButton />
      </div>
    );
  }

  if (prestamo.estado === 'rechazado') {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex flex-col items-center justify-center text-center">
        <h1 className="font-display text-[22px] font-semibold mb-2">No pudimos aprobar tu solicitud</h1>
        <p className="text-textDim text-[14.5px] leading-relaxed">
          {prestamo.notasAdmin || 'Si crees que esto es un error, contáctanos por WhatsApp.'}
        </p>
        <DevResetSolicitudButton />
      </div>
    );
  }

  if (prestamo.estado === 'pagado') {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex flex-col items-center justify-center text-center">
        <Gauge estado="pagado" montoCentral="Pagado" />
        <h1 className="font-display text-[22px] font-semibold mt-4 mb-2">
          Listo,
          <br />
          quedaste al día
        </h1>
        <p className="text-textDim text-[14.5px] leading-relaxed mb-6">
          Confirmamos tu pago de ${prestamo.montoFinalPagado}. Gracias por pagar a tiempo.
        </p>
        <Button variant="ghost" onClick={() => router.push('/referidos')}>
          Invita y gana $50 por cada chofer
        </Button>
        <DevResetSolicitudButton />
      </div>
    );
  }

  const esMora = prestamo.estado === 'mora';
  const yaVencido = prestamo.fechaLimite ? Date.now() > prestamo.fechaLimite : false;
  const fechaLimiteTexto = prestamo.fechaLimite
    ? new Date(prestamo.fechaLimite).toLocaleDateString('es-MX', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '—';

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <BrandHeader />
        <Pill estado={esMora ? 'mora' : 'activo'} />
      </div>

      <Gauge
        estado="activo"
        montoCentral={`$${yaVencido ? prestamo.montoSiPagaVencido : prestamo.montoSiPagaHoy}`}
        etiqueta={yaVencido ? 'vencido' : 'si pagas hoy'}
      />

      <Card>
        <CardRow label="Prestado" value={`$${prestamo.monto}`} valueClassName="font-mono" />
        <CardRow label="Fecha límite" value={fechaLimiteTexto} />
        {!yaVencido && (
          <CardRow
            label="Si pagas después de hoy"
            value={`$${prestamo.montoSiPagaFechaLimite}`}
            valueClassName="font-mono"
          />
        )}
        {yaVencido && (
          <CardRow
            label="Ya pasó la fecha límite"
            value={`$${prestamo.montoSiPagaVencido}`}
            valueClassName="font-mono text-danger"
          />
        )}
      </Card>

      {prestamo.comprobantePagoUrl ? (
        <Card className="text-center">
          <p className="text-[14.5px] text-textDim">
            Ya recibimos tu comprobante. Estamos confirmando el pago.
          </p>
        </Card>
      ) : (
        <>
          {usuarioIdAutenticado !== prestamo.usuarioId && (
            <Card className="bg-transparent border-amber/30">
              <p className="text-[14px] text-amber leading-relaxed mb-3">
                Para subir tu comprobante, primero confirma que sigues siendo tú.
              </p>
              <Button variant="ghost" onClick={() => router.push('/registro')}>
                Volver a entrar con mi número
              </Button>
            </Card>
          )}

          <input
            ref={inputComprobanteRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setComprobante(e.target.files?.[0] || null)}
          />
          {!comprobante && usuarioIdAutenticado === prestamo.usuarioId && (
            <div className="mt-auto pt-2">
              <Button onClick={() => inputComprobanteRef.current?.click()}>
                Ya pagué — subir comprobante
              </Button>
            </div>
          )}
          {comprobante && (
            <>
              <UploadBox
                titulo="Comprobante listo"
                descripcion={comprobante.name}
                completado
                onClick={() => inputComprobanteRef.current?.click()}
              />
              {error && <p className="text-danger text-sm mb-4">{error}</p>}
              <div className="mt-auto pt-2">
                <Button onClick={handleSubirComprobante} disabled={subiendoComprobante}>
                  {subiendoComprobante ? 'Enviando...' : 'Enviar comprobante'}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      <DevResetSolicitudButton />
    </div>
  );
}

export default function PrestamoPage() {
  return (
    <Suspense fallback={null}>
      <PrestamoContent />
    </Suspense>
  );
}
