import { adminDb } from '@/lib/firebase-admin';
import { createHttpError } from '@/lib/auth';
import { procesarEventoPromocional } from '@/lib/promotions';
import type {
  BitacoraAdminEvento,
  ComprobantePagoManual,
  EstadoPrestamo,
  EstadoSolicitudAdelanto,
  HistorialSolicitudResumen,
  HistorialUsuarioAdminResumen,
  InstruccionesPagoManual,
  MetodoPagoManual,
  Prestamo,
  SolicitudAdelanto,
  Usuario,
} from '@/types';
import { REGLAS_PRESTAMO, obtenerResumenImpulsoBase } from '@/types';

const COLECCION_SOLICITUDES = 'prestamos';
const ESTADOS_ACTIVOS_INTERNOS: EstadoPrestamo[] = ['pendiente_revision', 'aprobado', 'activo'];
const ESTADOS_BLOQUEANTES_INTERNOS: EstadoPrestamo[] = [
  ...ESTADOS_ACTIVOS_INTERNOS,
  'mora',
];
const ESTADOS_ACTIVOS_NORMALIZADOS = new Set<EstadoSolicitudAdelanto>(['pendiente', 'aprobada']);
const ESTADOS_RESOLUBLES_PARA_REINTENTO = new Set<EstadoSolicitudAdelanto>([
  'pagada',
  'rechazada',
  'cancelada',
]);
const BITACORA_MAX_EVENTOS = 12;

const RESUMEN_IMPULSO = obtenerResumenImpulsoBase();
const COMISION_PORCENTAJE = REGLAS_PRESTAMO.TASA_PAGO_MISMO_DIA * 100;
const MONTO_BASE = RESUMEN_IMPULSO.monto;
const COMISION_MONTO = RESUMEN_IMPULSO.comisionMonto;
const TOTAL_A_PAGAR = RESUMEN_IMPULSO.totalAPagar;
const TOTAL_PAGO_MANANA = RESUMEN_IMPULSO.totalSiPagaManana;
const TOTAL_FECHA_LIMITE = RESUMEN_IMPULSO.totalFechaLimite;
const TOTAL_VENCIDO = RESUMEN_IMPULSO.totalVencido;
const PLAZO_MAXIMO_MS = REGLAS_PRESTAMO.DIAS_PLAZO_MAXIMO * 24 * 60 * 60 * 1000;

export const INSTRUCCIONES_PAGO: InstruccionesPagoManual = {
  banco: 'BANCO_PENDIENTE',
  titular: 'TITULAR_PENDIENTE',
  cuenta: 'CUENTA_PENDIENTE',
  clabe: 'CLABE_PENDIENTE',
  referencia: 'REFERENCIA_PENDIENTE',
  nota: 'Cuando realices tu pago, envia la referencia para validar tu impulso.',
};

type AdminAction =
  | 'aprobar'
  | 'rechazar'
  | 'cancelar'
  | 'eliminar'
  | 'marcar_pagada'
  | 'marcar_vencida'
  | 'validar_pago_reportado'
  | 'rechazar_comprobante';

type TransitionInput = {
  solicitudId: string;
  accion: AdminAction;
  actorId: string;
  motivoRechazo?: string;
  notaAdmin?: string;
  montoFinalPagado?: number;
};

type RegistrarPagoInput = {
  solicitudId: string;
  actorId: string;
  actorRol: 'admin' | 'usuario';
  ownerUserId?: string;
  montoReportado: number;
  metodoReportado: MetodoPagoManual;
  referencia: string;
  notaUsuario?: string;
  imagenUrl?: string;
};

type SolicitudListItem = SolicitudAdelanto & {
  usuario: Pick<Usuario, 'nombre' | 'telefono' | 'correo'> | null;
  historialUsuario: HistorialUsuarioAdminResumen;
};

export function getSolicitudMontoConfig() {
  return {
    monto: MONTO_BASE,
    comisionPorcentaje: COMISION_PORCENTAJE,
    comisionMonto: COMISION_MONTO,
    totalAPagar: TOTAL_A_PAGAR,
    totalSiPagaHoy: TOTAL_A_PAGAR,
    totalSiPagaManana: TOTAL_PAGO_MANANA,
    totalFechaLimite: TOTAL_FECHA_LIMITE,
    totalVencido: TOTAL_VENCIDO,
    diasPlazoMaximo: REGLAS_PRESTAMO.DIAS_PLAZO_MAXIMO,
  };
}

