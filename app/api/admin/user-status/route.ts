import { NextRequest, NextResponse } from 'next/server';
import { setUserStatus } from '@/lib/database';
import { resolveViewer } from '@/lib/viewer';
import { correlationId } from '@/lib/security';
import { isSameOrigin } from '@/lib/auth';
import { readJsonObject } from '@/lib/http';

export async function POST(request: NextRequest) {
  const requestId = correlationId();
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Permintaan tidak diizinkan.', correlation_id: requestId }, { status: 403 });
  const viewer = await resolveViewer();
  if (viewer?.role !== 'admin') return NextResponse.json({ error: 'Akses khusus Admin.', correlation_id: requestId }, { status: 403 });
  const body = await readJsonObject(request);
  if (typeof body.targetSlug !== 'string' || !['active', 'inactive'].includes(String(body.status)) || String(body.purpose ?? '').trim().length < 5) return NextResponse.json({ error: 'Target, status, dan alasan wajib diisi.', correlation_id: requestId }, { status: 422 });
  try {
    await setUserStatus(viewer.slug, body.targetSlug, body.status as 'active' | 'inactive', String(body.purpose).trim(), requestId);
    return NextResponse.json({ message: 'Status user diperbarui.', correlation_id: requestId });
  } catch {
    return NextResponse.json({ error: 'Status gagal diperbarui. Periksa akun tujuan.', correlation_id: requestId }, { status: 422 });
  }
}
