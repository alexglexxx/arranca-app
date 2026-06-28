// POST /api/usuarios/kyc
// Guarda las URLs de los archivos de verificación fuerte (selfie+INE, video
// de perfil activo) ya subidos a Storage, y marca al usuario como "verificado"
// — listo para pasar a solicitar su primer préstamo.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { usuarioId, selfieIneUrl, tarjetaCirculacionUrl, videoPerfilUrl } = await request.json();

    if (!usuarioId || !selfieIneUrl || !tarjetaCirculacionUrl || !videoPerfilUrl) {
      return NextResponse.json(
        { error: 'usuarioId, selfieIneUrl, tarjetaCirculacionUrl y videoPerfilUrl son obligatorios.' },
        { status: 400 }
      );
    }

    const usuarioRef = adminDb.collection('usuarios').doc(usuarioId);

    await usuarioRef.update({
      selfieIneUrl,
      tarjetaCirculacionUrl,
      estadoVerificacion: 'pendiente', // el admin confirma manualmente en /aprobar
    });

    // El video se guarda como parte del PRIMER préstamo, no del usuario —
    // por eso esta ruta solo regresa la URL para que la pantalla de
    // /solicitar la incluya al crear el préstamo.
    return NextResponse.json({ guardado: true, videoPerfilUrl });
  } catch (error) {
    console.error('Error en /api/usuarios/kyc:', error);
    return NextResponse.json({ error: 'Error interno al guardar verificación.' }, { status: 500 });
  }
}