export function mapEstadoPrestamoToSolicitud(
  estado: EstadoPrestamo | string | null | undefined
): EstadoSolicitudAdelanto {
  switch (estado) {
    case 'pendiente_revision':
      return 'pendiente';
    case 'activo':
    case 'aprobado':
      return 'aprobada';
    case 'pagado':
      return 'pagada';
    case 'mora':
      return 'vencida';
    case 'cancelada':
      return 'cancelada';
    case 'rechazado':
    default:
      return 'rechazada';
  }
}

export function canCreateNewSolicitud(estado: EstadoSolicitudAdelanto | null): boolean {
  if (!estado) {
    return true;
  }

  if (ESTADOS_ACTIVOS_NORMALIZADOS.has(estado)) {
    return false;
  }

  if (estado === 'vencida') {
    return false;
  }

  return ESTADOS_RESOLUBLES_PARA_REINTENTO.has(estado);
}

export async function obtenerSolicitudActualUsuario(uid: string): Promise<SolicitudAdelanto | null> {
  const snapshot = await adminDb
    .collection(COLECCION_SOLICITUDES)
    .where('usuarioId', '==', uid)
    .limit(20)
    .get();

  const ordenados = snapshot.docs.sort((a, b) => {
    const dataA = a.data();
    const dataB = b.data();
    const tsA = Number(dataA.actualizadoEn || dataA.fechaSolicitud || 0);
    const tsB = Number(dataB.actualizadoEn || dataB.fechaSolicitud || 0);
    return tsB - tsA;
  });

  const actual = ordenados[0];
  return actual ? normalizarSolicitud(actual.id, actual.data() as Prestamo) : null;
}

export async function obtenerSolicitudBloqueanteUsuario(
  uid: string
): Promise<SolicitudAdelanto | null> {
  const snapshot = await adminDb
    .collection(COLECCION_SOLICITUDES)
    .where('usuarioId', '==', uid)
    .where('estado', 'in', ESTADOS_BLOQUEANTES_INTERNOS)
    .limit(20)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const ordenados = snapshot.docs.sort((a, b) => {
    const dataA = a.data();
    const dataB = b.data();
    const tsA = Number(dataA.actualizadoEn || dataA.fechaSolicitud || 0);
    const tsB = Number(dataB.actualizadoEn || dataB.fechaSolicitud || 0);
    return tsB - tsA;
  });

  const actual = ordenados[0];
  return normalizarSolicitud(actual.id, actual.data() as Prestamo);
}

export async function obtenerSolicitudPorId(id: string): Promise<SolicitudAdelanto | null> {
  const snap = await adminDb.collection(COLECCION_SOLICITUDES).doc(id).get();

  if (!snap.exists) {
    return null;
  }

  return normalizarSolicitud(snap.id, snap.data() as Prestamo);
}

export async function listarHistorialSolicitudesUsuario(
  uid: string,
  limit = 5
): Promise<HistorialSolicitudResumen[]> {
  const snapshot = await adminDb
    .collection(COLECCION_SOLICITUDES)
    .where('usuarioId', '==', uid)
    .limit(limit)
    .get();

  return snapshot.docs
    .map((doc) => normalizarSolicitud(doc.id, doc.data() as Prestamo))
    .sort((a, b) => b.creadoEn - a.creadoEn)
    .slice(0, limit)
    .map((solicitud) => ({
      id: solicitud.id,
      fecha: solicitud.creadoEn,
      monto: solicitud.monto,
      totalAPagar: solicitud.totalAPagar,
      estado: solicitud.estado,
      pagadoEn: solicitud.pagadoEn || null,
    }));
}

