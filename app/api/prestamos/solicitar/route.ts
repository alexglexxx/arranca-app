// POST /api/prestamos/solicitar
// Crea una solicitud de préstamo en estado "pendiente_revision". Aplica las
// validaciones automáticas del checklist (anti-duplicado, mora pendiente)
// ANTES de que llegue al admin — así el admin solo revisa casos que ya
// pasaron el filtro automático básico.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Prestamo, CuestionarioSolicitud } from '@/types';
import { REGLAS_PRESTAMO, calcularMontoConInteres } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const {
      usuarioId,
      cuentaDestino,
      ineNumero,
      nombreTitularCuenta,
      videoPerfilUrl,
      cuestionario,
      aceptoCompromiso,
    } = await request.json();

    if (!usuarioId || !cuentaDestino) {
      return NextResponse.json(
        { error: 'usuarioId y cuentaDestino son obligatorios.' },
        { status: 400 }
      );
    }

    if (!aceptoCompromiso) {
      return NextResponse.json(
        { error: 'Debes aceptar el compromiso de pago para continuar.' },
        { status: 400 }
      );
    }

    const cuestionarioValido = validarCuestionario(cuestionario);
    if (!cuestionarioValido.valido) {
      return NextResponse.json({ error: cuestionarioValido.error }, { status: 400 });
    }

    const usuarioRef = adminDb.collection('usuarios').doc(usuarioId);
    const usuarioSnap = await usuarioRef.get();

    if (!usuarioSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const usuario = usuarioSnap.data()!;

    // Checklist B2: rechazo automático si ya tiene un préstamo en mora sin resolver
    if (usuario.enMora) {
      return NextResponse.json(
        { error: 'Tienes un préstamo anterior sin liquidar. No es posible solicitar otro.' },
        { status: 403 }
      );
    }

    // Checklist B4 / A4 reforzado: no debe tener ya un préstamo activo o pendiente
    // NOTA: esta query combina where + where('in') sobre campos distintos —
    // Firestore pedirá crear un índice compuesto la primera vez que se ejecute.
    // La consola de Firebase te da un link directo para crearlo con un clic
    // cuando aparezca el error "The query requires an index" en los logs.
    const prestamosActivos = await adminDb
      .collection('prestamos')
      .where('usuarioId', '==', usuarioId)
      .where('estado', 'in', ['pendiente_revision', 'aprobado', 'activo'])
      .limit(1)
      .get();

    if (!prestamosActivos.empty) {
      return NextResponse.json(
        { error: 'Ya tienes un préstamo activo o en revisión.' },
        { status: 409 }
      );
    }

    // Checklist A4: si es la primera vez con INE/cuenta, verificar que no estén
    // ya usados por OTRO usuario (posible identidad duplicada)
    if (ineNumero) {
      const ineDuplicado = await adminDb
        .collection('usuarios')
        .where('ineNumero', '==', ineNumero)
        .get();

      const usadoPorOtro = ineDuplicado.docs.some((doc) => doc.id !== usuarioId);
      if (usadoPorOtro) {
        return NextResponse.json(
          { error: 'Este INE ya está registrado con otra cuenta.' },
          { status: 409 }
        );
      }
    }

    if (cuentaDestino) {
      const cuentaDuplicada = await adminDb
        .collection('usuarios')
        .where('cuentaBancaria', '==', cuentaDestino)
        .get();

      const usadaPorOtro = cuentaDuplicada.docs.some((doc) => doc.id !== usuarioId);
      if (usadaPorOtro) {
        return NextResponse.json(
          { error: 'Esta cuenta bancaria ya está registrada con otra cuenta.' },
          { status: 409 }
        );
      }
    }

    // Checklist A2: nombre del INE debe coincidir con titular de cuenta
    // (validación blanda aquí — se marca para que el admin la confirme,
    // no se rechaza automáticamente por riesgo de falsos positivos con acentos/abreviaturas)
    const posibleInconsistenciaNombre =
      nombreTitularCuenta &&
      usuario.nombre &&
      !nombreSimilar(usuario.nombre, nombreTitularCuenta);

    const monto = REGLAS_PRESTAMO.MONTO_BASE;
    const montoSiPagaHoy = calcularMontoConInteres(monto, REGLAS_PRESTAMO.TASA_PAGO_MISMO_DIA);
    const montoSiPagaFechaLimite = calcularMontoConInteres(
      monto,
      REGLAS_PRESTAMO.TASA_PAGO_FECHA_LIMITE
    );
    const montoSiPagaVencido = calcularMontoConInteres(monto, REGLAS_PRESTAMO.TASA_PAGO_VENCIDO);

    const nuevoPrestamo: Omit<Prestamo, 'id'> = {
      usuarioId,
      monto,
      montoSiPagaHoy,
      montoSiPagaFechaLimite,
      montoSiPagaVencido,
      fechaSolicitud: Date.now(),
      fechaAprobacion: null,
      fechaLimite: null,
      fechaPago: null,
      montoFinalPagado: null,
      estado: 'pendiente_revision',
      comprobantePagoUrl: null,
      cuentaDestino,
      videoPerfilUrl: videoPerfilUrl || null,
      estatusAppChofer: null,
      revisadoPor: null,
      checklistCompleto: null,
      notasAdmin: posibleInconsistenciaNombre
        ? 'ALERTA AUTOMÁTICA: el nombre de la cuenta bancaria no coincide claramente con el nombre registrado. Revisar manualmente.'
        : '',
      cuestionario,
      aceptoCompromiso: true,
      aceptoCompromisoTimestamp: Date.now(),
    };

    const docRef = await adminDb.collection('prestamos').add(nuevoPrestamo);

    // Actualiza datos de identidad del usuario si es la primera vez que los manda
    const actualizacionUsuario: Record<string, unknown> = {};
    if (ineNumero && !usuario.ineNumero) actualizacionUsuario.ineNumero = ineNumero;
    if (cuentaDestino && !usuario.cuentaBancaria) actualizacionUsuario.cuentaBancaria = cuentaDestino;
    if (nombreTitularCuenta && !usuario.nombreTitularCuenta) {
      actualizacionUsuario.nombreTitularCuenta = nombreTitularCuenta;
    }
    if (Object.keys(actualizacionUsuario).length > 0) {
      await usuarioRef.update(actualizacionUsuario);
    }

    return NextResponse.json({ prestamoId: docRef.id, estado: 'pendiente_revision' });
  } catch (error) {
    console.error('Error en /api/prestamos/solicitar:', error);
    return NextResponse.json(
      { error: 'Error interno al procesar la solicitud.' },
      { status: 500 }
    );
  }
}

