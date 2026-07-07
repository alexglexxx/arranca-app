'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmationResult } from 'firebase/auth';
import { getBearerHeaders } from '@/lib/auth-client';
import { Button } from '@/components/ui';

const DURACION_REENVIO_SEG = 45;

export default function VerificarPage() {
  const router = useRouter();
  const [digitos, setDigitos] = useState<string[]>(['', '', '', '', '', '']);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(DURACION_REENVIO_SEG);
  const [telefono, setTelefono] = useState('');
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setTelefono(sessionStorage.getItem('registro_telefono') || '');
  }, []);

  useEffect(() => {
    if (segundosRestantes <= 0) return;
    const timer = setTimeout(() => setSegundosRestantes((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [segundosRestantes]);

  function handleDigitoChange(index: number, valor: string) {
    if (!/^\d?$/.test(valor)) return;

    const nuevosDigitos = [...digitos];
    nuevosDigitos[index] = valor;
    setDigitos(nuevosDigitos);

    if (valor && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    if (nuevosDigitos.every((d) => d !== '')) {
      verificarCodigo(nuevosDigitos.join(''));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digitos[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  async function verificarCodigo(codigo: string) {
    setError(null);
    setCargando(true);

    try {
      const confirmationResult = (
        window as unknown as { confirmationResult?: ConfirmationResult }
      ).confirmationResult;

      if (!confirmationResult) {
        setError('Tu sesión de verificación expiró. Vuelve a empezar el registro.');
        return;
      }

      const credencial = await confirmationResult.confirm(codigo);
      const firebaseUid = credencial.user.uid;
      const headers = await getBearerHeaders(credencial.user, {
        'Content-Type': 'application/json',
      });

      const nombre = sessionStorage.getItem('registro_nombre') || '';
      const correo = sessionStorage.getItem('registro_correo') || '';
      const codigoReferido = sessionStorage.getItem('codigo_referido') || undefined;

      const res = await fetch('/api/usuarios/sincronizar', {
        method: 'POST',
        headers,
        body: JSON.stringify({ firebaseUid, nombre, correo, telefono, codigoReferido }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo completar el registro.');
        return;
      }

      router.push(data.nextRoute || `/kyc?usuarioId=${data.usuarioId}`);
    } catch (err) {
      console.error(err);
      setError('El código no es correcto o expiró.');
      setDigitos(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } finally {
      setCargando(false);
    }
  }

  async function reenviarCodigo() {
    const modoAuth = sessionStorage.getItem('modo_auth');
    router.push(modoAuth === 'login' ? '/ingresar' : '/registro');
  }

  return (
    <div className="max-w-md mx-auto px-6 pt-20 pb-10 min-h-screen flex flex-col">

      <h1 className="font-display text-[28px] font-semibold leading-[1.15] -tracking-wide mb-2 text-on-dark text-soft-outline">
        Revisa tus
        <br />
        mensajes SMS
      </h1>
      <p className="text-on-dark-muted text-[14.5px] leading-relaxed mb-7">
        Te mandamos un código a <strong className="text-text">{telefono}</strong>. Escríbelo
        abajo.
      </p>

      <div className="flex gap-2 mb-5 justify-center">
        {digitos.map((digito, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digito}
            onChange={(e) => handleDigitoChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            autoFocus={i === 0}
            className={`input-readable w-11 h-14 flex-shrink-0 rounded-[14px] flex items-center justify-center font-mono text-xl font-bold text-center outline-none transition-colors ${
              digito ? 'border-amber text-amber' : 'border-border text-text'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <p className="text-[14.5px] text-textDim mb-5">
        ¿No llegó?{' '}
        {segundosRestantes > 0 ? (
          <span>Reenviar código (0:{segundosRestantes.toString().padStart(2, '0')})</span>
        ) : (
          <button onClick={reenviarCodigo} className="text-amber font-semibold">
            Reenviar código
          </button>
        )}
      </p>

      <div className="mt-auto">
        <Button
          disabled={cargando || digitos.some((d) => !d)}
          onClick={() => verificarCodigo(digitos.join(''))}
        >
          {cargando ? 'Verificando...' : 'Continuar'}
        </Button>
      </div>
    </div>
  );
}
