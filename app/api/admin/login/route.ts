import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
} from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

function getAdminCredentials() {
  const username = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error('ADMIN_USER y ADMIN_PASSWORD deben estar configurados en el servidor.');
  }

  return { username, password };
}

async function digest(value: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(value);
  const buffer = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(buffer).set(encoded);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return new Uint8Array(hash);
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([digest(left), digest(right)]);
  let difference = leftDigest.length ^ rightDigest.length;

  for (let index = 0; index < Math.max(leftDigest.length, rightDigest.length); index += 1) {
    difference |= (leftDigest[index] || 0) ^ (rightDigest[index] || 0);
  }

  return difference === 0;
}

export async function POST(request: NextRequest) {
  let body: { username?: unknown; password?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  const usernameInput = typeof body.username === 'string' ? body.username : '';
  const passwordInput = typeof body.password === 'string' ? body.password : '';

  try {
    const credentials = getAdminCredentials();
    const [usernameMatches, passwordMatches] = await Promise.all([
      secureEqual(usernameInput, credentials.username),
      secureEqual(passwordInput, credentials.password),
    ]);

    if (!usernameMatches || !passwordMatches) {
      return NextResponse.json(
        { ok: false, error: 'Usuario o contraseña incorrectos.' },
        { status: 401 }
      );
    }

    const token = await createAdminSessionToken(credentials.username);
    const response = NextResponse.json({ ok: true });

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('Error en POST /api/admin/login:', error);
    return NextResponse.json(
      { ok: false, error: 'Configuración admin incompleta.' },
      { status: 500 }
    );
  }
}
