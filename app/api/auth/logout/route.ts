import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, isSameOrigin, revokeSession, SESSION_COOKIE } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Permintaan tidak diizinkan.' }, { status: 403 });
  await revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.redirect(new URL('/',request.url),303);
  clearSessionCookie(response);
  response.cookies.set('pst_google_account', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  response.cookies.set('pst_google_flow', '', { httpOnly: true, sameSite: 'lax', path: '/api/auth/google', maxAge: 0 });
  return response;
}
