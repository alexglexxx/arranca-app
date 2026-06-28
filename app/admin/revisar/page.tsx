'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import { Prestamo, Usuario, ChecklistRevision } from '@/types';

const CHECKLIST_ITEMS: { key: keyof ChecklistRevision; titulo: string; descripcion: string }[] = [
  {
    key: 'ineCoincide',
    titulo: 'INE coincide con selfie',
    descripcion: 'La cara de la selfie es la misma persona del INE',
  },
  {
    key: 'cuentaCoincide',
    titulo: 'Cuenta bancaria coincide',
    descripcion: 'Mismo titular que el INE',
  },
  {
    key: 'appConectada',
    titulo: 'App conectada, sin bloqueos',
    descripcion: 'Estatus en línea, sin banners de restricción',
  },
  {
    key: 'vehiculoVerificado',
    titulo: 'Vehículo verificado',
    descripcion: 'Tarjeta de circulación legible, placas visibles',
  },
  {
    key: 'sinDuplicados',
    titulo: 'Sin registros duplicados',
    descripcion: 'Teléfono, cuenta e INE únicos (verificado automáticamente)',
  },
];

function formatearTiempoTrabajando(valor: string): string {
  const mapa: Record<string, string> = {
    menos_6_meses: 'Menos de 6 meses',
    '6_meses_2_anos': '6 meses a 2 años',
    mas_2_anos: 'Más de 2 años',
  };
  return mapa[valor] || valor;
}

function formatearIngreso(valor: string): string {
  const mapa: Record<string, string> = {
    menos_1500: 'Menos de $1,500',
    '1500_3000': '$1,500 - $3,000',
    '3000_5000': '$3,000 - $5,000',
    mas_5000: 'Más de $5,000',
  };
  return mapa[valor] || valor;
}

