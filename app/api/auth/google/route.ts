import { NextRequest, NextResponse } from 'next/server';
import { getSessionViewer, isSameOrigin, SESSION_COOKIE } from '@/lib/auth';
import { getGoogleConfig, GOOGLE_FLOW_COOKIE } from '@/lib/google-account';
import { googleAuthorizationUrl, oauthHash, randomOAuthValue, signOAuthCookie } from '@/lib/google-oauth';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Permintaan tidak diizinkan.' }, { status: 403 });
  const viewer = await getSessionViewer();
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (viewer?.role !== 'admin' || !session) return NextResponse.json({ error: 'Silakan login sebagai Admin.' }, { status: 403 });
  const config = getGoogleConfig();
  if (!config || new URL(config.redirectUri).origin !== request.nextUrl.origin) {
    return NextResponse.redirect(new URL('/admin?google=not-configured#openai', request.url), 303);
  }
  const state = randomOAuthValue();
  const verifier = randomOAuthValue();
  const flow = await signOAuthCookie({ purpose: 'google-flow', state, verifier, sessionHash: await oauthHash(session), expiresAt: Date.now() + 600000 }, config.signingKey);
  const response = NextResponse.redirect(await googleAuthorizationUrl(config, state, verifier), 303);
  response.cookies.set(GOOGLE_FLOW_COOKIE, flow, { httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/api/auth/google', maxAge: 600 });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
