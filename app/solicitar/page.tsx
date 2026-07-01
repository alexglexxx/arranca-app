'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button, Card, CardRow, Field } from '@/components/ui';
import { REGLAS_PRESTAMO, calcularMontoConInteres, CuestionarioSolicitud } from '@/types';
import { soportaContactPicker, elegirContacto } from '@/lib/contactos';

const MONTO = REGLAS_PRESTAMO.MONTO_BASE;
const MONTO_HOY = calcularMontoConInteres(MONTO, REGLAS_PRESTAMO.TASA_PAGO_MISMO_DIA);
const MONTO_LIMITE = calcularMontoConInteres(MONTO, REGLAS_PRESTAMO.TASA_PAGO_FECHA_LIMITE);
const MONTO_VENCIDO = calcularMontoConInteres(MONTO, REGLAS_PRESTAMO.TASA_PAGO_VENCIDO);

const PLATAFORMAS = [
  { id: 'uber', label: 'Uber' },
  { id: 'didi', label: 'DiDi' },
  { id: 'indriver', label: 'inDriver' },
  { id: 'taxi', label: 'Taxi tradicional' },
  { id: 'otra', label: 'Otra' },
];

function formatearFechaLimite(): string {
  const fecha = new Date(Date.now() + REGLAS_PRESTAMO.DIAS_PLAZO_MAXIMO * 24 * 60 * 60 * 1000);
  return fecha.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

function limpiarTelefonoContacto(telefono: string): string {
  return telefono.replace(/[^\d]/g, '').replace(/^52/, '').slice(-10);
}

function SolicitarForm() {
  const router = useRouter();
  const params = useSearchParams();
  const capturaPerfilUrl = params.get('capturaPerfilUrl') || '';
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  const [cuentaDestino, setCuentaDestino] = useState('');
  const [nombreTitularCuenta, setNombreTitularCuenta] = useState('');

  const [plataformas, setPlataformas] = useState<string[]>([]);
  const [tiempoTrabajando, setTiempoTrabajando] = useState<CuestionarioSolicitud['tiempoTrabajando'] | ''>('');
  const [turnoPrincipal, setTurnoPrincipal] = useState<CuestionarioSolicitud['turnoPrincipal'] | ''>('');
  const [diasPorSemana, setDiasPorSemana] = useState('6');
  const [ingresoSemanalRango, setIngresoSemanalRango] = useState<CuestionarioSolicitud['ingresoSemanalRango'] | ''>('');
  const [zona, setZona] = useState('');
  const [ciudad, setCiudad] = useState('');

  const [refFamiliarNombre, setRefFamiliarNombre] = useState('');
  const [refFamiliarTelefono, setRefFamiliarTelefono] = useState('');
  const [refFamiliarRelacion, setRefFamiliarRelacion] = useState('');
  const [refChoferNombre, setRefChoferNombre] = useState('');
  const [refChoferTelefono, setRefChoferTelefono] = useState('');
  const [refChoferPlataforma, setRefChoferPlataforma] = useState('');

  const [puedeElegirContacto, setPuedeElegirContacto] = useState(false);

  const [aceptaCompromiso, setAceptaCompromiso] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fechaLimiteTexto = formatearFechaLimite();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/registro');
        return;
      }
      setUsuarioId(user.uid);
    });
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    setPuedeElegirContacto(soportaContactPicker());
  }, []);

  async function handleElegirReferenciaFamiliar() {
    const contacto = await elegirContacto();
    if (contacto) {
      setRefFamiliarNombre(contacto.nombre);
      setRefFamiliarTelefono(limpiarTelefonoContacto(contacto.telefono));
    }
  }

  async function handleElegirReferenciaChofer() {
    const contacto = await elegirContacto();
    if (contacto) {
      setRefChoferNombre(contacto.nombre);
      setRefChoferTelefono(limpiarTelefonoContacto(contacto.telefono));
    }
  }

  function togglePlataforma(id: string) {
    setPlataformas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSolicitar() {
    if (!usuarioId) return;

    if (!cuentaDestino.trim() || cuentaDestino.trim().length < 10) {
      setError('Ingresa una cuenta o CLABE válida.');
      return;
    }
    if (plataformas.length === 0) {
      setError('Selecciona al menos una plataforma en la que trabajas.');
      return;
    }
    if (!tiempoTrabajando || !turnoPrincipal || !ingresoSemanalRango) {
      setError('Completa todas las preguntas sobre tu actividad.');
      return;
    }
    if (!zona.trim() || !ciudad.trim()) {
      setError('Completa tu zona y ciudad.');
      return;
    }
    if (!refFamiliarNombre.trim() || !refFamiliarTelefono.trim()) {
      setError('Completa los datos de tu referencia familiar.');
      return;
    }
    if (!refChoferNombre.trim() || !refChoferTelefono.trim()) {
      setError('Completa los datos de tu referencia (otro chofer).');
      return;
    }
    if (!aceptaCompromiso) {
      setError('Debes aceptar el compromiso de pago para continuar.');
      return;
    }

    setError(null);
    setCargando(true);

    const cuestionario: CuestionarioSolicitud = {
      plataformas,
      tiempoTrabajando: tiempoTrabajando as CuestionarioSolicitud['tiempoTrabajando'],
      turnoPrincipal: turnoPrincipal as CuestionarioSolicitud['turnoPrincipal'],
      diasPorSemana: Number(diasPorSemana),
      ingresoSemanalRango: ingresoSemanalRango as CuestionarioSolicitud['ingresoSemanalRango'],
      zona: zona.trim(),
      ciudad: ciudad.trim(),
      referenciaFamiliar: {
        nombre: refFamiliarNombre.trim(),
        telefono: refFamiliarTelefono.trim(),
        relacion: refFamiliarRelacion.trim(),
      },
      referenciaChofer: {
        nombre: refChoferNombre.trim(),
        telefono: refChoferTelefono.trim(),
        relacion: refChoferPlataforma.trim(),
      },
    };

    try {
      const res = await fetch('/api/prestamos/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId,
          cuentaDestino: cuentaDestino.trim(),
          nombreTitularCuenta: nombreTitularCuenta.trim(),
          capturaPerfilUrl,
          cuestionario,
          aceptoCompromiso: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo enviar tu solicitud.');
        return;
      }

      router.push(`/prestamo?prestamoId=${data.prestamoId}`);
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-10">
      <h1 className="font-display text-[28px] font-semibold leading-[1.15] -tracking-wide mb-2">
        Tu préstamo
        <br />
        está listo
      </h1>
      <p className="text-textDim text-[14.5px] leading-relaxed mb-7">
        Elige cuándo pagas. Mientras antes, menos pagas.
      </p>

      <Card>
        <CardRow label="Recibes hoy" value={`$${MONTO}`} valueClassName="font-mono text-amber" />
        <CardRow
          label="Si pagas hoy mismo"
          value={
            <>
              ${MONTO_HOY}{' '}
              <span className="text-textDim font-medium">
                · {(REGLAS_PRESTAMO.TASA_PAGO_MISMO_DIA * 100).toFixed(0)}%
              </span>
            </>
          }
          valueClassName="font-mono"
        />
        <CardRow
          label={`Si pagas antes del ${fechaLimiteTexto}`}
          value={
            <>
              ${MONTO_LIMITE}{' '}
              <span className="text-textDim font-medium">
                · {(REGLAS_PRESTAMO.TASA_PAGO_FECHA_LIMITE * 100).toFixed(0)}%
              </span>
            </>
          }
          valueClassName="font-mono"
        />
        <CardRow
          label="Si te pasas de la fecha"
          value={
            <>
              ${MONTO_VENCIDO}{' '}
              <span className="text-textDim font-medium">
                · {(REGLAS_PRESTAMO.TASA_PAGO_VENCIDO * 100).toFixed(0)}%
              </span>
            </>
          }
          valueClassName="font-mono text-danger"
        />
      </Card>

      <Field
        label="¿A qué cuenta te depositamos?"
        placeholder="CLABE o cuenta · 18 dígitos"
        value={cuentaDestino}
        onChange={(e) => setCuentaDestino(e.target.value)}
      />
      <Field
        label="Nombre del titular de la cuenta"
        placeholder="Igual que en tu INE"
        value={nombreTitularCuenta}
        onChange={(e) => setNombreTitularCuenta(e.target.value)}
      />

      <p className="text-[14.5px] font-bold text-textDim uppercase tracking-wider mb-3 mt-7">
        Sobre tu trabajo
      </p>

      <div className="mb-4">
        <label className="block text-[14.5px] text-textDim mb-2 font-medium">
          ¿En qué plataforma(s) trabajas?
        </label>
        <div className="flex flex-wrap gap-2">
          {PLATAFORMAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlataforma(p.id)}
              className={`px-3.5 py-2 rounded-full text-[14.5px] font-medium border transition-colors ${
                plataformas.includes(p.id)
                  ? 'border-amber bg-amberDim text-amber'
                  : 'border-border text-textDim'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-[14.5px] text-textDim mb-2 font-medium">
          ¿Cuánto tiempo llevas trabajando como chofer?
        </label>
        <select
          value={tiempoTrabajando}
          onChange={(e) => setTiempoTrabajando(e.target.value as typeof tiempoTrabajando)}
          className="w-full bg-surface border border-border rounded-field px-[15px] py-[14px] text-text text-[15px] outline-none focus:border-amber"
        >
          <option value="">Selecciona una opción</option>
          <option value="menos_6_meses">Menos de 6 meses</option>
          <option value="6_meses_2_anos">De 6 meses a 2 años</option>
          <option value="mas_2_anos">Más de 2 años</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-[14.5px] text-textDim mb-2 font-medium">Turno principal</label>
        <select
          value={turnoPrincipal}
          onChange={(e) => setTurnoPrincipal(e.target.value as typeof turnoPrincipal)}
          className="w-full bg-surface border border-border rounded-field px-[15px] py-[14px] text-text text-[15px] outline-none focus:border-amber"
        >
          <option value="">Selecciona una opción</option>
          <option value="mañana">Mañana</option>
          <option value="tarde">Tarde</option>
          <option value="noche">Noche</option>
          <option value="variable">Variable</option>
        </select>
      </div>

      <Field
        label="¿Cuántos días a la semana trabajas?"
        type="number"
        min={1}
        max={7}
        value={diasPorSemana}
        onChange={(e) => setDiasPorSemana(e.target.value)}
      />

      <div className="mb-4">
        <label className="block text-[14.5px] text-textDim mb-2 font-medium">
          Ingreso promedio semanal
        </label>
        <select
          value={ingresoSemanalRango}
          onChange={(e) => setIngresoSemanalRango(e.target.value as typeof ingresoSemanalRango)}
          className="w-full bg-surface border border-border rounded-field px-[15px] py-[14px] text-text text-[15px] outline-none focus:border-amber"
        >
          <option value="">Selecciona un rango</option>
          <option value="menos_1500">Menos de $1,500</option>
          <option value="1500_3000">$1,500 - $3,000</option>
          <option value="3000_5000">$3,000 - $5,000</option>
          <option value="mas_5000">Más de $5,000</option>
        </select>
      </div>

      <Field label="Zona o colonia donde trabajas" value={zona} onChange={(e) => setZona(e.target.value)} />
      <Field label="Ciudad / municipio" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />

      <p className="text-[14.5px] font-bold text-textDim uppercase tracking-wider mb-3 mt-7">
        Referencia familiar
      </p>
      {puedeElegirContacto && (
        <button
          type="button"
          onClick={handleElegirReferenciaFamiliar}
          className="w-full border-2 border-dashed border-border rounded-[16px] py-3.5 mb-3 text-[14.5px] font-semibold text-amber flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
          </svg>
          Elegir de mis contactos
        </button>
      )}
      <Field label="Nombre completo" value={refFamiliarNombre} onChange={(e) => setRefFamiliarNombre(e.target.value)} />
      <Field label="Teléfono" value={refFamiliarTelefono} onChange={(e) => setRefFamiliarTelefono(e.target.value)} />
      <Field label="Parentesco" placeholder="Ej. Hermano, esposa, mamá" value={refFamiliarRelacion} onChange={(e) => setRefFamiliarRelacion(e.target.value)} />

      <p className="text-[14.5px] font-bold text-textDim uppercase tracking-wider mb-3 mt-7">
        Referencia — otro chofer
      </p>
      {puedeElegirContacto && (
        <button
          type="button"
          onClick={handleElegirReferenciaChofer}
          className="w-full border-2 border-dashed border-border rounded-[16px] py-3.5 mb-3 text-[14.5px] font-semibold text-amber flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
          </svg>
          Elegir de mis contactos
        </button>
      )}
      <Field label="Nombre completo" value={refChoferNombre} onChange={(e) => setRefChoferNombre(e.target.value)} />
      <Field label="Teléfono" value={refChoferTelefono} onChange={(e) => setRefChoferTelefono(e.target.value)} />
      <Field label="Plataforma en la que trabaja (opcional)" value={refChoferPlataforma} onChange={(e) => setRefChoferPlataforma(e.target.value)} />

      <label className="flex items-start gap-3 mb-5 mt-7 cursor-pointer">
        <input
          type="checkbox"
          checked={aceptaCompromiso}
          onChange={(e) => setAceptaCompromiso(e.target.checked)}
          className="mt-1 w-4 h-4 accent-amber"
        />
        <span className="text-[14px] text-textDim leading-relaxed">
          Acepto que recibí en préstamo la cantidad que se me asignó, y me comprometo a
          pagarla según las condiciones mostradas (monto e interés correspondiente a la fecha
          en que liquide). Si me atraso varios días sin pagar, autorizo a que me contacten por
          otros medios además de WhatsApp — como llamada telefónica, o a través de mis
          referencias de contacto — para dar seguimiento a mi pago.
        </span>
      </label>

      {error && (
        <p className="text-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <Button onClick={handleSolicitar} disabled={cargando}>
        {cargando ? 'Enviando...' : `Solicitar $${MONTO}`}
      </Button>
    </div>
  );
}

export default function SolicitarPage() {
  return (
    <Suspense fallback={null}>
      <SolicitarForm />
    </Suspense>
  );
}