export async function crearSolicitudParaUsuario(uid: string): Promise<SolicitudAdelanto> {
  const usuarioRef = adminDb.collection('usuarios').doc(uid);
  const usuarioSnap = await usuarioRef.get();

  if (!usuarioSnap.exists) {
    throw createHttpError(404, 'Usuario no encontrado.');
  }

  const usuario = usuarioSnap.data() as Usuario;

  if (!usuario.selfieIneUrl || !usuario.tarjetaCirculacionUrl) {
    throw createHttpError(400, 'Completa tu KYC antes de solicitar un adelanto.');
  }

  const activa = await obtenerSolicitudActiva(uid);
  if (activa) {
    throw createHttpError(409, 'Ya tienes una solicitud activa.');
  }

  if (usuario.enMora) {
    throw createHttpError(409, 'Tienes un adelanto vencido. Liquida tu adeudo para volver a solicitar.');
  }

  const ahora = Date.now();
  const nuevaSolicitud: Omit<Prestamo, 'id'> = {
    usuarioId: uid,
    userId: uid,
    monto: MONTO_BASE,
    comisionPorcentaje: COMISION_PORCENTAJE,
    comisionMonto: COMISION_MONTO,
    totalAPagar: TOTAL_A_PAGAR,
    montoSiPagaHoy: TOTAL_A_PAGAR,
    montoSiPagaManana: TOTAL_PAGO_MANANA,
    montoSiPagaFechaLimite: TOTAL_FECHA_LIMITE,
    montoSiPagaVencido: TOTAL_VENCIDO,
    fechaSolicitud: ahora,
    actualizadoEn: ahora,
    fechaAprobacion: null,
    aprobadoEn: null,
    rechazadoEn: null,
    canceladoEn: null,
    fechaLimite: null,
    fechaPago: null,
    pagadoEn: null,
    vencidoEn: null,
    montoFinalPagado: null,
    estado: 'pendiente_revision',
    comprobantePagoUrl: null,
    metodoPago: 'transferencia',
    instruccionesPago: { ...INSTRUCCIONES_PAGO },
    comprobante: buildComprobanteBase(),
    bitacoraAdmin: [],
    cuentaDestino: usuario.cuentaBancaria || '',
    capturaPerfilUrl: null,
    estatusAppChofer: null,
    revisadoPor: null,
    decididoPor: null,
    pagadoRegistradoPor: null,
    checklistCompleto: null,
    notasAdmin: '',
    motivoRechazo: null,
    notaAdmin: null,
    esPrueba: process.env.NODE_ENV !== 'production',
    cuestionario: null,
    aceptoCompromiso: true,
    aceptoCompromisoTimestamp: ahora,
  };

  const docRef = await adminDb.collection(COLECCION_SOLICITUDES).add(nuevaSolicitud);
  return normalizarSolicitud(docRef.id, nuevaSolicitud as Prestamo);
}

export async function reportarPagoSolicitudUsuario(input: {
  solicitudId: string;
  userId: string;
  montoReportado: number;
  metodoReportado: MetodoPagoManual;
  referencia: string;
  notaUsuario?: string;
  imagenUrl?: string;
}): Promise<SolicitudAdelanto> {
  return registrarPagoSolicitud({
    solicitudId: input.solicitudId,
    actorId: input.userId,
    actorRol: 'usuario',
    ownerUserId: input.userId,
    montoReportado: input.montoReportado,
    metodoReportado: input.metodoReportado,
    referencia: input.referencia,
    notaUsuario: input.notaUsuario,
    imagenUrl: input.imagenUrl,
  });
}

export async function reportarPagoSolicitudLegacy(input: {
  solicitudId: string;
  actorId: string;
  actorRol: 'admin' | 'usuario';
  ownerUserId?: string;
  comprobantePagoUrl: string;
  montoReportado?: number;
  referencia?: string;
  notaUsuario?: string;
}): Promise<SolicitudAdelanto> {
  const actual = await obtenerSolicitudPorId(input.solicitudId);

  if (!actual) {
    throw createHttpError(404, 'Solicitud no encontrada.');
  }

  return registrarPagoSolicitud({
    solicitudId: input.solicitudId,
    actorId: input.actorId,
    actorRol: input.actorRol,
    ownerUserId: input.ownerUserId,
    montoReportado: Number(input.montoReportado || actual.totalAPagar || TOTAL_A_PAGAR),
    metodoReportado: 'otro',
    referencia: input.referencia?.trim() || 'comprobante_legacy',
    notaUsuario: input.notaUsuario?.trim() || 'Comprobante enviado desde el flujo legacy.',
    imagenUrl: input.comprobantePagoUrl,
  });
}

