// GET /api/admin/usuarios/[id]
// Devuelve los datos completos de un usuario — usado por la pantalla de
// revisión del admin para mostrar selfie+INE, historial, y datos de contacto.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const usuarioSnap = await adminDb.collection('usuarios').doc(params.id).get();

    if (!usuarioSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ id: usuarioSnap.id, ...usuarioSnap.data() });
  } catch (error) {
    console.error('Error en /api/admin/usuarios/[id]:', error);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
