'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';

interface PrestamoConUsuario {
  id: string;
  monto: number;
  estado: string;
  fechaSolicitud: number;
  fechaLimite: number | null;
  usuario: {
    nombre: string;
    telefono: string;
    prestamosCompletados: number;
    enMora: boolean;
  } | null;
}

interface Capital {
  capitalTotal: number;
  capitalPrestado: number;
  capitalDisponible: number;
}

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function tiempoRelativo(timestamp: number): string {
  const minutos = Math.floor((Date.now() - timestamp) / 60000);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}

export default function AdminPage() {
  const [pendientes, setPendientes] = useState<PrestamoConUsuario[]>([]);
  const [activos, setActivos] = useState<PrestamoConUsuario[]>([]);
  const [capital, setCapital] = useState<Capital | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const [resPendientes, resActivos] = await Promise.all([
          fetch('/api/prestamos/lista?estado=pendiente_revision'),
          fetch('/api/prestamos/lista?estado=activo'),
        ]);

        const dataPendientes = await resPendientes.json();
        const dataActivos = await resActivos.json();

        setPendientes(dataPendientes.prestamos || []);
        setActivos(dataActivos.prestamos || []);

        // Capital se lee directo de Firestore vía una API simple
        const resCapital = await fetch('/api/admin/capital');
        if (resCapital.ok) {
          setCapital(await resCapital.json());
        }
      } finally {
        setCargando(false);
      }
    }

    cargar();
    const interval = setInterval(cargar, 15000);
    return () => clearInterval(interval);
  }, []);

  if (cargando) {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen">
      <h1 className="font-display text-[22px] font-semibold mb-5">Solicitudes</h1>

      {capital && (
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div className="bg-surface border border-border rounded-card px-4 py-3.5">
            <div className="font-mono text-[21px] font-bold text-amber">
              ${capital.capitalPrestado.toLocaleString()}
            </div>
            <div className="text-[14.5px] text-textDim mt-0.5">Capital prestado</div>
          </div>
          <div className="bg-surface border border-border rounded-card px-4 py-3.5">
            <div className="font-mono text-[21px] font-bold">
              ${capital.capitalDisponible.toLocaleString()}
            </div>
            <div className="text-[14.5px] text-textDim mt-0.5">Disponible</div>
          </div>
        </div>
      )}

      <p className="text-[14.5px] font-bold text-textDim uppercase tracking-wider mb-3">
        Esperando revisión · {pendientes.length}
      </p>
      <Card className="px-[18px] py-1">
        {pendientes.length === 0 && (
          <p className="text-textDim text-[14.5px] py-3">No hay solicitudes pendientes.</p>
        )}
        {pendientes.map((p) => (
          <Link
            key={p.id}
            href={`/admin/revisar?prestamoId=${p.id}`}
            className="flex items-center gap-3 py-3.5 border-b border-border last:border-b-0"
          >
            <div className="w-[38px] h-[38px] rounded-[10px] bg-surface2 flex items-center justify-center font-display font-semibold text-sm text-amber flex-shrink-0">
              {p.usuario ? iniciales(p.usuario.nombre) : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{p.usuario?.nombre || 'Usuario'}</div>
              <div className="text-xs text-textDim mt-0.5">
                {p.usuario && p.usuario.prestamosCompletados > 0
                  ? `${p.usuario.prestamosCompletados + 1}º préstamo`
                  : 'Primera vez'}{' '}
                · {tiempoRelativo(p.fechaSolicitud)}
              </div>
            </div>
            <div className="font-mono font-bold text-sm">${p.monto}</div>
          </Link>
        ))}
      </Card>

      <p className="text-[14.5px] font-bold text-textDim uppercase tracking-wider mb-3 mt-6">
        Activos · {activos.length}
      </p>
      <Card className="px-[18px] py-1">
        {activos.length === 0 && (
          <p className="text-textDim text-[14.5px] py-3">No hay préstamos activos.</p>
        )}
        {activos.map((p) => {
          const vencido = p.fechaLimite ? Date.now() > p.fechaLimite : false;
          return (
            <Link
              key={p.id}
              href={`/admin/confirmar-pago?prestamoId=${p.id}`}
              className="flex items-center gap-3 py-3.5 border-b border-border last:border-b-0"
            >
              <div
                className="w-[38px] h-[38px] rounded-[10px] bg-surface2 flex items-center justify-center font-display font-semibold text-sm flex-shrink-0"
                style={{ color: vencido ? '#E5594B' : '#3DD68C' }}
              >
                {p.usuario ? iniciales(p.usuario.nombre) : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{p.usuario?.nombre || 'Usuario'}</div>
                <div className="text-xs text-textDim mt-0.5">
                  {vencido
                    ? 'Vencido'
                    : `Vence ${new Date(p.fechaLimite!).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`}
                </div>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  vencido ? 'bg-[#33201D] text-danger' : 'bg-amberDim text-amber'
                }`}
              >
                {vencido ? 'Mora' : 'Activo'}
              </span>
            </Link>
          );
        })}
      </Card>

      <Link
        href="/admin/referidos"
        className="block text-center text-[14.5px] text-amber mt-6 underline"
      >
        Ver recompensas de referidos pendientes
      </Link>
    </div>
  );
}