export async function listarSolicitudesAdmin(): Promise<SolicitudListItem[]> {
  const snapshot = await adminDb
    .collection(COLECCION_SOLICITUDES)
    .orderBy('fechaSolicitud', 'desc')
    .limit(100)
    .get();

  const usuarioCache = new Map<string, Usuario | null>();
  const historialCache = new Map<string, HistorialUsuarioAdminResumen>();

  return Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data() as Prestamo;
      const usuarioId = data.userId || data.usuarioId;
      const solicitud = normalizarSolicitud(doc.id, data);

      if (!usuarioCache.has(usuarioId)) {
        const usuarioSnap = await adminDb.collection('usuarios').doc(usuarioId).get();
        usuarioCache.set(usuarioId, usuarioSnap.exists ? (usuarioSnap.data() as Usuario) : null);
      }

      if (!historialCache.has(usuarioId)) {
        const resumen = await construirResumenHistorialUsuario(usuarioId, doc.id);
        historialCache.set(usuarioId, resumen);
      }

      const usuario = usuarioCache.get(usuarioId);

      return {
        ...solicitud,
        usuario: usuario
          ? {
              nombre: usuario.nombre,
              telefono: usuario.telefono,
              correo: usuario.correo,
            }
          : null,
        historialUsuario: historialCache.get(usuarioId) || buildHistorialUsuarioVacio(),
      };
    })
  );
}

