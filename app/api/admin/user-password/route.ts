import { NextRequest, NextResponse } from 'next/server';
import { resetUserPassword } from '@/lib/database';
import { resolveViewer } from '@/lib/viewer';
import { correlationId } from '@/lib/security';
import { isSameOrigin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const requestId = correlationId();
  if (!isSameOrigin(request)) return NextResponse.json({ code: 'FORBIDDEN', error: 'Permintaan tidak diizinkan.', correlation_id: requestId }, { status: 403 });
  const viewer = await resolveViewer(request.nextUrl.searchParams.get('view') ?? undefined);
  if (!viewer || viewer.role !== 'admin') return NextResponse.json({ code: 'FORBIDDEN', error: 'Akses khusus Admin.', correlation_id: requestId }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { targetSlug?: string; newPassword?: string; purpose?: string };
  if (!body.targetSlug || String(body.purpose ?? '').trim().length < 5) return NextResponse.json({ code: 'VALIDATION_FAILED', error: 'Target dan alasan perubahan wajib diisi.', correlation_id: requestId }, { status: 422 });
  try {
    await resetUserPassword(viewer.slug,String(body.targetSlug),String(body.newPassword ?? ''),String(body.purpose).trim(),requestId);
    return NextResponse.json({ message: 'Password berhasil diubah. Semua sesi akun tersebut telah dikeluarkan.', correlation_id: requestId });
  } catch (error) {
    return NextResponse.json({ code: 'VALIDATION_FAILED', error: error instanceof Error ? error.message : 'Password gagal diubah.', correlation_id: requestId }, { status: 422 });
  }
}
