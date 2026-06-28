'use client';

import { useState, useEffect } from 'react';
import { Button, Card } from '@/components/ui';

interface Pendiente {
  usuarioId: string;
  nombre: string;
  telefono: string;
  saldoRecompensas: number;
  referidosExitosos: number;
}

export default function ReferidosAdminPage() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch('/api/admin/referidos/pendientes');
    if (res.ok) {
      const data = await res.json();
      setPendientes(data.pendientes || []);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function marcarPagado(usuarioId: string) {
    setProcesandoId(usuarioId);
    try {
      const res = await fetch('/api/admin/referidos/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId }),
      });
      if (res.ok) {
        await cargar();
      }
    } finally {
      setProcesandoId(null);
    }
  }

  if (cargando) {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen">
      <h1 className="font-display text-[22px] font-semibold mb-2">Recompensas pendientes</h1>
      <p className="text-textDim text-[13.5px] mb-5">
        Transfiere manualmente por SPEI, luego marca como pagado.
      </p>

      {pendientes.length === 0 && (
        <Card>
          <p className="text-textDim text-[13.5px] py-2">No hay recompensas pendientes.</p>
        </Card>
      )}

      {pendientes.map((p) => (
        <Card key={p.usuarioId}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-sm">{p.nombre}</div>
              <div className="text-xs text-textDim mt-0.5">
                {p.telefono} · {p.referidosExitosos} referido(s)
              </div>
            </div>
            <div className="font-mono font-bold text-lg text-green">${p.saldoRecompensas}</div>
          </div>
          <Button
            variant="ghost"
            onClick={() => marcarPagado(p.usuarioId)}
            disabled={procesandoId === p.usuarioId}
          >
            {procesandoId === p.usuarioId ? 'Procesando...' : 'Ya transferí — marcar pagado'}
          </Button>
        </Card>
      ))}
    </div>
  );
}
