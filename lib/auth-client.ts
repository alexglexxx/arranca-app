import type { User } from 'firebase/auth';
import type { EstadoUsuarioRouteInfo } from '@/types';

export async function getBearerHeaders(
  user: User | null,
  headers: HeadersInit = {}
): Promise<Headers> {
  if (!user) {
    throw new Error('Sesión inválida o expirada.');
  }

  const token = await user.getIdToken();
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set('Authorization', `Bearer ${token}`);

  return mergedHeaders;
}

export async function fetchEstadoUsuario(user: User | null): Promise<EstadoUsuarioRouteInfo> {
  const response = await fetch('/api/usuarios/estado', {
    headers: await getBearerHeaders(user),
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'No se pudo consultar el estado del usuario.');
  }

  return data as EstadoUsuarioRouteInfo;
}
