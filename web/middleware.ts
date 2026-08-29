import { NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * The product requires a session. The marketing page does not.
 *
 * `/onboarding` moved behind the gate because it spends real FortyGuard calls
 * against a live key, and an open endpoint that costs money per request is a
 * bill waiting to happen.
 *
 * `/replay` stays open on purpose. It renders a committed fixture, costs
 * nothing, and is the one place a visitor can watch the thing work before
 * deciding whether to sign in.
 *
 * The endpoints are gated too, not only the pages that call them. `/api/capture`
 * spends FortyGuard credits and `/api/sandbox` starts a twenty minute emulator
 * run: gating the screen while leaving the endpoint open protects nothing.
 * `/api/auth` is deliberately absent from the matcher, since locking the sign in
 * route behind sign in cannot work.
 */
export default auth((request) => {
  if (request.auth) return NextResponse.next();

  // An API call gets a status it can act on. Redirecting fetch to a login page
  // hands back HTML with a 200, which reads as success to the caller.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  /**
   * Carry the destination through sign in. Dropping it sent every deep link to
   * the dashboard, so clicking a step and signing in landed you on a different
   * page than the one you asked for, which reads as the app redirecting you at
   * random.
   */
  const login = new URL('/login', request.nextUrl.origin);
  const to = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (to !== '/') login.searchParams.set('callbackUrl', to);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: [
    '/app/:path*', '/dashboard', '/onboarding',
    '/api/capture/:path*', '/api/sandbox/:path*', '/api/points/:path*', '/api/geocode/:path*',
    '/api/digest/:path*', '/api/team/:path*',
  ],
};
