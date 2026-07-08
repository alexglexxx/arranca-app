// Tipos centrales del sistema. Reflejan exactamente la estructura de Firestore
// definida en ale-nota-proyecto-arranca.md — cualquier cambio aquí debe reflejarse
// también en las reglas de seguridad de Firestore cuando se definan.

export type EstadoVerificacionUsuario = 'pendiente' | 'verificado' | 'rechazado';

export type EstadoUsuarioNavegable =
  | 'nuevo'
  | 'perfil_incompleto'
  | 'kyc_pendiente'
  | 'solicitud_en_revision'
  | 'aprobado'
  | 'prestamo_activo'
  | 'rechazado';

export type EstadoPrestamo =
  | 'pendiente_revision'
  | 'aprobado'
  | 'activo'
  | 'pagado'
  | 'mora'
  | 'rechazado'
  | 'cancelada';

export type EstadoSolicitudAdelanto =
  | 'pendiente'
  | 'aprobada'
  | 'rechazada'
  | 'cancelada'
  | 'pagada'
  | 'vencida';

export type EstadoSolicitudActual = EstadoSolicitudAdelanto | 'sin_solicitud';

export type MetodoPagoManual = 'transferencia' | 'efectivo' | 'otro';

export type EstadoRevisionComprobante =
  | 'sin_comprobante'
  | 'pendiente_revision'
  | 'validado'
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
  impulsosDisponibles?: number;
  impulsosAcumulados?: number;
  descuentosComisionDisponibles?: number;
  descuentosComisionUsados?: number;
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
  userId?: string;
  monto: number; // 200 en esta fase
  comisionPorcentaje?: number;
  comisionMonto?: number;
  totalAPagar?: number;
  montoSiPagaHoy: number; // monto * 1.05
  montoSiPagaManana?: number; // monto * 1.10
  montoSiPagaFechaLimite: number; // monto * 1.15
  montoSiPagaVencido: number; // monto * 1.20 — aplica si ya pasó la fecha límite
  fechaSolicitud: number;
  actualizadoEn?: number;
  fechaAprobacion: number | null;
  aprobadoEn?: number | null;
  rechazadoEn?: number | null;
  canceladoEn?: number | null;
  vencidoEn?: number | null;
  fechaLimite: number | null;
  fechaPago: number | null;
  pagadoEn?: number | null;
  montoFinalPagado: number | null;
  estado: EstadoPrestamo;
  comprobantePagoUrl: string | null;
  metodoPago?: MetodoPagoManual;
  instruccionesPago?: InstruccionesPagoManual;
  comprobante?: ComprobantePagoManual;
  bitacoraAdmin?: BitacoraAdminEvento[];
  cuentaDestino: string;
  capturaPerfilUrl: string | null;
  estatusAppChofer: EstatusAppChofer | null;
  revisadoPor: string | null;
  decididoPor?: string | null;
  pagadoRegistradoPor?: string | null;
  checklistCompleto: ChecklistRevision | null;
  notasAdmin: string;
  motivoRechazo?: string | null;
  notaAdmin?: string | null;
  esPrueba?: boolean;
  cuestionario: CuestionarioSolicitud | null;
  aceptoCompromiso: boolean;
  aceptoCompromisoTimestamp: number;
}

export interface InstruccionesPagoManual {
  banco?: string;
  titular?: string;
  cuenta?: string;
  clabe?: string;
  referencia?: string;
  nota?: string;
}

export interface ComprobantePagoManual {
  reportadoPorUsuario: boolean;
  reportadoEn?: number | null;
  montoReportado?: number | null;
  metodoReportado?: MetodoPagoManual | null;
  referencia?: string | null;
  notaUsuario?: string | null;
  imagenUrl?: string | null;
  estadoRevision: EstadoRevisionComprobante;
  revisadoPor?: string | null;
  revisadoEn?: number | null;
  notaAdmin?: string | null;
}

