import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type {
  EstadoPrestamo,
  EstadoUsuarioNavegable,
  EstadoUsuarioRouteInfo,
  Prestamo,
  Usuario,
} from '@/types';
import { resolveUserNextRoute } from '@/lib/userRouting';

function tieneKycCompleto(usuario: Usuario): boolean {
  return Boolean(usuario.selfieIneUrl && usuario.tarjetaCirculacionUrl);
}

function ordenarPrestamosPorFechaDesc(
  prestamos: QueryDocumentSnapshot[]
): QueryDocumentSnapshot[] {
  return [...prestamos].sort((a, b) => {
    const fechaA = Number(a.data().fechaSolicitud || 0);
    const fechaB = Number(b.data().fechaSolicitud || 0);
    return fechaB - fechaA;
  });
}

function resolverEstadoConPrestamo(
  usuarioId: string,
  estadoUsuario: Usuario['estadoVerificacion'],
  estadoPrestamo: EstadoPrestamo,
  prestamoId: string
): EstadoUsuarioRouteInfo {
  let estado: EstadoUsuarioNavegable;

  switch (estadoPrestamo) {
    case 'pendiente_revision':
      estado = 'solicitud_en_revision';
      break;
    case 'rechazado':
      estado = 'rechazado';
      break;
    case 'activo':
    case 'aprobado':
    case 'mora':
      estado = 'prestamo_activo';
      break;
    case 'pagado':
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

  const prestamosSnap = await adminDb
    .collection('prestamos')
    .where('usuarioId', '==', usuarioId)
    .limit(20)
    .get();

  const prestamosOrdenados = ordenarPrestamosPorFechaDesc(prestamosSnap.docs);
  const prestamoActual = prestamosOrdenados[0] ?? null;

  if (prestamoActual) {
    return resolverEstadoConPrestamo(
      usuarioId,
      usuario.estadoVerificacion,
      prestamoActual.data().estado as Prestamo['estado'],
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
