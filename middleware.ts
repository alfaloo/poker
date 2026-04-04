import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register'];
const AUTH_API_PREFIX = '/api/auth';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const isPublicRoute = PUBLIC_ROUTES.includes(nextUrl.pathname);
  const isAuthApiRoute = nextUrl.pathname.startsWith(AUTH_API_PREFIX);

  if (isAuthApiRoute) {
    return NextResponse.next();
  }

  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
