import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'finwise_session';
const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
]);

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const key = sessionKey();
  if (!token || !key) return false;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return typeof payload.sub === 'string' && payload.sub.length > 0;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/login') {
    return await hasValidSession(request)
      ? NextResponse.redirect(new URL('/', request.url))
      : NextResponse.next();
  }
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const authenticated = await hasValidSession(request);
  if (authenticated) return NextResponse.next();

  // API endpoints must never return protected data to unauthenticated callers.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Silakan login untuk melanjutkan.' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)',
  ],
};
