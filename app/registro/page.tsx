'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { BrandHeader, Button, Field } from '@/components/ui';

function normalizarTelefono(telefono: string): string {
  const limpio = telefono.replace(/[\s\-()]/g, '');
  if (limpio.startsWith('+')) return limpio;
  if (limpio.startsWith('52')) return `+${limpio}`;
  return `+52${limpio}`;
}

function RegistroForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const ref = params.get('ref');
    if (ref) {
      sessionStorage.setItem('codigo_referido', ref.toUpperCase().trim());
    }
  }, [params]);

  useEffect(() => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      const telefonoNormalizado = normalizarTelefono(telefono);

      if (!recaptchaRef.current) {
        setError('No se pudo inicializar la verificación. Recarga la página.');
        return;
      }

      const resultadoConfirmacion: ConfirmationResult = await signInWithPhoneNumber(
        auth,
        telefonoNormalizado,
        recaptchaRef.current
      );

      (window as unknown as { confirmationResult?: ConfirmationResult }).confirmationResult =
        resultadoConfirmacion;

      sessionStorage.setItem('registro_nombre', nombre.trim());
      sessionStorage.setItem('registro_correo', correo.trim());
      sessionStorage.setItem('registro_telefono', telefonoNormalizado);

      router.push('/verificar');
    } catch (err) {
      console.error(err);
      setError('No se pudo enviar el código. Revisa tu número e intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex flex-col">
      <BrandHeader />

      <h1 className="font-display text-[28px] font-semibold leading-[1.15] -tracking-wide mb-2">
        Gasolina para
        <br />
        seguir trabajando
      </h1>
      <p className="text-textDim text-[14.5px] leading-relaxed mb-7">
        $200 hoy, sin vueltas. Pagas cuando ya facturaste el día.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        <Field
          label="Nombre completo"
          placeholder="Como aparece en tu INE"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <Field
          label="WhatsApp / Celular"
          placeholder="55 1234 5678"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          required
        />
        <Field
          label="Correo"
          type="email"
          placeholder="tucorreo@ejemplo.com"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
        />

        {error && (
          <p className="text-danger text-sm mb-4" role="alert">
            {error}
          </p>
        )}

        <div id="recaptcha-container" />

        <div className="mt-auto pt-4">
          <Button type="submit" disabled={cargando}>
            {cargando ? 'Enviando código...' : 'Enviar código por SMS'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={null}>
      <RegistroForm />
    </Suspense>
  );
}
