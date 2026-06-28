import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  const usuarioEsperado = process.env.ADMIN_USER;
  const passwordEsperado = process.env.ADMIN_PASSWORD;

  if (!usuarioEsperado || !passwordEsperado) {
    return new NextResponse('Panel admin no configurado.', { status: 503 });
  }

  if (authHeader) {
    const credenciales = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
    const [usuario, password] = credenciales.split(':');

    if (usuario === usuarioEsperado && password === passwordEsperado) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Acceso requerido.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Panel admin arranca"',
    },
  });
}

export const config = {
  matcher: ['/admin/:path*'],
};
