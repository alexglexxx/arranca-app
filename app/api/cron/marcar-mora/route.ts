// GET /api/cron/marcar-mora
// Pensado para ejecutarse vía cron (ej. crontab en tu VM con curl, una vez al
// día) — revisa préstamos activos cuya fechaLimite ya pasó y los marca como
// "mora", además de marcar al usuario con enMora=true (esto bloquea
// automáticamente nuevos préstamos para ese usuario, según la validación
// en /api/prestamos/solicitar).
//
// Protegido con un secreto simple en query string para que no cualquiera
// pueda llamarlo desde fuera.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const secreto = request.nextUrl.searchParams.get('secreto');

  if (secreto !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const ahora = Date.now();

    // NOTA: igual que en /api/prestamos/solicitar, esta combinación de
    // where + desigualdad en otro campo requiere un índice compuesto en
    // Firestore. Si falla la primera vez, la consola te da el link para crearlo.
    const vencidos = await adminDb
      .collection('prestamos')
      .where('estado', '==', 'activo')
      .where('fechaLimite', '<', ahora)
      .get();

    const batch = adminDb.batch();
    const usuariosAfectados: string[] = [];

    vencidos.docs.forEach((doc) => {
      const prestamo = doc.data();
      batch.update(doc.ref, { estado: 'mora' });

      const usuarioRef = adminDb.collection('usuarios').doc(prestamo.usuarioId);
      batch.update(usuarioRef, { enMora: true });

      usuariosAfectados.push(prestamo.usuarioId);
    });

    await batch.commit();

    return NextResponse.json({
      procesados: vencidos.size,
      usuariosAfectados,
    });
  } catch (error) {
    console.error('Error en /api/cron/marcar-mora:', error);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
