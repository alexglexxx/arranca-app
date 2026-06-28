'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, CardRow } from '@/components/ui';
import { Prestamo, determinarTasaAplicable, calcularMontoConInteres } from '@/types';

function ConfirmarPagoForm() {
  const router = useRouter();
  const params = useSearchParams();
  const prestamoId = params.get('prestamoId') || '';

  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [montoFinalPagado, setMontoFinalPagado] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const res = await fetch(`/api/prestamos/${prestamoId}`);
      if (res.ok) {
        const data: Prestamo = await res.json();
        setPrestamo(data);

        if (data.fechaAprobacion && data.fechaLimite) {
          const tasa = determinarTasaAplicable(data.fechaAprobacion, data.fechaLimite);
          const sugerido = calcularMontoConInteres(data.monto, tasa);
          setMontoFinalPagado(sugerido.toString());
        }
      }
    }
    if (prestamoId) cargar();
  }, [prestamoId]);

  async function handleConfirmar() {
    const monto = Number(montoFinalPagado);
    if (!monto || monto <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }

    setError(null);
    setProcesando(true);

    try {
      const res = await fetch('/api/prestamos/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'confirmar_pago',
          prestamoId,
          montoFinalPagado: monto,
          confirmadoPor: 'admin',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo confirmar el pago.');
        return;
      }

      router.push('/admin');
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  }

  if (!prestamo) {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex flex-col">
      <h1 className="font-display text-[22px] font-semibold mb-5">Confirmar pago</h1>

      {prestamo.comprobantePagoUrl && (
        <a
          href={prestamo.comprobantePagoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-video bg-surface2 rounded-card mb-3.5 flex items-center justify-center text-xs text-amber underline"
        >
          Ver comprobante subido
        </a>
      )}

      <Card>
        <CardRow label="Prestado" value={`$${prestamo.monto}`} valueClassName="font-mono" />
        <CardRow label="Si pagó mismo día" value={`$${prestamo.montoSiPagaHoy}`} valueClassName="font-mono" />
        <CardRow label="Si pagó a tiempo" value={`$${prestamo.montoSiPagaFechaLimite}`} valueClassName="font-mono" />
        <CardRow label="Si pagó vencido" value={`$${prestamo.montoSiPagaVencido}`} valueClassName="font-mono" />
      </Card>

      <div className="mb-4">
        <label className="block text-[14.5px] text-textDim mb-2 font-medium">
          Monto recibido (confirma contra el comprobante)
        </label>
        <input
          type="number"
          value={montoFinalPagado}
          onChange={(e) => setMontoFinalPagado(e.target.value)}
          className="w-full bg-surface border border-border rounded-field px-[15px] py-[14px] text-text text-[15px] outline-none focus:border-amber font-mono"
        />
      </div>

      {error && (
        <p className="text-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="mt-auto pt-2">
        <Button onClick={handleConfirmar} disabled={procesando}>
          {procesando ? 'Confirmando...' : 'Confirmar pago recibido'}
        </Button>
      </div>
    </div>
  );
}

export default function ConfirmarPagoPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmarPagoForm />
    </Suspense>
  );
}
