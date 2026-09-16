import { NextRequest, NextResponse } from 'next/server';
import { attachSessionCookie, authenticateUser, isSameOrigin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Permintaan tidak diizinkan.' }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  if (username.length < 3 || password.length < 8) return NextResponse.json({ error: 'Username atau password belum valid.' }, { status: 422 });
  try {
    const { token, viewer } = await authenticateUser(username,password,request.headers.get('user-agent'));
    const response = NextResponse.json({ destination: viewer.role === 'admin' ? '/admin' : '/dashboard' }, { headers: { 'cache-control': 'no-store' } });
    attachSessionCookie(response,token);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Login gagal.' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  }
}
