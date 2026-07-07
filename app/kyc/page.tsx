'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { fetchEstadoUsuario, getBearerHeaders } from '@/lib/auth-client';
import { auth } from '@/lib/firebase';
import { DevResetSolicitudButton } from '@/components/DevResetSolicitudButton';
import { Button, UploadBox } from '@/components/ui';
import { subirArchivo } from '@/lib/storage';

function KycForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const usuarioIdParam = searchParams.get('usuarioId');
  const [usuario, setUsuario] = useState<User | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [verificandoEstado, setVerificandoEstado] = useState(true);

  const [selfieIne, setSelfieIne] = useState<File | null>(null);
  const [tarjetaCirculacion, setTarjetaCirculacion] = useState<File | null>(null);
  const [capturaPerfil, setCapturaPerfil] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputSelfieRef = useRef<HTMLInputElement>(null);
  const inputTarjetaRef = useRef<HTMLInputElement>(null);
  const inputCapturaPerfilRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let activo = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!activo) return;

      if (!user) {
        router.replace('/registro');
        return;
      }

      if (usuarioIdParam && usuarioIdParam !== user.uid) {
        router.replace('/');
        return;
      }

      setUsuario(user);
      setUsuarioId(user.uid);

      try {
        const estado = await fetchEstadoUsuario(user);
        if (!activo) return;

        if (!['nuevo', 'perfil_incompleto', 'kyc_pendiente'].includes(estado.usuario.estado)) {
          router.replace(estado.nextRoute);
          return;
        }

        setVerificandoEstado(false);
      } catch {
        if (!activo) return;
        setError('No se pudo validar tu estado. Intenta de nuevo.');
        setVerificandoEstado(false);
      }
    });

    return () => {
      activo = false;
      unsubscribe();
    };
  }, [router, usuarioIdParam]);

  if (verificandoEstado) {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  async function handleContinuar() {
    if (!usuarioId) return;

    if (!selfieIne || !tarjetaCirculacion || !capturaPerfil) {
      setError('Sube los tres archivos antes de continuar.');
      return;
    }

    setError(null);
    setSubiendo(true);

    try {
      const selfieIneUrl = await subirArchivo(selfieIne, 'kyc-selfie-ine', usuarioId);
      const tarjetaCirculacionUrl = await subirArchivo(
        tarjetaCirculacion,
        'kyc-tarjeta-circulacion',
        usuarioId
      );
      const capturaPerfilUrl = await subirArchivo(
        capturaPerfil,
        'kyc-captura-perfil',
        usuarioId
      );

      const res = await fetch('/api/usuarios/kyc', {
        method: 'POST',
        headers: await getBearerHeaders(usuario, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          usuarioId,
          selfieIneUrl,
          tarjetaCirculacionUrl,
          capturaPerfilUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'No se pudo guardar tu verificación.');
        return;
      }

      router.push('/solicitud');
    } catch {
      setError('No se pudo subir tus archivos. Revisa tu conexión.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 pt-20 pb-10 min-h-screen flex flex-col">
      <h1 className="font-display text-[28px] font-semibold leading-[1.15] -tracking-wide mb-2 text-on-dark text-soft-outline">
        Solo una vez,
        <br />
        te lo prometemos
      </h1>
      <p className="text-on-dark-muted text-[14.5px] leading-relaxed mb-7">
        Esto nos protege a los dos. Tarda 2 minutos.
      </p>

      <input
        ref={inputSelfieRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => setSelfieIne(e.target.files?.[0] || null)}
      />
      <input
        ref={inputTarjetaRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => setTarjetaCirculacion(e.target.files?.[0] || null)}
      />

      <p className="text-[14.5px] font-bold text-on-dark-muted uppercase tracking-wider mb-2.5">
        Tu identidad
      </p>
      <UploadBox
        titulo="Selfie con tu INE"
        descripcion={selfieIne ? selfieIne.name : 'Tócalo para tomar la foto'}
        completado={!!selfieIne}
        onClick={() => inputSelfieRef.current?.click()}
      />
      <UploadBox
        titulo="Tarjeta de circulación"
        descripcion={
          tarjetaCirculacion ? tarjetaCirculacion.name : 'Que se vean bien las placas'
        }
        completado={!!tarjetaCirculacion}
        onClick={() => inputTarjetaRef.current?.click()}
      />

      <input
        ref={inputCapturaPerfilRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => setCapturaPerfil(e.target.files?.[0] || null)}
      />

      <p className="text-[14.5px] font-bold text-on-dark-muted uppercase tracking-wider mb-2.5 mt-2">
        Tu actividad
      </p>
      <UploadBox
        titulo="Captura de tu perfil"
        descripcion={
          capturaPerfil
            ? capturaPerfil.name
            : 'Abre tu app de chofer, ve a tu perfil, toma captura de pantalla'
        }
        completado={!!capturaPerfil}
        onClick={() => inputCapturaPerfilRef.current?.click()}
      />

      <div className="card-readable border-dashed rounded-card p-[18px] mb-3.5">
        <p className="text-[14px] text-on-dark-muted leading-relaxed">
          <strong className="text-text">Tip:</strong> que se vea tu nombre y tu estatus de
          conectado/disponible. Para tomar captura: botón de encendido + bajar volumen al
          mismo tiempo.
        </p>
      </div>

      {error && (
        <p className="text-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="mt-auto pt-2">
        <Button onClick={handleContinuar} disabled={subiendo}>
          {subiendo ? 'Subiendo...' : 'Continuar'}
        </Button>
        <DevResetSolicitudButton />
      </div>
    </div>
  );
}

export default function KycPage() {
  return (
    <Suspense fallback={null}>
      <KycForm />
    </Suspense>
  );
}
