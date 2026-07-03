'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { fetchEstadoUsuario } from '@/lib/auth-client';
import { auth } from '@/lib/firebase';
import { BrandHeader, Button } from '@/components/ui';

export default function HomePage() {
  const router = useRouter();
  const [verificandoSesion, setVerificandoSesion] = useState(true);

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

  if (verificandoSesion) {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex flex-col">
      <BrandHeader />

      <div className="flex-1 flex flex-col justify-center">
        <h1 className="font-display text-[32px] font-semibold leading-tight mb-3">
          Adelanta tus
          <br />
          ganancias.
        </h1>

        <p className="text-textDim text-[15px] leading-relaxed mb-10">
          Obtén efectivo para seguir trabajando. Elige si vas a crear una cuenta
          nueva o si ya eres parte de Arranca.
        </p>

        <div className="space-y-4">
          <Button onClick={() => router.push('/registro')}>
            Solicitar préstamo
          </Button>

          <div className="text-center">
            <p className="text-textDim text-[14.5px] mb-3">¿Ya tienes cuenta?</p>
            <button
              type="button"
              onClick={() => router.push('/ingresar')}
              className="w-full h-14 rounded-card border border-border font-semibold transition-colors hover:bg-surface"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
