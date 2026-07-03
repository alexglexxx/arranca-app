import { NextRequest, NextResponse } from 'next/server';
import { assertSameUser, errorResponse, requireUser } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(request);
    const { usuarioId, selfieIneUrl, tarjetaCirculacionUrl, capturaPerfilUrl } = await request.json();

    assertSameUser(actor, usuarioId);

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
    return errorResponse(error, 'Error en /api/usuarios/kyc:');
  }
}
