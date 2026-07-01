import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { usuarioId, selfieIneUrl, tarjetaCirculacionUrl, capturaPerfilUrl } = await request.json();

    if (!usuarioId || !selfieIneUrl || !tarjetaCirculacionUrl || !capturaPerfilUrl) {
      return NextResponse.json(
        { error: 'Todos los archivos de verificación son obligatorios.' },
        { status: 400 }
      );
    }

    const usuarioRef = adminDb.collection('usuarios').doc(usuarioId);

    await usuarioRef.update({
      selfieIneUrl,
      tarjetaCirculacionUrl,
      estadoVerificacion: 'pendiente',
    });

    return NextResponse.json({ guardado: true, capturaPerfilUrl });
  } catch (error) {
    console.error('Error en /api/usuarios/kyc:', error);
    return NextResponse.json({ error: 'Error interno al guardar verificación.' }, { status: 500 });
  }
}
