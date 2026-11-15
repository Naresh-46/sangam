import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAdmin = pathname.startsWith('/admin');
  const isWorkspace = pathname.startsWith('/workspace');
  const nextResponse = () => NextResponse.next();

  if (isAdmin || isWorkspace) {
    const token = request.cookies.get('ananta_session')?.value;
    let role: string | undefined;
    const configuredSecret = process.env.JWT_SECRET;
    if (token && configuredSecret && configuredSecret.length >= 32) {
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(configuredSecret), { algorithms: ['HS256'] });
        role = typeof payload.role === 'string' ? payload.role : undefined;
      } catch { /* Invalid or expired session: send the visitor to sign in. */ }
    }

    const expectedRole = isAdmin ? 'REGULATOR' : 'ORGANIZATION';
    if (role !== expectedRole) {
      const destination = new URL(role === 'REGULATOR' ? '/admin' : role === 'ORGANIZATION' ? '/workspace' : '/login', request.url);
      if (!role) destination.searchParams.set('next', `${pathname}${search}`);
      return NextResponse.redirect(destination);
    }
  }
  return nextResponse();
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
