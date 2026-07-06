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

type UserActor = {
  kind: 'user';
  uid: string;
  token: DecodedIdToken;
};

type AdminActor = {
  kind: 'admin';
  uid: string;
  token: DecodedIdToken;
  username: string;
};

export type RequestActor = AdminActor | UserActor;

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

function getAdminUidSet(): Set<string> {
  const fromEnv = process.env.ADMIN_UIDS || '';
  return new Set(
    fromEnv
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function isAdminUid(uid: string): boolean {
  return getAdminUidSet().has(uid);
}

function buildAdminActor(userActor: UserActor): AdminActor {
  const decoded = userActor.token;
  const username =
    decoded.name ||
    decoded.email ||
    decoded.phone_number ||
    decoded.uid;

  return {
    kind: 'admin',
    uid: decoded.uid,
    token: decoded,
    username,
  };
}

function isAdminUser(userActor: UserActor): boolean {
  const decoded = userActor.token as DecodedIdToken & {
    admin?: boolean;
    role?: string;
    roles?: string[];
  };

  if (decoded.admin === true) {
    return true;
  }

  if (decoded.role === 'admin') {
    return true;
  }

  if (Array.isArray(decoded.roles) && decoded.roles.includes('admin')) {
    return true;
  }

  return isAdminUid(decoded.uid);
}

export async function requireAdmin(request: NextRequest): Promise<AdminActor> {
  const userActor = await decodeBearerToken(request);

  if (!userActor) {
    throw new HttpError(401, 'Sesión inválida o expirada.');
  }

  if (!isAdminUser(userActor)) {
    throw new HttpError(403, 'No autorizado.');
  }

  return buildAdminActor(userActor);
}

export async function requireUser(request: NextRequest): Promise<UserActor> {
  const userActor = await decodeBearerToken(request);

  if (!userActor) {
    throw new HttpError(401, 'Sesión inválida o expirada.');
  }

  return userActor;
}

export async function requireUserOrAdmin(request: NextRequest): Promise<RequestActor> {
  const userActor = await requireUser(request);
  if (isAdminUser(userActor)) {
    return buildAdminActor(userActor);
  }

  return userActor;
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
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }

  console.error(fallbackMessage, error);
  return NextResponse.json({ ok: false, error: 'Error interno.' }, { status: 500 });
}
