'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandHeader, Button, Field } from '@/components/ui';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCargando(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'No se pudo iniciar sesión.');
        return;
      }

      router.replace('/admin');
      router.refresh();
    } catch {
      setError('No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-8">
      <BrandHeader />

      <div className="mb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber">
          Acceso administrativo
        </p>
        <h1 className="font-display text-[30px] font-semibold leading-[1.1]">
          Entrar al panel
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <Field
          label="Usuario"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />

        <Field
          label="Contraseña"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {error && (
          <p className="mb-4 rounded-[14px] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-auto pt-4">
          <Button type="submit" disabled={cargando}>
            {cargando ? 'Entrando...' : 'Entrar al panel'}
          </Button>
        </div>
      </form>
    </main>
  );
}
