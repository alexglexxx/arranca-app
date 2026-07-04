'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { getBearerHeaders } from '@/lib/auth-client';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui';

const RESET_VISIBLE =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_TEST_RESET === 'true';

const CONFIRMATION_TEXT =
  'Esto borrará tu solicitud de prueba para que puedas volver a iniciar el flujo. No cuenta como aprobación ni rechazo.';

const SESSION_KEYS_TO_CLEAR = [
  'registro_nombre',
  'registro_correo',
  'registro_telefono',
  'codigo_referido',
  'modo_auth',
] as const;

export function DevResetSolicitudButton({ redirectTo = '/registro' }: { redirectTo?: string }) {
  const router = useRouter();
  const [reseteando, setReseteando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!RESET_VISIBLE) {
    return null;
  }

  async function handleReset() {
    if (!window.confirm(CONFIRMATION_TEXT)) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      setError('Necesitas iniciar sesion para resetear tu solicitud de prueba.');
      return;
    }

    setReseteando(true);
    setError(null);

    try {
      const response = await fetch('/api/dev/reset-mi-solicitud', {
        method: 'POST',
        headers: await getBearerHeaders(user),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error || 'No se pudo resetear tu solicitud de prueba.');
        return;
      }

      for (const key of SESSION_KEYS_TO_CLEAR) {
        sessionStorage.removeItem(key);
      }

      await signOut(auth);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('No se pudo resetear tu solicitud de prueba.');
    } finally {
      setReseteando(false);
    }
  }

  return (
    <div className="mt-6 rounded-card border border-dashed border-danger/40 bg-danger/5 p-4">
      <p className="text-[13.5px] leading-relaxed text-textDim mb-3">{CONFIRMATION_TEXT}</p>
      {error && (
        <p className="text-danger text-sm mb-3" role="alert">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        className="mt-0 border-danger/40 text-danger"
        onClick={handleReset}
        disabled={reseteando}
      >
        {reseteando ? 'Reseteando...' : 'Resetear mi solicitud de prueba'}
      </Button>
    </div>
  );
}
