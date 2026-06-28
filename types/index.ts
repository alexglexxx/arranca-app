// Tipos centrales del sistema. Reflejan exactamente la estructura de Firestore
// definida en ale-nota-proyecto-arranca.md — cualquier cambio aquí debe reflejarse
// también en las reglas de seguridad de Firestore cuando se definan.

export type EstadoVerificacionUsuario = 'pendiente' | 'verificado' | 'rechazado';

export type EstadoPrestamo =
  | 'pendiente_revision'
  | 'aprobado'
  | 'activo'
  | 'pagado'
  | 'mora'
  | 'rechazado';

export type EstatusAppChofer = 'conectado' | 'bloqueado' | 'no_visible';

export type TipoNotificacion = 'pin' | 'recordatorio' | 'aprobado' | 'rechazado';

export interface Usuario {
  id: string;
  nombre: string;
  telefono: string; // único, indexado — formato E.164 (ej. +5215512345678)
  correo: string;
  ineNumero: string | null; // único, indexado. Null hasta completar KYC fuerte
  cuentaBancaria: string | null; // único, indexado (CLABE 18 dígitos)
  nombreTitularCuenta: string | null;
  estadoVerificacion: EstadoVerificacionUsuario;
  selfieIneUrl: string | null;
  tarjetaCirculacionUrl: string | null;
  placas: string | null; // único, indexado — alerta no bloqueante si se repite
  nivelActual: number; // 1 = anillo $200. Preparado para futuros anillos.
  prestamosCompletados: number;
  enMora: boolean;
  fechaRegistro: number; // timestamp epoch ms
  codigoReferido: string; // código corto único para compartir, ej. "JORGE482"
  referidoPor: string | null; // usuarioId de quien lo refirió, null si nadie
  referidosExitosos: number; // contador de referidos que ya pagaron su primer préstamo
  saldoRecompensas: number; // MXN acumulados por referidos, pendientes de cobrar
  // pinHash/pinExpiracion eliminados — el login ahora lo maneja Firebase Auth
  // (Phone Authentication), no un PIN generado manualmente.
}

export interface ChecklistRevision {
  ineCoincide: boolean;
  cuentaCoincide: boolean;
  appConectada: boolean;
  sinDuplicados: boolean;
  vehiculoVerificado: boolean;
}

export interface Referencia {
  nombre: string;
  telefono: string;
  relacion: string; // ej. "Hermano", "Esposa" para familiar; plataforma para chofer
}

export interface CuestionarioSolicitud {
  plataformas: string[]; // ['uber', 'didi', 'indriver', 'taxi', 'otra']
  tiempoTrabajando: 'menos_6_meses' | '6_meses_2_anos' | 'mas_2_anos';
  turnoPrincipal: 'mañana' | 'tarde' | 'noche' | 'variable';
  diasPorSemana: number;
  ingresoSemanalRango: 'menos_1500' | '1500_3000' | '3000_5000' | 'mas_5000';
  zona: string;
  ciudad: string;
  referenciaFamiliar: Referencia;
  referenciaChofer: Referencia;
}

export interface Prestamo {
  id: string;
  usuarioId: string;
  monto: number; // 200 en esta fase
  montoSiPagaHoy: number; // monto * 1.05
  montoSiPagaFechaLimite: number; // monto * 1.15
  montoSiPagaVencido: number; // monto * 1.20 — aplica si ya pasó la fecha límite
  fechaSolicitud: number;
  fechaAprobacion: number | null;
  fechaLimite: number | null;
  fechaPago: number | null;
  montoFinalPagado: number | null;
  estado: EstadoPrestamo;
  comprobantePagoUrl: string | null;
  cuentaDestino: string;
  videoPerfilUrl: string | null; // verificación de actividad (cada solicitud)
  estatusAppChofer: EstatusAppChofer | null;
  revisadoPor: string | null;
  checklistCompleto: ChecklistRevision | null;
  notasAdmin: string;
  cuestionario: CuestionarioSolicitud;
  aceptoCompromiso: boolean;
  aceptoCompromisoTimestamp: number;
}

export interface ConfiguracionCapital {
  capitalTotal: number;
  capitalPrestado: number;
  capitalDisponible: number;
  topeMaximoPorPrestamo: number;
}

// Reglas de negocio centrales — única fuente de verdad para las tasas.
// Si esto cambia, cambia para TODO el sistema (frontend y backend lo importan).
export const REGLAS_PRESTAMO = {
  MONTO_BASE: 200,
  TASA_PAGO_MISMO_DIA: 0.05,
  TASA_PAGO_FECHA_LIMITE: 0.15,
  TASA_PAGO_VENCIDO: 0.20, // se aplica si paga después de la fecha límite, ya en mora
  DIAS_PLAZO_MAXIMO: 2,
} as const;

export const REFERIDOS = {
  RECOMPENSA_MXN: 50, // se paga cuando el referido liquida su primer préstamo
} as const;

export function calcularMontoConInteres(monto: number, tasa: number): number {
  return Math.round(monto * (1 + tasa));
}

// Determina qué tasa aplica según cuándo se está pagando, comparando contra
// la fecha de aprobación (para "mismo día") y la fecha límite (para
// "a tiempo" vs "vencido"). Centraliza la lógica para que el backend
// (al confirmar pago) y el frontend (al mostrar el monto) coincidan siempre.
export function determinarTasaAplicable(
  fechaAprobacion: number,
  fechaLimite: number,
  fechaPago: number = Date.now()
): number {
  const finDelDiaAprobacion = new Date(fechaAprobacion);
  finDelDiaAprobacion.setHours(23, 59, 59, 999);

  if (fechaPago <= finDelDiaAprobacion.getTime()) {
    return REGLAS_PRESTAMO.TASA_PAGO_MISMO_DIA;
  }
  if (fechaPago <= fechaLimite) {
    return REGLAS_PRESTAMO.TASA_PAGO_FECHA_LIMITE;
  }
  return REGLAS_PRESTAMO.TASA_PAGO_VENCIDO;
}
