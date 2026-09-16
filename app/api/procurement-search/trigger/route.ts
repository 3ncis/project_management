import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/auth';
import { triggerProcurementSearch } from '@/lib/database';
import { correlationId } from '@/lib/security';
import { resolveViewer } from '@/lib/viewer';

export async function POST(request: NextRequest) {
  const requestId = correlationId();
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Permintaan tidak diizinkan.', correlation_id: requestId }, { status: 403 });
  const viewer = await resolveViewer(request.nextUrl.searchParams.get('view') ?? undefined);
  if (!viewer || viewer.role !== 'user') return NextResponse.json({ error: 'Akses khusus User.', correlation_id: requestId }, { status: 403 });
  try {
    const result = await triggerProcurementSearch(viewer.slug, requestId);
    return NextResponse.json({ ...result, message: result.duplicate ? 'Pencarian sedang berjalan.' : `${result.resultCount ?? 0} paket aktif dengan KBLI cocok ditemukan.`, correlation_id: requestId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pencarian gagal dipicu.', correlation_id: requestId }, { status: 422 });
  }
}