export async function actualizarEstadoSolicitud(
  input: TransitionInput
): Promise<SolicitudAdelanto> {
  const solicitudRef = adminDb.collection(COLECCION_SOLICITUDES).doc(input.solicitudId);

  return adminDb.runTransaction(async (transaction) => {
    const solicitudSnap = await transaction.get(solicitudRef);

    if (!solicitudSnap.exists) {
      throw createHttpError(404, 'Solicitud no encontrada.');
    }

    const solicitud = solicitudSnap.data() as Prestamo;
    const estadoActual = mapEstadoPrestamoToSolicitud(solicitud.estado);
    validarTransicion(estadoActual, input.accion);

    const usuarioId = solicitud.userId || solicitud.usuarioId;
    const usuarioRef = adminDb.collection('usuarios').doc(usuarioId);
    const usuarioSnap = await transaction.get(usuarioRef);
    const usuario = usuarioSnap.exists ? (usuarioSnap.data() as Usuario) : null;

    const capitalRef = adminDb.collection('configuracion').doc('capital');
    const capitalSnap = await transaction.get(capitalRef);
    const capital = capitalSnap.exists ? capitalSnap.data()! : null;

    const ahora = Date.now();
    const bitacoraActual = normalizarBitacora(solicitud.bitacoraAdmin);
    const comprobanteActual = buildComprobanteBase(solicitud.comprobante);
    const montoFinalPagado = Number(
      input.montoFinalPagado || solicitud.totalAPagar || TOTAL_A_PAGAR
    );
    const baseUpdate: Record<string, unknown> = {
      actualizadoEn: ahora,
      decididoPor: input.actorId,
      revisadoPor: input.actorId,
    };

    switch (input.accion) {
      case 'aprobar': {
        if (capital) {
          if (Number(capital.capitalDisponible || 0) < solicitud.monto) {
            throw createHttpError(400, 'Capital insuficiente para aprobar esta solicitud.');
          }

          transaction.update(capitalRef, {
            capitalPrestado: Number(capital.capitalPrestado || 0) + solicitud.monto,
            capitalDisponible: Number(capital.capitalDisponible || 0) - solicitud.monto,
          });
        }

        transaction.update(solicitudRef, {
          ...baseUpdate,
          estado: 'activo',
          fechaAprobacion: ahora,
          aprobadoEn: ahora,
          fechaLimite: ahora + PLAZO_MAXIMO_MS,
          motivoRechazo: null,
          notaAdmin: null,
          metodoPago: solicitud.metodoPago || 'transferencia',
          instruccionesPago: solicitud.instruccionesPago || { ...INSTRUCCIONES_PAGO },
          bitacoraAdmin: pushBitacora(bitacoraActual, {
            tipo: 'solicitud_aprobada',
            actorId: input.actorId,
            actorRol: 'admin',
            creadoEn: ahora,
            nota: input.notaAdmin || null,
          }),
        });
        break;
      }
      case 'rechazar': {
        const motivo = input.motivoRechazo?.trim() || 'No cumple requisitos mínimos.';
        transaction.update(solicitudRef, {
          ...baseUpdate,
          estado: 'rechazado',
          rechazadoEn: ahora,
          motivoRechazo: motivo,
          notasAdmin: input.notaAdmin || motivo,
          notaAdmin: input.notaAdmin || motivo,
          bitacoraAdmin: pushBitacora(bitacoraActual, {
            tipo: 'solicitud_rechazada',
            actorId: input.actorId,
            actorRol: 'admin',
            creadoEn: ahora,
            nota: input.notaAdmin || motivo,
          }),
        });
        break;
      }
      case 'cancelar': {
        if (capital && (estadoActual === 'aprobada' || estadoActual === 'vencida')) {
          transaction.update(capitalRef, {
            capitalPrestado: Math.max(0, Number(capital.capitalPrestado || 0) - solicitud.monto),
            capitalDisponible: Number(capital.capitalDisponible || 0) + solicitud.monto,
          });
        }

        transaction.update(solicitudRef, {
          ...baseUpdate,
          estado: 'cancelada',
          canceladoEn: ahora,
          notasAdmin: input.notaAdmin || '',
          notaAdmin: input.notaAdmin || '',
          bitacoraAdmin: pushBitacora(bitacoraActual, {
            tipo: 'solicitud_cancelada',
            actorId: input.actorId,
            actorRol: 'admin',
            creadoEn: ahora,
            nota: input.notaAdmin || null,
          }),
        });

        if (usuario) {
          transaction.update(usuarioRef, { enMora: false });
        }
        break;
      }
      case 'eliminar': {
        const montoSolicitud = Number(solicitud.monto || MONTO_BASE);

        if (capital && (estadoActual === 'aprobada' || estadoActual === 'vencida')) {
          transaction.update(capitalRef, {
            capitalPrestado: Math.max(0, Number(capital.capitalPrestado || 0) - montoSolicitud),
            capitalDisponible: Number(capital.capitalDisponible || 0) + montoSolicitud,
          });
        }

        if (usuario) {
          transaction.update(usuarioRef, { enMora: false });
        }

        transaction.delete(solicitudRef);
        return normalizarSolicitud(input.solicitudId, solicitud);
      }
      case 'marcar_pagada':
      case 'validar_pago_reportado': {
        if (input.accion === 'validar_pago_reportado') {
          validarComprobantePendiente(solicitud.comprobante);
        }

        if (capital && (estadoActual === 'aprobada' || estadoActual === 'vencida')) {
          await aplicarRecompensaReferido({
            transaction,
            usuario,
            referidoId: usuarioId,
            prestamoId: input.solicitudId,
            montoFinalPagado,
          });

          transaction.update(capitalRef, {
            capitalPrestado: Math.max(0, Number(capital.capitalPrestado || 0) - solicitud.monto),
            capitalDisponible: Number(capital.capitalDisponible || 0) + solicitud.monto,
          });
        }

        transaction.update(solicitudRef, {
          ...baseUpdate,
          estado: 'pagado',
          fechaPago: ahora,
          pagadoEn: ahora,
          pagadoRegistradoPor: input.actorId,
          montoFinalPagado,
          notasAdmin: input.notaAdmin || '',
          notaAdmin: input.notaAdmin || '',
          comprobante: {
            ...comprobanteActual,
            estadoRevision:
              input.accion === 'validar_pago_reportado'
                ? 'validado'
                : comprobanteActual.estadoRevision,
            revisadoPor: input.actorId,
            revisadoEn: ahora,
            notaAdmin: input.notaAdmin || comprobanteActual.notaAdmin || null,
          },
          bitacoraAdmin: pushBitacora(bitacoraActual, {
            tipo:
              input.accion === 'validar_pago_reportado'
                ? 'comprobante_validado'
                : 'pago_marcado_manual',
            actorId: input.actorId,
            actorRol: 'admin',
            creadoEn: ahora,
            nota: input.notaAdmin || null,
            metadata: { montoFinalPagado },
          }),
        });

        if (usuario) {
          transaction.update(usuarioRef, {
            enMora: false,
            prestamosCompletados: Number(usuario.prestamosCompletados || 0) + 1,
          });
        }
        break;
      }
      case 'marcar_vencida': {
        transaction.update(solicitudRef, {
          ...baseUpdate,
          estado: 'mora',
          vencidoEn: ahora,
          notasAdmin: input.notaAdmin || '',
          notaAdmin: input.notaAdmin || '',
          bitacoraAdmin: pushBitacora(bitacoraActual, {
            tipo: 'solicitud_vencida',
            actorId: input.actorId,
            actorRol: 'admin',
            creadoEn: ahora,
            nota: input.notaAdmin || null,
          }),
        });

        if (usuario) {
          transaction.update(usuarioRef, { enMora: true });
        }
        break;
      }
      case 'rechazar_comprobante': {
        validarComprobantePendiente(solicitud.comprobante);
        const nota = input.notaAdmin?.trim() || 'La informacion reportada no pudo validarse.';

        transaction.update(solicitudRef, {
          ...baseUpdate,
          comprobante: {
            ...comprobanteActual,
            estadoRevision: 'rechazado',
            revisadoPor: input.actorId,
            revisadoEn: ahora,
            notaAdmin: nota,
          },
          notasAdmin: input.notaAdmin || '',
          notaAdmin: input.notaAdmin || '',
          bitacoraAdmin: pushBitacora(bitacoraActual, {
            tipo: 'comprobante_rechazado',
            actorId: input.actorId,
            actorRol: 'admin',
            creadoEn: ahora,
            nota,
          }),
        });
        break;
      }
      default:
        throw createHttpError(400, 'Acción no soportada.');
    }

    const actualizado = await transaction.get(solicitudRef);
    return normalizarSolicitud(actualizado.id, actualizado.data() as Prestamo);
  });
}

