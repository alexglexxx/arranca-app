import { adminDb } from '@/lib/firebase-admin';
import type {
  ActivacionPromocion,
  EstadoActivacionPromocion,
  Promocion,
  TipoRecompensaPromocion,
  TipoTriggerPromocion,
  Usuario,
} from '@/types';

const COLECCION_PROMOCIONES = 'promociones';
const COLECCION_ACTIVACIONES = 'activacionesPromocion';

export type ProcesarEventoPromocionalInput = {
  trigger: TipoTriggerPromocion;
  usuarioId: string;
  referidoId?: string;
  prestamoId?: string;
  metadata?: Record<string, unknown>;
  transaction?: FirebaseFirestore.Transaction;
};

export type ProcesarEventoPromocionalResult = {
  activaciones: ActivacionPromocion[];
  bonoDineroPendiente: number;
};

type PromocionConId = Promocion & { id: string };

type PromocionPreparada = {
  promocion: PromocionConId;
  activacionRef: FirebaseFirestore.DocumentReference;
  activacion: ActivacionPromocion;
  presupuestoDisponibleDespues: number | null;
  agotarPromocion: boolean;
};

export async function procesarEventoPromocional(
  input: ProcesarEventoPromocionalInput
): Promise<ProcesarEventoPromocionalResult> {
  if (input.transaction) {
    return procesarEventoPromocionalEnTransaccion(input.transaction, input);
  }

  return adminDb.runTransaction((transaction) =>
    procesarEventoPromocionalEnTransaccion(transaction, input)
  );
}

async function procesarEventoPromocionalEnTransaccion(
  transaction: FirebaseFirestore.Transaction,
  input: ProcesarEventoPromocionalInput
): Promise<ProcesarEventoPromocionalResult> {
  const ahora = Date.now();
  const promocionesQuery = adminDb
    .collection(COLECCION_PROMOCIONES)
    .where('trigger', '==', input.trigger);
  const usuarioRef = adminDb.collection('usuarios').doc(input.usuarioId);

  const [promocionesSnap, usuarioSnap] = await Promise.all([
    transaction.get(promocionesQuery),
    transaction.get(usuarioRef),
  ]);

  if (!usuarioSnap.exists) {
    return { activaciones: [], bonoDineroPendiente: 0 };
  }

  const usuario = usuarioSnap.data() as Usuario;
  const promocionesActivas = promocionesSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Promocion, 'id'>) }))
    .filter((promocion) => esPromocionVigente(promocion, ahora));

  const preparadas: PromocionPreparada[] = [];
  const promocionesAgotadas: Array<FirebaseFirestore.DocumentReference> = [];

  for (const promocion of promocionesActivas) {
    const activacionRef = adminDb
      .collection(COLECCION_ACTIVACIONES)
      .doc(buildActivacionId({ promocionId: promocion.id, input }));
    const activacionSnap = await transaction.get(activacionRef);

    if (activacionSnap.exists) {
      continue;
    }

    const excedeLimite = await excedeLimitePorUsuario(transaction, promocion, input.usuarioId);
    if (excedeLimite) {
      continue;
    }

    const presupuesto = validarPresupuesto(promocion);
    if (!presupuesto.alcanza) {
      promocionesAgotadas.push(adminDb.collection(COLECCION_PROMOCIONES).doc(promocion.id));
      continue;
    }

    const activacion: ActivacionPromocion = {
      id: activacionRef.id,
      promocionId: promocion.id,
      usuarioId: input.usuarioId,
      referidoId: input.referidoId || null,
      prestamoId: input.prestamoId || null,
      trigger: input.trigger,
      recompensaTipo: promocion.recompensa.tipo,
      cantidad: promocion.recompensa.cantidad,
      estado: getEstadoInicialActivacion(promocion.recompensa.tipo),
      creadoEn: ahora,
      aplicadaEn: promocion.recompensa.tipo === 'bono_dinero' ? null : ahora,
      pagadaEn: null,
      adminUid: null,
      metadata: limpiarMetadata(input.metadata),
    };

    preparadas.push({
      promocion,
      activacionRef,
      activacion,
      presupuestoDisponibleDespues: presupuesto.disponibleDespues,
      agotarPromocion: presupuesto.agotarDespuesDeAplicar,
    });
  }

  const activaciones = preparadas.map((item) => item.activacion);
  const acumulados = sumarRecompensas(activaciones);

  if (activaciones.length > 0) {
    const updateUsuario: Partial<Usuario> = {};

    if (acumulados.bono_dinero > 0) {
      updateUsuario.saldoRecompensas =
        Number(usuario.saldoRecompensas || 0) + acumulados.bono_dinero;
    }

    if (acumulados.impulsos > 0) {
      updateUsuario.impulsosDisponibles =
        Number(usuario.impulsosDisponibles || 0) + acumulados.impulsos;
      updateUsuario.impulsosAcumulados =
        Number(usuario.impulsosAcumulados || 0) + acumulados.impulsos;
    }

    if (acumulados.descuento_comision > 0) {
      updateUsuario.descuentosComisionDisponibles =
        Number(usuario.descuentosComisionDisponibles || 0) + acumulados.descuento_comision;
    }

    if (input.trigger === 'referido_primer_pago_completo') {
      updateUsuario.referidosExitosos = Number(usuario.referidosExitosos || 0) + 1;
    }

    transaction.update(usuarioRef, updateUsuario);
  }

  promocionesAgotadas.forEach((promocionRef) => {
    transaction.update(promocionRef, {
      estado: 'agotada',
      actualizadoEn: ahora,
    });
  });

  preparadas.forEach((item) => {
    const promocionRef = adminDb.collection(COLECCION_PROMOCIONES).doc(item.promocion.id);
    const updatePromocion: Partial<Promocion> = {
      actualizadoEn: ahora,
    };

    if (item.promocion.presupuesto.tipo !== 'ilimitado') {
      updatePromocion.presupuesto = {
        ...item.promocion.presupuesto,
        disponible: item.presupuestoDisponibleDespues,
      };
    }

    if (item.agotarPromocion) {
      updatePromocion.estado = 'agotada';
    }

    transaction.set(item.activacionRef, item.activacion);
    transaction.update(promocionRef, updatePromocion);
  });

  return {
    activaciones,
    bonoDineroPendiente: acumulados.bono_dinero,
  };
}

