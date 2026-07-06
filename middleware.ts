import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE_NAME, isAdminSessionValid } from '@/lib/admin-session';

function isAdminLoginPath(pathname: string) {
  return (
    pathname === '/admin/login' ||
    pathname === '/admin/login/' ||
    pathname === '/api/admin/login' ||
    pathname === '/api/admin/login/'
  );
}

function isAdminLogoutPath(pathname: string) {
  return pathname === '/api/admin/logout' || pathname === '/api/admin/logout/';
}

function isAdminPage(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function isAdminApi(pathname: string) {
  return pathname.startsWith('/api/admin/');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminLoginPath(pathname) || isAdminLogoutPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAdminPage(pathname) && !isAdminApi(pathname)) {
    return NextResponse.next();
  }

  try {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    const isValid = await isAdminSessionValid(token);

    if (isValid) {
      return NextResponse.next();
    }
  } catch (error) {
    console.error('Error validando sesión admin en middleware:', error);

    if (isAdminApi(pathname)) {
      return NextResponse.json(
        { ok: false, error: 'Configuración admin incompleta.' },
        { status: 500 }
      );
    }
  }

  if (isAdminApi(pathname)) {
    return NextResponse.json({ ok: false, error: 'Sesión admin requerida.' }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/admin/login';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