export function validarTransicion(
  estadoActual: EstadoSolicitudAdelanto,
  accion: AdminAction
) {
  const transiciones: Record<EstadoSolicitudAdelanto, AdminAction[]> = {
    pendiente: ['aprobar', 'rechazar', 'cancelar', 'eliminar'],
    aprobada: [
      'marcar_pagada',
      'marcar_vencida',
      'cancelar',
      'eliminar',
      'validar_pago_reportado',
      'rechazar_comprobante',
    ],
    rechazada: ['eliminar'],
    cancelada: ['eliminar'],
    pagada: [],
    vencida: ['marcar_pagada', 'eliminar', 'validar_pago_reportado', 'rechazar_comprobante'],
  };

  if (!transiciones[estadoActual].includes(accion)) {
    throw createHttpError(400, 'Transición de estado inválida.');
  }
}

function normalizarSolicitud(id: string, data: Prestamo): SolicitudAdelanto {
  const userId = data.userId || data.usuarioId;
  const creadoEn = Number(data.fechaSolicitud || 0);
  const actualizadoEn = Number(
    data.actualizadoEn ||
      data.pagadoEn ||
      data.fechaPago ||
      data.vencidoEn ||
      data.canceladoEn ||
      data.rechazadoEn ||
      data.aprobadoEn ||
      data.fechaAprobacion ||
      creadoEn
  );

  return {
    id,
    userId,
    monto: Number(data.monto || MONTO_BASE),
    comisionPorcentaje: Number(data.comisionPorcentaje || COMISION_PORCENTAJE),
    comisionMonto: Number(data.comisionMonto || COMISION_MONTO),
    totalAPagar: Number(data.totalAPagar || data.montoSiPagaHoy || TOTAL_A_PAGAR),
    estado: mapEstadoPrestamoToSolicitud(data.estado),
    creadoEn,
    actualizadoEn,
    aprobadoEn: data.aprobadoEn || data.fechaAprobacion || null,
    rechazadoEn: data.rechazadoEn || null,
    canceladoEn: data.canceladoEn || null,
    pagadoEn: data.pagadoEn || data.fechaPago || null,
    vencidoEn: data.vencidoEn || null,
    decididoPor: data.decididoPor || data.revisadoPor || null,
    pagadoRegistradoPor: data.pagadoRegistradoPor || null,
    motivoRechazo: data.motivoRechazo || null,
    notaAdmin: data.notaAdmin || data.notasAdmin || null,
    esPrueba: Boolean(data.esPrueba),
    fechaLimite: data.fechaLimite || null,
    montoSiPagaHoy: Number(data.montoSiPagaHoy || data.totalAPagar || TOTAL_A_PAGAR),
    montoSiPagaManana: Number(data.montoSiPagaManana || TOTAL_PAGO_MANANA),
    montoSiPagaFechaLimite: Number(data.montoSiPagaFechaLimite || TOTAL_FECHA_LIMITE),
    montoSiPagaVencido: Number(data.montoSiPagaVencido || TOTAL_VENCIDO),
    rawEstado: data.estado,
    metodoPago: data.metodoPago || 'transferencia',
    instruccionesPago: data.instruccionesPago || { ...INSTRUCCIONES_PAGO },
    comprobante: normalizarComprobante(data),
    bitacoraAdmin: normalizarBitacora(data.bitacoraAdmin),
  };
}

