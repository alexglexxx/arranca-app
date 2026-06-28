'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { BrandHeader, Button, Card, CardRow } from '@/components/ui';
import { REFERIDOS } from '@/types';

interface DatosReferido {
  nombre: string;
  codigoReferido: string;
  referidosExitosos: number;
  saldoRecompensas: number;
}

export default function ReferidosPage() {
  const router = useRouter();
  const [datos, setDatos] = useState<DatosReferido | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/registro');
        return;
      }

      try {
        const res = await fetch(`/api/usuarios/me?usuarioId=${user.uid}`);
        if (res.ok) {
          setDatos(await res.json());
        }
      } catch {
        // Silencioso — si falla, la pantalla simplemente queda en "cargando"
      }
    });
    return unsubscribe;
  }, [router]);

  if (!datos) {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 min-h-screen flex items-center justify-center">
        <p className="text-textDim">Cargando...</p>
      </div>
    );
  }

  const linkReferido = `${typeof window !== 'undefined' ? window.location.origin : ''}/registro?ref=${datos.codigoReferido}`;

  async function compartir() {
    const mensaje = `Te invito a arranca. — préstamo rápido para gasolina, sin vueltas. Regístrate con mi código y los dos salimos beneficiados: ${linkReferido}`;

    if (navigator.share) {
      try {
        await navigator.share({ text: mensaje });
        return;
      } catch {
        // Si cancela el share nativo, cae al fallback de copiar
      }
    }

    await navigator.clipboard.writeText(mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-10 min-h-screen flex flex-col">
      <BrandHeader />

      <h1 className="font-display text-[28px] font-semibold leading-[1.15] -tracking-wide mb-2">
        Invita y
        <br />
        gana ${REFERIDOS.RECOMPENSA_MXN}
      </h1>
      <p className="text-textDim text-[14.5px] leading-relaxed mb-7">
        Por cada chofer que invites y pague su primer préstamo, te depositamos ${REFERIDOS.RECOMPENSA_MXN}.
      </p>

      <Card className="text-center py-6">
        <p className="text-[14.5px] text-textDim uppercase tracking-wider mb-2">Tu código</p>
        <p className="font-mono text-[28px] font-bold text-amber tracking-wider">
          {datos.codigoReferido}
        </p>
      </Card>

      <Button onClick={compartir}>{copiado ? 'Copiado ✓' : 'Compartir mi link'}</Button>

      <Card className="mt-3.5">
        <CardRow label="Referidos que ya pagaron" value={datos.referidosExitosos} />
        <CardRow
          label="Saldo por cobrar"
          value={`$${datos.saldoRecompensas}`}
          valueClassName="font-mono text-green"
        />
      </Card>

      {datos.saldoRecompensas > 0 && (
        <p className="text-[14px] text-textDim text-center leading-relaxed mt-2">
          Te avisamos por WhatsApp cuando hagamos el depósito de tu saldo.
        </p>
      )}
    </div>
  );
}
