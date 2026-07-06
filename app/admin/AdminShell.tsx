'use client';

import { ReactNode, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  async function cerrarSesion() {
    setCerrandoSesion(true);

    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
      });
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-bg/95">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="font-display text-[15px] font-semibold">
              arranca<span className="text-amber">.</span> admin
            </p>
            <p className="text-[12px] text-textDim">Panel administrativo</p>
          </div>
          <button
            type="button"
            onClick={cerrarSesion}
            disabled={cerrandoSesion}
            className="shrink-0 rounded-[14px] border border-border px-3.5 py-2 text-[13px] font-semibold text-text transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            {cerrandoSesion ? 'Cerrando...' : 'Cerrar sesión'}
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
