import type { EstadoUsuarioNavegable } from '@/types';

interface ResolveUserNextRouteParams {
  estado: EstadoUsuarioNavegable;
  usuarioId: string;
  prestamoId?: string | null;
}

export function resolveUserNextRoute({
  estado,
  usuarioId,
  prestamoId = null,
}: ResolveUserNextRouteParams): string {
  switch (estado) {
    case 'nuevo':
    case 'perfil_incompleto':
    case 'kyc_pendiente':
      return `/kyc?usuarioId=${encodeURIComponent(usuarioId)}`;
    case 'solicitud_en_revision':
    case 'prestamo_activo':
    case 'rechazado':
      return prestamoId ? `/solicitud?solicitudId=${encodeURIComponent(prestamoId)}` : '/solicitud';
    case 'aprobado':
      return '/solicitud';
    default:
      return '/';
  }
}
