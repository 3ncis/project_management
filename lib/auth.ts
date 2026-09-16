import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ensureDatabase } from './database';
import { hashSessionToken, randomSecret, verifyPassword } from './password';

export const SESSION_COOKIE = 'pst_session';
const SESSION_HOURS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export type AppViewer = {
  id: number;
  slug: 'admin' | 'padma' | 'ortyd';
  name: string;
  role: 'admin' | 'user';
  email: string;
};

type LoginRow = AppViewer & {
  username: string | null;
  password_hash: string | null;
  password_salt: string | null;
  status: 'active' | 'inactive';
  failed_login_count: number;
  locked_until: string | null;
};

function d1() { if (!env.DB) throw new Error('Database D1 belum tersedia.'); return env.DB; }

export async function authenticateUser(username: string, password: string, userAgent: string | null) {
  await ensureDatabase();
  const db = d1();
  const normalized = username.trim().toLowerCase();
  const user = await db.prepare(`SELECT id,slug,name,email,role,status,username,password_hash,password_salt,failed_login_count,locked_until FROM users WHERE lower(username)=?`).bind(normalized).first<LoginRow>();
  const now = new Date();
  if (!user || !user.password_hash || !user.password_salt) throw new Error('Username atau password salah.');
  if (user.status !== 'active') throw new Error('Akun dinonaktifkan. Hubungi Administrator.');
  if (user.locked_until && new Date(user.locked_until) > now) throw new Error('Akun dikunci sementara. Coba kembali dalam 15 menit.');
  const valid = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!valid) {
    const failures = (user.failed_login_count ?? 0) + 1;
    const lockedUntil = failures >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : null;
    await db.prepare(`UPDATE users SET failed_login_count=?,locked_until=? WHERE id=?`).bind(failures >= MAX_FAILED_LOGINS ? 0 : failures, lockedUntil, user.id).run();
    throw new Error(lockedUntil ? 'Terlalu banyak percobaan. Akun dikunci selama 15 menit.' : 'Username atau password salah.');
  }
  const token = randomSecret(32);
  const tokenHash = await hashSessionToken(token);
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60_000).toISOString();
  await db.batch([
    db.prepare(`UPDATE users SET failed_login_count=0,locked_until=NULL,last_login_at=? WHERE id=?`).bind(createdAt,user.id),
    db.prepare(`INSERT INTO user_sessions (user_id,token_hash,user_agent,created_at,last_seen_at,expires_at,revoked_at) VALUES (?,?,?,?,?,?,NULL)`).bind(user.id,tokenHash,userAgent?.slice(0,300) ?? null,createdAt,createdAt,expiresAt),
    db.prepare(`DELETE FROM user_sessions WHERE expires_at<? OR revoked_at IS NOT NULL`).bind(createdAt),
  ]);
  return { token, viewer: { id: user.id, slug: user.slug, name: user.name, role: user.role, email: user.email } as AppViewer };
}

export async function getSessionViewer(): Promise<AppViewer | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await ensureDatabase();
  const tokenHash = await hashSessionToken(token);
  const now = new Date().toISOString();
  return d1().prepare(`SELECT u.id,u.slug,u.name,u.email,u.role FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'`).bind(tokenHash,now).first<AppViewer>();
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_HOURS * 60 * 60 });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function revokeSession(token: string | undefined) {
  if (!token) return;
  await ensureDatabase();
  const tokenHash = await hashSessionToken(token);
  await d1().prepare(`UPDATE user_sessions SET revoked_at=? WHERE token_hash=?`).bind(new Date().toISOString(),tokenHash).run();
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