function esPromocionVigente(promocion: PromocionConId, ahora: number) {
  if (promocion.estado !== 'activa') {
    return false;
  }

  if (Number(promocion.fechaInicio || 0) > ahora) {
    return false;
  }

  if (promocion.fechaFin && Number(promocion.fechaFin) < ahora) {
    return false;
  }

  return Number(promocion.recompensa?.cantidad || 0) > 0;
}

async function excedeLimitePorUsuario(
  transaction: FirebaseFirestore.Transaction,
  promocion: PromocionConId,
  usuarioId: string
) {
  const limite = promocion.limitePorUsuario;
  if (!limite || limite <= 0) {
    return false;
  }

  const activacionesUsuarioSnap = await transaction.get(
    adminDb.collection(COLECCION_ACTIVACIONES).where('usuarioId', '==', usuarioId)
  );
  const activacionesDePromocion = activacionesUsuarioSnap.docs.filter((doc) => {
    const activacion = doc.data() as ActivacionPromocion;
    return activacion.promocionId === promocion.id && activacion.estado !== 'cancelada';
  });

  return activacionesDePromocion.length >= limite;
}

function validarPresupuesto(promocion: PromocionConId) {
  if (promocion.presupuesto.tipo === 'ilimitado') {
    return {
      alcanza: true,
      disponibleDespues: null,
      agotarDespuesDeAplicar: false,
    };
  }

  const disponible = Number(promocion.presupuesto.disponible || 0);
  const cantidad = Number(promocion.recompensa.cantidad || 0);
  if (disponible < cantidad) {
    return {
      alcanza: false,
      disponibleDespues: disponible,
      agotarDespuesDeAplicar: true,
    };
  }

  const disponibleDespues = disponible - cantidad;
  return {
    alcanza: true,
    disponibleDespues,
    agotarDespuesDeAplicar: disponibleDespues === 0,
  };
}

function getEstadoInicialActivacion(
  tipo: TipoRecompensaPromocion
): EstadoActivacionPromocion {
  return tipo === 'bono_dinero' ? 'pendiente' : 'aplicada';
}

function sumarRecompensas(activaciones: ActivacionPromocion[]) {
  return activaciones.reduce(
    (acc, activacion) => {
      acc[activacion.recompensaTipo] += Number(activacion.cantidad || 0);
      return acc;
    },
    {
      bono_dinero: 0,
      impulsos: 0,
      descuento_comision: 0,
    } satisfies Record<TipoRecompensaPromocion, number>
  );
}

function buildActivacionId({
  promocionId,
  input,
}: {
  promocionId: string;
  input: ProcesarEventoPromocionalInput;
}) {
  return [
    promocionId,
    input.trigger,
    input.usuarioId,
    input.referidoId || 'sin-referido',
    input.prestamoId || 'sin-prestamo',
  ]
    .map((value) => value.replace(/[^a-zA-Z0-9_-]/g, '_'))
    .join('__');
}

function limpiarMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
}