// Comparación simple de nombres — normaliza acentos/mayúsculas y compara por
// palabras en común. No es perfecta a propósito: solo marca para revisión
// humana, no rechaza automáticamente (ver checklist: el admin decide).
function nombreSimilar(nombreA: string, nombreB: string): boolean {
  const normalizar = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter(Boolean);

  const palabrasA = new Set(normalizar(nombreA));
  const palabrasB = normalizar(nombreB);

  const coincidencias = palabrasB.filter((p) => palabrasA.has(p)).length;
  return coincidencias >= 2; // al menos nombre + apellido coinciden
}

// Valida que el cuestionario venga completo, incluyendo las 2 referencias
// obligatorias (familiar + otro chofer) — sin esto, el permiso de contacto
// que el usuario acepta no tendría a quién aplicarse.
function validarCuestionario(
  cuestionario: CuestionarioSolicitud | undefined
): { valido: boolean; error?: string } {
  if (!cuestionario) {
    return { valido: false, error: 'Falta completar el cuestionario.' };
  }

  if (!cuestionario.plataformas || cuestionario.plataformas.length === 0) {
    return { valido: false, error: 'Selecciona al menos una plataforma en la que trabajas.' };
  }

  if (!cuestionario.tiempoTrabajando || !cuestionario.turnoPrincipal) {
    return { valido: false, error: 'Completa los datos de tu actividad como chofer.' };
  }

  if (!cuestionario.ingresoSemanalRango) {
    return { valido: false, error: 'Selecciona tu rango de ingreso semanal.' };
  }

  if (!cuestionario.zona?.trim() || !cuestionario.ciudad?.trim()) {
    return { valido: false, error: 'Completa tu zona y ciudad.' };
  }

  const refFamiliar = cuestionario.referenciaFamiliar;
  if (!refFamiliar?.nombre?.trim() || !refFamiliar?.telefono?.trim()) {
    return { valido: false, error: 'Completa los datos de tu referencia familiar.' };
  }

  const refChofer = cuestionario.referenciaChofer;
  if (!refChofer?.nombre?.trim() || !refChofer?.telefono?.trim()) {
    return { valido: false, error: 'Completa los datos de tu referencia (otro chofer).' };
  }

  return { valido: true };
}
