export const ADMIN_SESSION_COOKIE_NAME = 'arranca_admin_session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

type AdminSessionPayload = {
  sub: 'admin';
  username: string;
  iat: number;
  exp: number;
  nonce: string;
};

export type VerifiedAdminSession = {
  username: string;
  expiresAt: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function getAdminSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET no está configurado en el servidor.');
  }

  return secret;
}

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function base64UrlDecodeToString(input: string): string {
  return decoder.decode(base64UrlDecodeToBytes(input));
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function importHmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(encoder.encode(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  );
}

async function signPayload(encodedPayload: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    toArrayBuffer(encoder.encode(encodedPayload))
  );
  return base64UrlEncode(new Uint8Array(signature));
}

function isAdminSessionPayload(value: unknown): value is AdminSessionPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as AdminSessionPayload;
  return (
    payload.sub === 'admin' &&
    typeof payload.username === 'string' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number' &&
    typeof payload.nonce === 'string'
  );
}

export async function createAdminSessionToken(username = process.env.ADMIN_USER || 'admin') {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    sub: 'admin',
    username,
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE_SECONDS,
    nonce: createNonce(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signPayload(encodedPayload, getAdminSessionSecret());

  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(
  token: string | null | undefined
): Promise<VerifiedAdminSession | null> {
  if (!token) {
    return null;
  }

  const [encodedPayload, encodedSignature, extra] = token.split('.');
  if (!encodedPayload || !encodedSignature || extra !== undefined) {
    return null;
  }

  const key = await importHmacKey(getAdminSessionSecret(), ['verify']);

  try {
    const isSignatureValid = await crypto.subtle.verify(
      'HMAC',
      key,
      toArrayBuffer(base64UrlDecodeToBytes(encodedSignature)),
      toArrayBuffer(encoder.encode(encodedPayload))
    );

    if (!isSignatureValid) {
      return null;
    }

    const parsedPayload = JSON.parse(base64UrlDecodeToString(encodedPayload));
    if (!isAdminSessionPayload(parsedPayload)) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (parsedPayload.exp <= now) {
      return null;
    }

    return {
      username: parsedPayload.username,
      expiresAt: parsedPayload.exp,
    };
  } catch {
    return null;
  }
}

export async function isAdminSessionValid(token: string | null | undefined): Promise<boolean> {
  const session = await verifyAdminSessionToken(token);
  return session !== null;
}
