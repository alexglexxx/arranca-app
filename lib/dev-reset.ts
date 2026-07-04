import type { EstadoPrestamo, EstadoVerificacionUsuario } from '@/types';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

const STORAGE_PREFIXES = [
  'kyc-selfie-ine',
  'kyc-tarjeta-circulacion',
  'kyc-captura-perfil',
] as const;

const ESTADOS_CON_CAPITAL_COMPROMETIDO = new Set<EstadoPrestamo>(['aprobado', 'activo', 'mora']);

const CAMPOS_USUARIO_RESETEADOS = [
  'ineNumero',
  'cuentaBancaria',
  'nombreTitularCuenta',
  'selfieIneUrl',
  'tarjetaCirculacionUrl',
  'placas',
  'estadoVerificacion',
  'enMora',
] as const;

type PrestamoResetInfo = {
  id: string;
  path: string;
  estado: EstadoPrestamo;
  monto: number;
};

export type ResetMiSolicitudResult = {
  uid: string;
  resetAt: string;
  userDocPath: string;
  camposUsuarioReseteados: readonly string[];
  prestamosEliminados: PrestamoResetInfo[];
  archivosBorrados: string[];
  capitalRestaurado: number;
  capitalDocActualizado: string | null;
};

export function isTestResetEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_TEST_RESET === 'true';
}

export async function resetMiSolicitud(uid: string): Promise<ResetMiSolicitudResult> {
  const userRef = adminDb.collection('usuarios').doc(uid);
  const prestamosSnap = await adminDb
    .collection('prestamos')
    .where('usuarioId', '==', uid)
    .get();

  const prestamosEliminados: PrestamoResetInfo[] = prestamosSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      path: doc.ref.path,
      estado: data.estado as EstadoPrestamo,
      monto: Number(data.monto || 0),
    };
  });

  const capitalRestaurado = prestamosEliminados.reduce((total, prestamo) => {
    if (!ESTADOS_CON_CAPITAL_COMPROMETIDO.has(prestamo.estado)) {
      return total;
    }

    return total + prestamo.monto;
  }, 0);

  let capitalDocActualizado: string | null = null;

  const batch = adminDb.batch();

  batch.set(
    userRef,
    {
      ineNumero: null,
      cuentaBancaria: null,
      nombreTitularCuenta: null,
      selfieIneUrl: null,
      tarjetaCirculacionUrl: null,
      placas: null,
      estadoVerificacion: 'pendiente' as EstadoVerificacionUsuario,
      enMora: false,
    },
    { merge: true }
  );

  for (const prestamoDoc of prestamosSnap.docs) {
    batch.delete(prestamoDoc.ref);
  }

  if (capitalRestaurado > 0) {
    const capitalRef = adminDb.collection('configuracion').doc('capital');
    const capitalSnap = await capitalRef.get();

    if (capitalSnap.exists) {
      const capital = capitalSnap.data()!;
      batch.update(capitalRef, {
        capitalPrestado: Math.max(0, Number(capital.capitalPrestado || 0) - capitalRestaurado),
        capitalDisponible: Number(capital.capitalDisponible || 0) + capitalRestaurado,
      });
      capitalDocActualizado = capitalRef.path;
    } else {
      console.warn('[dev-reset-mi-solicitud] No existe configuracion/capital; se omitio el ajuste de capital.', {
        uid,
        capitalRestaurado,
      });
    }
  }

  await batch.commit();

  const archivosBorrados = await borrarArchivosDePrueba(uid);
  const resetAt = new Date().toISOString();

  console.info('[dev-reset-mi-solicitud] Reset completado.', {
    uid,
    resetAt,
    userDocPath: userRef.path,
    prestamosEliminados: prestamosEliminados.map((prestamo) => ({
      id: prestamo.id,
      path: prestamo.path,
      estado: prestamo.estado,
    })),
    camposUsuarioReseteados: [...CAMPOS_USUARIO_RESETEADOS],
    archivosBorrados,
    capitalRestaurado,
    capitalDocActualizado,
  });

  return {
    uid,
    resetAt,
    userDocPath: userRef.path,
    camposUsuarioReseteados: CAMPOS_USUARIO_RESETEADOS,
    prestamosEliminados,
    archivosBorrados,
    capitalRestaurado,
    capitalDocActualizado,
  };
}

async function borrarArchivosDePrueba(uid: string): Promise<string[]> {
  const bucket = adminStorage.bucket();
  const archivosBorrados: string[] = [];

  for (const prefix of STORAGE_PREFIXES) {
    const rutaPrefix = `${prefix}/${uid}/`;

    try {
      const [files] = await bucket.getFiles({ prefix: rutaPrefix });

      for (const file of files) {
        try {
          await file.delete({ ignoreNotFound: true });
          archivosBorrados.push(file.name);
        } catch (error) {
          console.warn('[dev-reset-mi-solicitud] No se pudo borrar archivo de prueba.', {
            uid,
            archivo: file.name,
            error,
          });
        }
      }
    } catch (error) {
      console.warn('[dev-reset-mi-solicitud] No se pudieron listar archivos de prueba.', {
        uid,
        rutaPrefix,
        error,
      });
    }
  }

  return archivosBorrados;
}
