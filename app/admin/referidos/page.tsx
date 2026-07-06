'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Button, Card } from '@/components/ui';
import { auth } from '@/lib/firebase';
import { getBearerHeaders } from '@/lib/auth-client';

interface Pendiente {
  usuarioId: string;
  nombre: string;
  telefono: string;
  saldoRecompensas: number;
  referidosExitosos: number;
  bonoDineroPendienteActivaciones?: number;
  activacionesBonoPendientes?: number;
}

export default function ReferidosAdminPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<User | null>(null);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar(user: User) {
    setError(null);

    try {
      const res = await fetch('/api/admin/referidos/pendientes', {
        headers: await getBearerHeaders(user),
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        setPendientes([]);
        setError(data.error || 'No se pudieron cargar las recompensas pendientes.');
        return;
      }

      setPendientes(data.pendientes || []);
    } catch {
      setPendientes([]);
      setError('No se pudieron cargar las recompensas pendientes.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    let activo = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!activo) return;

      if (!user) {
        router.replace('/ingresar');
        return;
      }

      setUsuario(user);
      await cargar(user);
    });

    return () => {
      activo = false;
      unsubscribe();
    };
  }, [router]);

  async function marcarPagado(usuarioId: string) {
    if (!usuario) return;

    setProcesandoId(usuarioId);
    setError(null);

    try {
      const res = await fetch('/api/admin/referidos/pagar', {
        method: 'POST',
        headers: await getBearerHeaders(usuario, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ usuarioId }),
      });

      const data = await res.json();

      if (res.ok) {
        await cargar(usuario);
        return;
      }

      setError(data.error || 'No se pudo marcar la recompensa como pagada.');
    } catch {
      setError('No se pudo marcar la recompensa como pagada.');
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
      <p className="text-textDim text-[14.5px] mb-5">
        Transfiere manualmente por SPEI, luego marca como pagado.
      </p>

      <Link
        href="/admin/promociones"
        className="mb-4 inline-flex w-full items-center justify-center rounded-[14px] border border-amber/40 bg-amberDim/10 px-4 py-3 text-center text-sm font-semibold text-amber"
      >
        Promociones y activaciones
      </Link>

      {error && (
        <p className="text-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      {pendientes.length === 0 && (
        <Card>
          <p className="text-textDim text-[14.5px] py-2">No hay recompensas pendientes.</p>
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
              {Number(p.activacionesBonoPendientes || 0) > 0 && (
                <div className="text-xs text-amber mt-1">
                  {p.activacionesBonoPendientes} activacion(es) pendiente(s)
                </div>
              )}
            </div>
            <div className="font-mono font-bold text-lg text-green">${p.saldoRecompensas}</div>
          </div>
          <Button
            variant="ghost"
            onClick={() => marcarPagado(p.usuarioId)}
            disabled={procesandoId === p.usuarioId}
          >
            {procesandoId === p.usuarioId ? 'Procesando...' : 'Ya transferi - marcar pagado'}
          </Button>
        </Card>
      ))}
    </div>
  );
}
