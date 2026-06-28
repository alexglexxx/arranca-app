'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button, UploadBox } from '@/components/ui';
import { subirArchivo } from '@/lib/storage';

export default function KycPage() {
  const router = useRouter();
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  const [selfieIne, setSelfieIne] = useState<File | null>(null);
  const [tarjetaCirculacion, setTarjetaCirculacion] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputSelfieRef = useRef<HTMLInputElement>(null);
  const inputTarjetaRef = useRef<HTMLInputElement>(null);
  const inputVideoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Protege la pantalla: si no hay sesión de Firebase Auth activa, regresa
    // al registro. usuarioId = auth.currentUser.uid, igual que las reglas
    // de Storage esperan (request.auth.uid == usuarioId).
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/registro');
        return;
      }
      setUsuarioId(user.uid);
    });
    return unsubscribe;
  }, [router]);

  async function handleContinuar() {
    if (!usuarioId) return;

    if (!selfieIne || !tarjetaCirculacion || !video) {
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
      const videoPerfilUrl = await subirArchivo(video, 'kyc-video-perfil', usuarioId);

      const res = await fetch('/api/usuarios/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId, selfieIneUrl, tarjetaCirculacionUrl, videoPerfilUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'No se pudo guardar tu verificación.');
        return;
      }

      router.push(`/solicitar?videoPerfilUrl=${encodeURIComponent(videoPerfilUrl)}`);
    } catch {
      setError('No se pudo subir tus archivos. Revisa tu conexión.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex flex-col">
      <h1 className="font-display text-[28px] font-semibold leading-[1.15] -tracking-wide mb-2">
        Solo una vez,
        <br />
        te lo prometemos
      </h1>
      <p className="text-textDim text-[14.5px] leading-relaxed mb-7">
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

      <p className="text-[11px] font-bold text-textDim uppercase tracking-wider mb-2.5">
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
        ref={inputVideoRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => setVideo(e.target.files?.[0] || null)}
      />

      <p className="text-[11px] font-bold text-textDim uppercase tracking-wider mb-2.5 mt-2">
        Tu actividad
      </p>
      <UploadBox
        titulo="Video de 8 seg"
        descripcion={
          video ? video.name : 'Abre tu app de chofer y muestra que estás en línea'
        }
        completado={!!video}
        onClick={() => inputVideoRef.current?.click()}
      />

      <div className="bg-transparent border border-dashed border-border rounded-card p-[18px] mb-3.5">
        <p className="text-[12.5px] text-textDim leading-relaxed">
          <strong className="text-text">Tip para el video:</strong> que se vea tu pantalla
          completa, tu nombre en el perfil y que puedas aceptar viajes.
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
      </div>
    </div>
  );
}
