// GET /api/usuarios/me?usuarioId=xxx
// Devuelve los datos del propio usuario autenticado — usado por la pantalla
// de referidos para mostrar su código y saldo acumulado.
//
// NOTA: idealmente esto validaría un token de Firebase Auth en el header
// Authorization en vez de recibir usuarioId como query param (que es
// falsificable). Para este piloto, el riesgo es bajo (solo expone el propio
// código de referido y saldo, no datos sensibles de KYC) — pero si esto
// crece, vale la pena migrar a verificación de ID token con
// adminAuth.verifyIdToken().

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const usuarioId = request.nextUrl.searchParams.get('usuarioId');

    if (!usuarioId) {
      return NextResponse.json({ error: 'usuarioId es obligatorio.' }, { status: 400 });
    }

    const usuarioSnap = await adminDb.collection('usuarios').doc(usuarioId).get();

    if (!usuarioSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const usuario = usuarioSnap.data()!;

    // Solo se devuelven los campos necesarios para la pantalla de referidos
    // — no se manda selfieIneUrl, cuentaBancaria, etc. por esta ruta.
    return NextResponse.json({
      nombre: usuario.nombre,
      codigoReferido: usuario.codigoReferido,
      referidosExitosos: usuario.referidosExitosos || 0,
      saldoRecompensas: usuario.saldoRecompensas || 0,
    });
  } catch (error) {
    console.error('Error en /api/usuarios/me:', error);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
