import { NextRequest, NextResponse } from 'next/server';
import { getSessionViewer, SESSION_COOKIE } from '@/lib/auth';
import { getGoogleConfig, GOOGLE_ACCOUNT_COOKIE, GOOGLE_FLOW_COOKIE } from '@/lib/google-account';
import { exchangeGoogleCode, oauthHash, readOAuthCookie, signOAuthCookie } from '@/lib/google-oauth';

export async function GET(request: NextRequest) {
  const finish = (status: string) => {
    const response = NextResponse.redirect(new URL(`/admin?google=${status}#openai`, request.url), 303);
    response.cookies.set(GOOGLE_FLOW_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/api/auth/google', maxAge: 0 });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  };
  try {
    const config = getGoogleConfig();
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (!config || new URL(config.redirectUri).origin !== request.nextUrl.origin) return finish('not-configured');
    if (!session || (await getSessionViewer())?.role !== 'admin') return finish('invalid-session');
    const sessionHash = await oauthHash(session);
    const flow = await readOAuthCookie(request.cookies.get(GOOGLE_FLOW_COOKIE)?.value, config.signingKey, 'google-flow', sessionHash);
    if (!flow || typeof flow.verifier !== 'string' || typeof flow.state !== 'string' || flow.state !== request.nextUrl.searchParams.get('state')) return finish('invalid-state');
    if (request.nextUrl.searchParams.has('error')) return finish('cancelled');
    const code = request.nextUrl.searchParams.get('code');
    if (!code || code.length > 4096) return finish('failed');
    const account = await exchangeGoogleCode(config, code, flow.verifier);
    const value = await signOAuthCookie({ ...account, purpose: 'google-account', sessionHash, expiresAt: Date.now() + 43200000 }, config.signingKey);
    const response = finish('connected');
    response.cookies.set(GOOGLE_ACCOUNT_COOKIE, value, { httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 43200 });
    return response;
  } catch {
    return finish('failed');
  }
}
