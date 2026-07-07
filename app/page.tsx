'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { fetchEstadoUsuario } from '@/lib/auth-client';
import { auth } from '@/lib/firebase';

const ARRANCA_YELLOW = '#FFC400';
const REGISTER_ROUTE = '/registro';
const LOGIN_ROUTE = '/ingresar';

function ArrancaLogo() {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 320 260" aria-hidden="true" className="h-auto w-[15rem] sm:w-[18rem] md:w-[21rem]">
        <path
          d="M92 214 L144 52 H176 L228 214 H190 L160 124 H158 L130 214 Z"
          fill="#FFC400"
        />

        <path d="M151 76 L169 76 L186 214 L134 214 Z" fill="#050505" />

        <rect x="153.5" y="92" width="13" height="28" rx="1.5" fill="#FFC400" />
        <rect x="151.5" y="132" width="17" height="34" rx="1.5" fill="#FFC400" />
        <rect x="149.5" y="180" width="21" height="34" rx="1.5" fill="#FFC400" />
      </svg>

      <span className="text-outline mt-2 text-[1.75rem] font-extrabold uppercase tracking-[0.28em] text-on-dark sm:text-[2rem]">
        ARRANCA
      </span>
    </div>
  );
}

function BenefitItem({
  icon,
  title,
  detail,
}: {
  icon: 'bolt' | 'shield' | 'user';
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center px-2 py-2.5 text-center">
      <div className="mb-1 text-[#FFC400]">
        {icon === 'bolt' ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
        {icon === 'shield' ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3 5 6v5c0 4.8 2.9 8.8 7 10 4.1-1.2 7-5.2 7-10V6l-7-3Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
        {icon === 'user' ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 20a8 8 0 0 0-16 0" strokeLinecap="round" />
            <circle cx="12" cy="8" r="4" />
          </svg>
        ) : null}
      </div>

      <div>
        <p className="text-soft-outline text-[0.72rem] font-semibold leading-4 text-on-dark">{title}</p>
        <p className="mt-0.5 text-[0.62rem] leading-3 text-on-dark-muted">{detail}</p>
      </div>
    </div>
  );
}

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
      <main className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="h-2.5 w-2.5 rounded-full bg-[#FFC400] shadow-[0_0_22px_rgba(255,196,0,0.75)]" />
      </main>
    );
  }

  return (
    <main className="relative min-h-[100svh] overflow-x-hidden bg-bg text-on-dark">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(250,204,21,0.14),transparent_28%),linear-gradient(180deg,#020617_0%,#07111F_48%,#020617_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_78%,rgba(16,185,129,0.10),transparent_24%)]" />
      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[24rem] flex-col items-center px-5 pb-4 pt-16 text-center sm:max-w-[26rem]">
        <ArrancaLogo />

        <div className="mt-6 w-full">
          <h1 className="hero-readable text-outline mx-auto max-w-[23rem] text-[clamp(2.15rem,8.2vw,4.8rem)] font-black leading-[0.95] text-on-dark">
            <span className="block whitespace-nowrap">
              Un <span style={{ color: ARRANCA_YELLOW }}>impulso</span> para
            </span>
            <span className="block whitespace-nowrap">seguir trabajando.</span>
          </h1>

          <div
            aria-hidden="true"
            className="mx-auto mt-4 h-[5px] w-14 rounded-full"
            style={{ backgroundColor: ARRANCA_YELLOW }}
          />

          <p className="text-soft-outline mt-4 text-lg leading-[1.38] text-on-dark-muted">
            <span className="block">No dejes que un tanque vacío</span>
            <span className="block">
              detenga <span style={{ color: ARRANCA_YELLOW }}>tu día.</span>
            </span>
          </p>

          <p className="mx-auto mt-3 max-w-[21rem] text-[0.78rem] font-medium leading-5 text-on-dark-muted">
            Empieza con <span style={{ color: ARRANCA_YELLOW }}>$200 MXN</span> para gasolina.
            Cumple y tu impulso puede <span style={{ color: ARRANCA_YELLOW }}>subir de nivel.</span>
          </p>
        </div>

        <div className="mt-4 flex w-full flex-col gap-2.5">
          <Link
            href={REGISTER_ROUTE}
            className="button-readable inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl px-6 text-base font-bold transition hover:-translate-y-0.5"
            style={{ backgroundColor: ARRANCA_YELLOW }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#111111" aria-hidden="true">
              <path d="M13.3 2 4.8 13.1h5.1L8.9 22l10.3-12.4h-5.8L13.3 2Z" />
            </svg>
            Solicitar impulso
          </Link>
          <Link
            href={LOGIN_ROUTE}
            className="card-readable inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 text-[0.95rem] font-semibold text-on-dark transition hover:border-white/25"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#FFC400]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 4h8v15H5z" />
              <path d="M7 7h4" />
              <path d="M13 8h3l2.5 2.5v5.2a1.8 1.8 0 0 0 3.6 0V13" />
              <path d="M18.5 10.5 21 13" />
            </svg>
            Mis impulsos
          </Link>
        </div>

        <div className="card-dark-readable mt-3 w-full overflow-hidden rounded-2xl">
          <div className="grid grid-cols-3 divide-x divide-white/8">
            <BenefitItem icon="bolt" title="Rápido" detail="Respuesta en minutos" />
            <BenefitItem icon="shield" title="Claro" detail="Términos simples y justos" />
            <BenefitItem icon="user" title="Hecho para choferes" detail="Como tú" />
          </div>
        </div>

        <p className="mt-3 text-[0.72rem] leading-5 text-on-dark-soft max-[720px]:hidden">
          Cuando tú produces, nosotros también crecemos.
        </p>
      </div>
    </main>
  );
}