export interface BitacoraAdminEvento {
  tipo:
    | 'solicitud_aprobada'
    | 'solicitud_rechazada'
    | 'solicitud_cancelada'
    | 'solicitud_vencida'
    | 'pago_marcado_manual'
    | 'pago_reportado_usuario'
    | 'pago_reportado_admin'
    | 'comprobante_validado'
    | 'comprobante_rechazado';
  actorId: string;
  actorRol: 'admin' | 'usuario';
  creadoEn: number;
  nota?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface SolicitudAdelanto {
  id: string;
  userId: string;
  monto: number;
  comisionPorcentaje: number;
  comisionMonto: number;
  totalAPagar: number;
  estado: EstadoSolicitudAdelanto;
  creadoEn: number;
  actualizadoEn: number;
  aprobadoEn?: number | null;
  rechazadoEn?: number | null;
  canceladoEn?: number | null;
  pagadoEn?: number | null;
  vencidoEn?: number | null;
  decididoPor?: string | null;
  pagadoRegistradoPor?: string | null;
  motivoRechazo?: string | null;
  notaAdmin?: string | null;
  esPrueba?: boolean;
  fechaLimite?: number | null;
  montoSiPagaHoy?: number;
  montoSiPagaManana?: number;
  montoSiPagaFechaLimite?: number;
  montoSiPagaVencido?: number;
  rawEstado?: EstadoPrestamo;
  metodoPago?: MetodoPagoManual;
  instruccionesPago?: InstruccionesPagoManual;
  comprobante?: ComprobantePagoManual;
  bitacoraAdmin?: BitacoraAdminEvento[];
}

export interface SolicitudActualUsuarioResponse {
  ok: true;
  estado: EstadoSolicitudActual;
  tieneSolicitud: boolean;
  solicitud: SolicitudAdelanto | null;
  puedeSolicitar: boolean;
  mensaje: string;
}

export interface HistorialSolicitudResumen {
  id: string;
  fecha: number;
  monto: number;
  totalAPagar: number;
  estado: EstadoSolicitudAdelanto;
  pagadoEn?: number | null;
}

export interface HistorialUsuarioAdminResumen {
  totalSolicitudes: number;
  pagadas: number;
  vencidas: number;
  rechazadas: number;
}

export interface ConfiguracionCapital {
  capitalTotal: number;
  capitalPrestado: number;
  capitalDisponible: number;
  topeMaximoPorPrestamo: number;
}

export interface PagoReferido {
  usuarioId: string;
  monto: number;
  fecha?: number;
  fechaPago?: number;
  metodoPago?: string | null;
  referencia?: string | null;
  adminUid?: string | null;
  estado?: 'pagado';
}

export type TipoTriggerPromocion =
  | 'referido_primer_pago_completo'
  | 'usuario_pago_puntual'
  | 'usuario_completa_kyc'
  | 'racha_pagos_puntuales';

export type TipoRecompensaPromocion =
  | 'bono_dinero'
  | 'impulsos'
  | 'descuento_comision';

export type EstadoPromocion =
  | 'activa'
  | 'pausada'
  | 'agotada'
  | 'finalizada';

export type EstadoActivacionPromocion =
  | 'pendiente'
  | 'aplicada'
  | 'pagada'
  | 'cancelada';

export interface Promocion {
  id: string;
  nombre: string;
  descripcion?: string | null;
  estado: EstadoPromocion;
  trigger: TipoTriggerPromocion;
  recompensa: {
    tipo: TipoRecompensaPromocion;
    cantidad: number;
  };
  presupuesto: {
    tipo: 'dinero' | 'unidades' | 'ilimitado';
    total: number | null;
    disponible: number | null;
  };
  limitePorUsuario?: number | null;
  fechaInicio: number;
  fechaFin?: number | null;
  creadoEn: number;
  actualizadoEn: number;
}

export interface ActivacionPromocion {
  id: string;
  promocionId: string;
  usuarioId: string;
  referidoId?: string | null;
  prestamoId?: string | null;
  trigger: TipoTriggerPromocion;
  recompensaTipo: TipoRecompensaPromocion;
  cantidad: number;
  estado: EstadoActivacionPromocion;
  creadoEn: number;
  aplicadaEn?: number | null;
  pagadaEn?: number | null;
  adminUid?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AdminCapitalResumen {
  ok: true;
  configurado: boolean;
  capitalOperativoTotal: number;
  disponibleParaTransferir: number;
  capitalComprometido: number;
  capitalPrestadoActivo: number;
  totalPorRecuperar: number;
  gananciaEsperada: number;
  gananciaGenerada: number | null;
  bonosReferidosPendientes: number;
  bonosReferidosPagados: number | null;
  usuariosConSaldoRecompensa: number;
  disponibleRealDespuesDeBonos: number;
  topeMaximoPorPrestamo: number;
  capitalTotal: number;
  capitalPrestado: number;
  capitalDisponible: number;
  promocionesActivas: number;
  promocionesAgotadas: number;
  activacionesPendientes: number;
  impulsosEmitidos: number;
  bonosDineroPendientes: number;
  presupuestoPromocionalDisponible: number;
}

export interface EstadoUsuarioRouteInfo {
  ok: true;
  usuarioId: string;
  usuario: {
    estado: EstadoUsuarioNavegable;
  };
  estadoUsuario: EstadoVerificacionUsuario | 'sin_usuario';
  estadoSolicitud: EstadoPrestamo | 'sin_solicitud';
  estadoPrestamo: EstadoPrestamo | 'sin_prestamo';
  prestamoId: string | null;
  nextRoute: string;
}

// Reglas de negocio centrales — única fuente de verdad para las tasas.
// Si esto cambia, cambia para TODO el sistema (frontend y backend lo importan).
export const REGLAS_PRESTAMO = {
  MONTO_BASE: 200,
  TASA_PAGO_MISMO_DIA: 0.05,
  TASA_PAGO_DIA_SIGUIENTE: 0.10,
  TASA_PAGO_FECHA_LIMITE: 0.15,
  TASA_PAGO_VENCIDO: 0.20, // se aplica si paga después de la fecha límite, ya en mora
  DIAS_PLAZO_MAXIMO: 3,
} as const;

export const REFERIDOS = {
  RECOMPENSA_MXN: 50, // se paga cuando el referido liquida su primer préstamo
} as const;

export function calcularMontoConInteres(monto: number, tasa: number): number {
  return Math.round(monto * (1 + tasa));
}

export function obtenerResumenImpulsoBase() {
  const monto = REGLAS_PRESTAMO.MONTO_BASE;
  const totalSiPagaHoy = calcularMontoConInteres(monto, REGLAS_PRESTAMO.TASA_PAGO_MISMO_DIA);
  const totalSiPagaManana = calcularMontoConInteres(
    monto,
    REGLAS_PRESTAMO.TASA_PAGO_DIA_SIGUIENTE
  );
  const totalFechaLimite = calcularMontoConInteres(
    monto,
    REGLAS_PRESTAMO.TASA_PAGO_FECHA_LIMITE
  );
  const totalVencido = calcularMontoConInteres(monto, REGLAS_PRESTAMO.TASA_PAGO_VENCIDO);
  const comisionMonto = totalSiPagaHoy - monto;

  return {
    monto,
    comisionMonto,
    ivaMonto: 0,
    totalAPagar: totalSiPagaHoy,
    totalSiPagaHoy,
    totalSiPagaManana,
    totalFechaLimite,
    totalVencido,
    diasPlazoMaximo: REGLAS_PRESTAMO.DIAS_PLAZO_MAXIMO,
  };
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
