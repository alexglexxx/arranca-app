// POST /api/usuarios/sincronizar
// Se llama justo después de que Firebase Auth confirma el código SMS.
// Crea el documento de usuario en Firestore (usando el firebaseUid como ID
// del documento, no un ID aleatorio — esto simplifica todo lo demás: ya no
// hay que "buscar por teléfono", el documento del usuario vive en
// usuarios/{firebaseUid} directamente).
//
// Si el usuario ya existía (volvió después de su primer préstamo), no se
// sobreescriben sus datos de verificación ya guardados — solo se actualiza
// nombre/correo por si cambiaron.
//
// Si llega un codigoReferido válido (el chofer entró usando el link/código
// de otro usuario), se registra el vínculo. La recompensa NO se otorga aquí
// — solo se otorga cuando el referido paga su primer préstamo completo
// (ver /api/prestamos/pagar).

import { NextRequest, NextResponse } from 'next/server';
import { assertSameUser, errorResponse, requireUser } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import { resolveUserRouteState } from '@/lib/user-state';
import { Usuario } from '@/types';

export const dynamic = 'force-dynamic';

function generarCodigoReferido(nombre: string): string {
  const primerNombre = (nombre.split(' ')[0] || 'CHOFER').toUpperCase().replace(/[^A-Z]/g, '');
  const sufijo = Math.floor(100 + Math.random() * 900); // 3 dígitos
  return `${primerNombre.slice(0, 8)}${sufijo}`;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(request);
    const { firebaseUid, nombre, correo, telefono, codigoReferido } = await request.json();

    assertSameUser(actor, firebaseUid);

    if (!firebaseUid || !telefono) {
      return NextResponse.json(
        { error: 'firebaseUid y telefono son obligatorios.' },
        { status: 400 }
      );
    }

    const usuarioRef = adminDb.collection('usuarios').doc(firebaseUid);
    const usuarioSnap = await usuarioRef.get();

    if (usuarioSnap.exists) {
      // Usuario ya existía — solo actualiza datos de contacto, no toca KYC
      // ni el código de referido (ya tiene uno asignado desde su primer registro)
      await usuarioRef.update({
        nombre: nombre || usuarioSnap.data()!.nombre,
        correo: correo || usuarioSnap.data()!.correo,
      });
      return NextResponse.json(await resolveUserRouteState(firebaseUid));
    }

    const usuarioPorTelefonoSnap = await adminDb
      .collection('usuarios')
      .where('telefono', '==', telefono)
      .limit(1)
      .get();

    if (!usuarioPorTelefonoSnap.empty) {
      const usuarioExistente = usuarioPorTelefonoSnap.docs[0];

      if (usuarioExistente.id !== firebaseUid) {
        return NextResponse.json(
          {
            error:
              'Ya existe una cuenta con este teléfono asociada a otro identificador. Requiere revisión manual antes de continuar.',
          },
          { status: 409 }
        );
      }
    }

    // Si llegó con un código de referido, buscamos a quién pertenece.
    // No se rechaza el registro si el código no existe o es inválido —
    // simplemente se ignora y el usuario se registra sin referidor.
    let referidoPor: string | null = null;
    if (codigoReferido) {
      const referidorSnap = await adminDb
        .collection('usuarios')
        .where('codigoReferido', '==', codigoReferido.toUpperCase().trim())
        .limit(1)
        .get();

      if (!referidorSnap.empty) {
        const referidorId = referidorSnap.docs[0].id;
        // Evita que alguien se "auto-refiera" si por error manda su propio
        // código (no debería pasar en el flujo normal, pero es una validación
        // barata de tener)
        if (referidorId !== firebaseUid) {
          referidoPor = referidorId;
        }
      }
    }

    const nuevoUsuario: Omit<Usuario, 'id'> = {
      nombre: nombre || '',
      telefono,
      correo: correo || '',
      ineNumero: null,
      cuentaBancaria: null,
      nombreTitularCuenta: null,
      estadoVerificacion: 'pendiente',
      selfieIneUrl: null,
      tarjetaCirculacionUrl: null,
      placas: null,
      nivelActual: 1,
      prestamosCompletados: 0,
      enMora: false,
      fechaRegistro: Date.now(),
      codigoReferido: generarCodigoReferido(nombre || 'CHOFER'),
      referidoPor,
      referidosExitosos: 0,
      saldoRecompensas: 0,
    };

    await usuarioRef.set(nuevoUsuario);

    return NextResponse.json(await resolveUserRouteState(firebaseUid));
  } catch (error) {
    return errorResponse(error, 'Error en /api/usuarios/sincronizar:');
  }
}
