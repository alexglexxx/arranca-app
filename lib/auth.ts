import { type NextRequest, NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '@/lib/firebase-admin';

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createHttpError(status: number, message: string) {
  return new HttpError(status, message);
}

type AdminActor = {
  kind: 'admin';
  username: string;
};

type UserActor = {
  kind: 'user';
  uid: string;
  token: DecodedIdToken;
};

export type RequestActor = AdminActor | UserActor;

function decodeBasicAuth(request: NextRequest): AdminActor | null {
  const authHeader = request.headers.get('authorization');
  const usuarioEsperado = process.env.ADMIN_USER;
  const passwordEsperado = process.env.ADMIN_PASSWORD;

  if (!authHeader?.startsWith('Basic ') || !usuarioEsperado || !passwordEsperado) {
    return null;
  }

  const encoded = authHeader.slice('Basic '.length).trim();

  try {
    const credenciales = Buffer.from(encoded, 'base64').toString('utf-8');
    const separatorIndex = credenciales.indexOf(':');

    if (separatorIndex === -1) {
      return null;
    }

    const usuario = credenciales.slice(0, separatorIndex);
    const password = credenciales.slice(separatorIndex + 1);

    if (usuario === usuarioEsperado && password === passwordEsperado) {
      return { kind: 'admin', username: usuario };
    }
  } catch {
    return null;
  }

  return null;
}

async function decodeBearerToken(request: NextRequest): Promise<UserActor | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    return null;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { kind: 'user', uid: decoded.uid, token: decoded };
  } catch {
    return null;
  }
}

export async function requireAdmin(request: NextRequest): Promise<AdminActor> {
  const adminActor = decodeBasicAuth(request);

  if (!adminActor) {
    throw new HttpError(401, 'No autorizado.');
  }

  return adminActor;
}

export async function requireUser(request: NextRequest): Promise<UserActor> {
  const userActor = await decodeBearerToken(request);

  if (!userActor) {
    throw new HttpError(401, 'Sesión inválida o expirada.');
  }

  return userActor;
}

export async function requireUserOrAdmin(request: NextRequest): Promise<RequestActor> {
  const adminActor = decodeBasicAuth(request);

  if (adminActor) {
    return adminActor;
  }

  return requireUser(request);
}

export function assertSameUser(actor: UserActor, userId: string) {
  if (actor.uid !== userId) {
    throw new HttpError(403, 'No autorizado para operar sobre otro usuario.');
  }
}

export function assertAdminOrOwner(actor: RequestActor, ownerUserId: string) {
  if (actor.kind === 'admin') {
    return;
  }

  if (actor.uid !== ownerUserId) {
    throw new HttpError(403, 'No autorizado para acceder a este recurso.');
  }
}

export function errorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(fallbackMessage, error);
  return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
}
