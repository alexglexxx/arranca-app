import { adminDb } from '@/lib/firebase-admin';
import type {
  EstadoPrestamo,
  EstadoUsuarioNavegable,
  EstadoUsuarioRouteInfo,
  Usuario,
} from '@/types';
import { mapEstadoPrestamoToSolicitud, obtenerSolicitudActualUsuario } from '@/lib/solicitudes';
import { resolveUserNextRoute } from '@/lib/userRouting';

function tieneKycCompleto(usuario: Usuario): boolean {
  return Boolean(usuario.selfieIneUrl && usuario.tarjetaCirculacionUrl);
}

function resolverEstadoConPrestamo(
  usuarioId: string,
  estadoUsuario: Usuario['estadoVerificacion'],
  estadoPrestamo: EstadoPrestamo,
  prestamoId: string
): EstadoUsuarioRouteInfo {
  let estado: EstadoUsuarioNavegable;

  switch (mapEstadoPrestamoToSolicitud(estadoPrestamo)) {
    case 'pendiente':
      estado = 'solicitud_en_revision';
      break;
    case 'rechazada':
      estado = 'rechazado';
      break;
    case 'aprobada':
    case 'vencida':
      estado = 'prestamo_activo';
      break;
    case 'pagada':
    case 'cancelada':
    default:
      estado = 'aprobado';
      break;
  }

  return {
    ok: true,
    usuarioId,
    usuario: { estado },
    estadoUsuario,
    estadoSolicitud: estadoPrestamo,
    estadoPrestamo,
    prestamoId,
    nextRoute: resolveUserNextRoute({ estado, usuarioId, prestamoId }),
  };
}

export async function resolveUserRouteState(
  usuarioId: string
): Promise<EstadoUsuarioRouteInfo> {
  const usuarioSnap = await adminDb.collection('usuarios').doc(usuarioId).get();

  if (!usuarioSnap.exists) {
    const estado: EstadoUsuarioNavegable = 'nuevo';
    return {
      ok: true,
      usuarioId,
      usuario: { estado },
      estadoUsuario: 'sin_usuario',
      estadoSolicitud: 'sin_solicitud',
      estadoPrestamo: 'sin_prestamo',
      prestamoId: null,
      nextRoute: resolveUserNextRoute({ estado, usuarioId }),
    };
  }

  const usuario = { id: usuarioSnap.id, ...usuarioSnap.data() } as Usuario;

  const prestamoActual = await obtenerSolicitudActualUsuario(usuarioId);

  if (prestamoActual) {
    return resolverEstadoConPrestamo(
      usuarioId,
      usuario.estadoVerificacion,
      prestamoActual.rawEstado as EstadoPrestamo,
      prestamoActual.id
    );
  }

  if (!tieneKycCompleto(usuario)) {
    const estado: EstadoUsuarioNavegable =
      usuario.selfieIneUrl || usuario.tarjetaCirculacionUrl
        ? 'kyc_pendiente'
        : 'perfil_incompleto';

    return {
      ok: true,
      usuarioId,
      usuario: { estado },
      estadoUsuario: usuario.estadoVerificacion,
      estadoSolicitud: 'sin_solicitud',
      estadoPrestamo: 'sin_prestamo',
      prestamoId: null,
      nextRoute: resolveUserNextRoute({ estado, usuarioId }),
    };
  }

  const estado: EstadoUsuarioNavegable = 'aprobado';

  return {
    ok: true,
    usuarioId,
    usuario: { estado },
    estadoUsuario: usuario.estadoVerificacion,
    estadoSolicitud: 'sin_solicitud',
    estadoPrestamo: 'sin_prestamo',
    prestamoId: null,
    nextRoute: resolveUserNextRoute({ estado, usuarioId }),
  };
}