async function obtenerSolicitudActiva(uid: string): Promise<SolicitudAdelanto | null> {
  const snapshot = await adminDb
    .collection(COLECCION_SOLICITUDES)
    .where('usuarioId', '==', uid)
    .where('estado', 'in', ESTADOS_ACTIVOS_INTERNOS)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return normalizarSolicitud(doc.id, doc.data() as Prestamo);
}

async function registrarPagoSolicitud(input: RegistrarPagoInput): Promise<SolicitudAdelanto> {
  const solicitudRef = adminDb.collection(COLECCION_SOLICITUDES).doc(input.solicitudId);

  return adminDb.runTransaction(async (transaction) => {
    const solicitudSnap = await transaction.get(solicitudRef);

    if (!solicitudSnap.exists) {
      throw createHttpError(404, 'Solicitud no encontrada.');
    }

    const solicitud = solicitudSnap.data() as Prestamo;
    const ownerId = solicitud.userId || solicitud.usuarioId;

    if (input.actorRol === 'usuario' && ownerId !== input.ownerUserId) {
      throw createHttpError(403, 'No puedes reportar pago en esta solicitud.');
    }

    if (input.actorRol === 'admin' && input.ownerUserId && ownerId !== input.ownerUserId) {
      throw createHttpError(403, 'No puedes reportar pago en esta solicitud.');
    }

    const estadoActual = mapEstadoPrestamoToSolicitud(solicitud.estado);
    if (estadoActual !== 'aprobada' && estadoActual !== 'vencida') {
      throw createHttpError(400, 'Esta solicitud no acepta reporte de pago.');
    }

    const ahora = Date.now();
    const comprobante: ComprobantePagoManual = {
      reportadoPorUsuario: true,
      reportadoEn: ahora,
      montoReportado: input.montoReportado,
      metodoReportado: input.metodoReportado,
      referencia: input.referencia,
      notaUsuario: input.notaUsuario?.trim() || null,
      imagenUrl: input.imagenUrl?.trim() || null,
      estadoRevision: 'pendiente_revision',
      revisadoPor: null,
      revisadoEn: null,
      notaAdmin: null,
    };

    transaction.update(solicitudRef, {
      actualizadoEn: ahora,
      comprobante,
      comprobantePagoUrl: input.imagenUrl?.trim() || null,
      bitacoraAdmin: pushBitacora(normalizarBitacora(solicitud.bitacoraAdmin), {
        tipo: input.actorRol === 'admin' ? 'pago_reportado_admin' : 'pago_reportado_usuario',
        actorId: input.actorId,
        actorRol: input.actorRol,
        creadoEn: ahora,
        nota: input.notaUsuario?.trim() || null,
        metadata: {
          montoReportado: input.montoReportado,
          referencia: input.referencia,
          metodoReportado: input.metodoReportado,
        },
      }),
    });

    const actualizado = await transaction.get(solicitudRef);
    return normalizarSolicitud(actualizado.id, actualizado.data() as Prestamo);
  });
}