function RevisarForm() {
  const router = useRouter();
  const params = useSearchParams();
  const prestamoId = params.get('prestamoId') || '';

  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [checklist, setChecklist] = useState<ChecklistRevision>({
    ineCoincide: false,
    cuentaCoincide: false,
    appConectada: false,
    vehiculoVerificado: false,
    sinDuplicados: true,
  });
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const res = await fetch(`/api/prestamos/${prestamoId}`);
      if (res.ok) {
        const data = await res.json();
        setPrestamo(data);

        const resUsuario = await fetch(`/api/admin/usuarios/${data.usuarioId}`);
        if (resUsuario.ok) {
          setUsuario(await resUsuario.json());
        }
      }
    }
    if (prestamoId) cargar();
  }, [prestamoId]);

  function toggleItem(key: keyof ChecklistRevision) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleAprobar() {
    setError(null);
    setProcesando(true);

    try {
      const res = await fetch('/api/prestamos/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestamoId, checklistCompleto: checklist, revisadoPor: 'admin' }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo aprobar.');
        return;
      }

      router.push('/admin');
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  }

  async function handleRechazar() {
    const motivo = window.prompt('Motivo del rechazo (se le mostrará al usuario):');
    if (motivo === null) return;

    setError(null);
    setProcesando(true);

    try {
      const res = await fetch('/api/prestamos/rechazar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestamoId, motivoRechazo: motivo, revisadoPor: 'admin' }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'No se pudo rechazar.');
        return;
      }

      router.push('/admin');
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  }

  if (!prestamo || !usuario) {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  const todosMarcados = Object.values(checklist).every(Boolean);

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex flex-col">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-[46px] h-[46px] rounded-[10px] bg-surface2 flex items-center justify-center font-display font-semibold text-base text-amber flex-shrink-0">
          {usuario.nombre.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
        </div>
        <div>
          <div className="font-semibold text-base">{usuario.nombre}</div>
          <div className="text-[12.5px] text-textDim">
            Solicita ${prestamo.monto} ·{' '}
            {usuario.prestamosCompletados > 0 ? `${usuario.prestamosCompletados + 1}º préstamo` : 'primera vez'}
          </div>
        </div>
      </div>

      {prestamo.videoPerfilUrl && (
        <a
          href={prestamo.videoPerfilUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-video bg-surface2 rounded-card mb-3.5 flex items-center justify-center text-xs text-textDim"
        >
          ▶ Ver video · perfil de chofer
        </a>
      )}

      {usuario.selfieIneUrl && (
        <a
          href={usuario.selfieIneUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs text-amber mb-2 underline"
        >
          Ver selfie con INE
        </a>
      )}

      {usuario.tarjetaCirculacionUrl && (
        <a
          href={usuario.tarjetaCirculacionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs text-amber mb-3.5 underline"
        >
          Ver tarjeta de circulación
        </a>
      )}

      {prestamo.notasAdmin && (
        <div className="bg-[#33201D] border border-danger/30 rounded-card p-3.5 mb-3.5">
          <p className="text-[12.5px] text-danger leading-relaxed">{prestamo.notasAdmin}</p>
        </div>
      )}

      {prestamo.cuestionario && (
        <Card>
          <div className="text-[12.5px] leading-relaxed space-y-1.5">
            <p>
              <span className="text-textDim">Plataformas:</span>{' '}
              <strong>{prestamo.cuestionario.plataformas.join(', ')}</strong>
            </p>
            <p>
              <span className="text-textDim">Tiempo trabajando:</span>{' '}
              <strong>{formatearTiempoTrabajando(prestamo.cuestionario.tiempoTrabajando)}</strong>
            </p>
            <p>
              <span className="text-textDim">Turno / días por semana:</span>{' '}
              <strong>
                {prestamo.cuestionario.turnoPrincipal} · {prestamo.cuestionario.diasPorSemana} días
              </strong>
            </p>
            <p>
              <span className="text-textDim">Ingreso semanal:</span>{' '}
              <strong>{formatearIngreso(prestamo.cuestionario.ingresoSemanalRango)}</strong>
            </p>
            <p>
              <span className="text-textDim">Zona:</span>{' '}
              <strong>
                {prestamo.cuestionario.zona}, {prestamo.cuestionario.ciudad}
              </strong>
            </p>
          </div>
        </Card>
      )}

      {prestamo.cuestionario && (
        <Card>
          <p className="text-[11px] font-bold text-textDim uppercase tracking-wider mb-2">
            Referencias
          </p>
          <div className="text-[12.5px] leading-relaxed space-y-2">
            <div>
              <span className="text-textDim">Familiar ({prestamo.cuestionario.referenciaFamiliar.relacion || 'sin especificar'}):</span>{' '}
              <strong>{prestamo.cuestionario.referenciaFamiliar.nombre}</strong> ·{' '}
              <a href={`tel:${prestamo.cuestionario.referenciaFamiliar.telefono}`} className="text-amber">
                {prestamo.cuestionario.referenciaFamiliar.telefono}
              </a>
            </div>
            <div>
              <span className="text-textDim">Otro chofer:</span>{' '}
              <strong>{prestamo.cuestionario.referenciaChofer.nombre}</strong> ·{' '}
              <a href={`tel:${prestamo.cuestionario.referenciaChofer.telefono}`} className="text-amber">
                {prestamo.cuestionario.referenciaChofer.telefono}
              </a>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {CHECKLIST_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => toggleItem(item.key)}
            className="w-full flex items-start gap-2.5 py-2.5 border-b border-border last:border-b-0 text-left"
          >
            <div
              className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex-shrink-0 mt-0.5 flex items-center justify-center ${
                checklist[item.key]
                  ? 'border-green bg-greenDim'
                  : 'border-border bg-transparent'
              }`}
            >
              {checklist[item.key] && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3DD68C" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
            <div className="text-[13.5px] leading-snug">
              <b className="block">{item.titulo}</b>
              <span className="text-textDim text-xs">{item.descripcion}</span>
            </div>
          </button>
        ))}
      </Card>

      {error && (
        <p className="text-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="mt-auto pt-2">
        <Button onClick={handleAprobar} disabled={!todosMarcados || procesando}>
          {procesando ? 'Procesando...' : `Aprobar y transferir $${prestamo.monto}`}
        </Button>
        <Button variant="ghost" onClick={handleRechazar} disabled={procesando}>
          Rechazar
        </Button>
      </div>
    </div>
  );
}

export default function RevisarPage() {
  return (
    <Suspense fallback={null}>
      <RevisarForm />
    </Suspense>
  );
}
