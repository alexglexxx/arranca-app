'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';

const ARRANCA_LOGO_SRC: string | null = null;

export function AppBrand() {
  const pathname = usePathname();

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <div className="fixed left-4 top-4 z-40">
      {ARRANCA_LOGO_SRC ? (
        <Image
          src={ARRANCA_LOGO_SRC}
          alt="Arranca"
          width={120}
          height={40}
          className="h-8 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] md:h-10"
          priority
        />
      ) : (
        <div className="rounded-full border border-white/15 bg-[rgba(2,6,23,0.72)] px-3 py-1.5 text-sm font-black tracking-tight text-on-dark shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur text-soft-outline">
          Arranca
        </div>
      )}
    </div>
  );
}