function normalizarComprobante(data: Prestamo): ComprobantePagoManual {
  if (data.comprobante) {
    return buildComprobanteBase(data.comprobante);
  }

  if (data.comprobantePagoUrl) {
    return buildComprobanteBase({
      reportadoPorUsuario: true,
      imagenUrl: data.comprobantePagoUrl,
      estadoRevision: 'pendiente_revision',
    });
  }

  return buildComprobanteBase();
}

function buildComprobanteBase(
  comprobante?: Partial<ComprobantePagoManual> | null
): ComprobantePagoManual {
  return {
    reportadoPorUsuario: Boolean(comprobante?.reportadoPorUsuario),
    reportadoEn: comprobante?.reportadoEn || null,
    montoReportado: comprobante?.montoReportado ?? null,
    metodoReportado: comprobante?.metodoReportado || null,
    referencia: comprobante?.referencia || null,
    notaUsuario: comprobante?.notaUsuario || null,
    imagenUrl: comprobante?.imagenUrl || null,
    estadoRevision: comprobante?.estadoRevision || 'sin_comprobante',
    revisadoPor: comprobante?.revisadoPor || null,
    revisadoEn: comprobante?.revisadoEn || null,
    notaAdmin: comprobante?.notaAdmin || null,
  };
}

function validarComprobantePendiente(comprobante?: ComprobantePagoManual | null) {
  if (!comprobante || comprobante.estadoRevision !== 'pendiente_revision') {
    throw createHttpError(400, 'No existe un comprobante pendiente de revision.');
  }
}

async function construirResumenHistorialUsuario(
  userId: string,
  solicitudActualId: string
): Promise<HistorialUsuarioAdminResumen> {
  const snapshot = await adminDb
    .collection(COLECCION_SOLICITUDES)
    .where('usuarioId', '==', userId)
    .get();

  return snapshot.docs.reduce(
    (acc, doc) => {
      if (doc.id === solicitudActualId) {
        return acc;
      }

      acc.totalSolicitudes += 1;
      const estado = mapEstadoPrestamoToSolicitud((doc.data() as Prestamo).estado);

      if (estado === 'pagada') acc.pagadas += 1;
      if (estado === 'vencida') acc.vencidas += 1;
      if (estado === 'rechazada') acc.rechazadas += 1;

      return acc;
    },
    buildHistorialUsuarioVacio()
  );
}

function buildHistorialUsuarioVacio(): HistorialUsuarioAdminResumen {
  return {
    totalSolicitudes: 0,
    pagadas: 0,
    vencidas: 0,
    rechazadas: 0,
  };
}

function normalizarBitacora(bitacora: Prestamo['bitacoraAdmin']): BitacoraAdminEvento[] {
  if (!Array.isArray(bitacora)) {
    return [];
  }

  return bitacora
    .filter((item): item is BitacoraAdminEvento => Boolean(item?.tipo && item?.actorId))
    .sort((a, b) => Number(b.creadoEn || 0) - Number(a.creadoEn || 0))
    .slice(0, BITACORA_MAX_EVENTOS);
}

function pushBitacora(
  bitacoraActual: BitacoraAdminEvento[],
  evento: BitacoraAdminEvento
): BitacoraAdminEvento[] {
  return [evento, ...bitacoraActual].slice(0, BITACORA_MAX_EVENTOS);
}

async function aplicarRecompensaReferido({
  transaction,
  usuario,
  referidoId,
  prestamoId,
  montoFinalPagado,
}: {
  transaction: FirebaseFirestore.Transaction;
  usuario: Usuario | null;
  referidoId: string;
  prestamoId: string;
  montoFinalPagado: number;
}) {
  if (!usuario) {
    return 0;
  }

  const esPrimerPrestamoCompletado = Number(usuario.prestamosCompletados || 0) === 0;
  if (!esPrimerPrestamoCompletado || !usuario.referidoPor) {
    return 0;
  }

  const resultado = await procesarEventoPromocional({
    trigger: 'referido_primer_pago_completo',
    usuarioId: usuario.referidoPor,
    referidoId,
    prestamoId,
    transaction,
    metadata: {
      referidoPrestamosCompletados: Number(usuario.prestamosCompletados || 0),
      montoFinalPagado,
    },
  });

  return resultado.bonoDineroPendiente;
}
