'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  onAuthStateChanged,
} from 'firebase/auth';
import { fetchEstadoUsuario } from '@/lib/auth-client';
import { auth } from '@/lib/firebase';
import { Button, Field } from '@/components/ui';

function normalizarTelefono(telefono: string): string {
  const limpio = telefono.replace(/[\s\-()]/g, '');

  if (limpio.startsWith('+')) return limpio;
  if (limpio.startsWith('52')) return `+${limpio}`;

  return `+52${limpio}`;
}

export default function IngresarPage() {
  const router = useRouter();

  const [telefono, setTelefono] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    let activo = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!activo) return;

      if (!user) {
        setVerificandoSesion(false);
        return;
      }

      try {
        const estado = await fetchEstadoUsuario(user);
        if (!activo) return;
        router.replace(estado.nextRoute);
      } catch {
        if (!activo) return;
        setVerificandoSesion(false);
      }
    });

    return () => {
      activo = false;
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (verificandoSesion) return;
    if (recaptchaRef.current) return;

    const container = document.getElementById('recaptcha-container');
    if (!container) return;

    const verifier = new RecaptchaVerifier(auth, container, {
      size: 'invisible',
      callback: () => {
        setError(null);
      },
      'expired-callback': () => {
        verifier.clear();
        recaptchaRef.current = null;
      },
    });

    recaptchaRef.current = verifier;

    verifier.render().catch((err) => {
      console.error('No se pudo renderizar reCAPTCHA:', err);
      setError('No se pudo cargar la verificación anti-spam.');
      verifier.clear();
      recaptchaRef.current = null;
    });

    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, [verificandoSesion]);

  if (verificandoSesion) {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setCargando(true);

    try {
      const telefonoNormalizado = normalizarTelefono(telefono);

      if (!recaptchaRef.current) {
        setError('No se pudo inicializar la verificación.');
        return;
      }

      const confirmationResult: ConfirmationResult =
        await signInWithPhoneNumber(
          auth,
          telefonoNormalizado,
          recaptchaRef.current
        );

      (window as any).confirmationResult = confirmationResult;

      sessionStorage.setItem('registro_telefono', telefonoNormalizado);
      sessionStorage.setItem('modo_auth', 'login');

      router.push('/verificar');
    } catch (err) {
      console.error(err);

      recaptchaRef.current?.clear();
      recaptchaRef.current = null;

      const firebaseError = err as { code?: string; message?: string };
      const code = firebaseError.code || 'error-desconocido';

      setError(`No se pudo enviar el código SMS. ${code}`);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 pt-20 pb-10 min-h-screen flex flex-col">

      <h1 className="font-display text-[28px] font-semibold leading-[1.15] mb-2 text-on-dark text-soft-outline">
        Bienvenido
        <br />
        de nuevo
      </h1>

      <p className="text-on-dark-muted text-[14.5px] leading-relaxed mb-7">
        Escribe el número con el que te registraste.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1">

        <Field
          label="WhatsApp / Celular"
          placeholder="55 1234 5678"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          required
        />

        {error && (
          <p className="text-danger text-sm mb-4">
            {error}
          </p>
        )}

        <div id="recaptcha-container" />

        <div className="mt-auto pt-4">
          <Button
            type="submit"
            disabled={cargando}
          >
            {cargando ? 'Enviando código...' : 'Enviar código'}
          </Button>
        </div>

      </form>

    </div>
  );
}
