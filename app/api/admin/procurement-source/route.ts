import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/auth';
import { deleteProcurementSource, saveProcurementSource } from '@/lib/database';
import { correlationId } from '@/lib/security';
import { resolveViewer } from '@/lib/viewer';
import { normalizeSpseSource } from '@/lib/spse';

function safePublicUrl(value: string) {
  return normalizeSpseSource(value);
}

export async function POST(request: NextRequest) {
  const requestId = correlationId();
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Permintaan tidak diizinkan.', correlation_id: requestId }, { status: 403 });
  const viewer = await resolveViewer(request.nextUrl.searchParams.get('view') ?? undefined);
  if (!viewer || viewer.role !== 'admin') return NextResponse.json({ error: 'Akses khusus Admin.', correlation_id: requestId }, { status: 403 });
  const body = await request.json() as { sourceId?: number | null; label?: string; sourceUrl?: string; status?: string };
  const label = String(body.label ?? '').trim();
  const sourceUrl = safePublicUrl(String(body.sourceUrl ?? '').trim());
  const sourceId = body.sourceId == null ? null : Number(body.sourceId);
  const status = body.status === 'inactive' ? 'inactive' : 'active';
  if (label.length < 3 || label.length > 80 || !sourceUrl) return NextResponse.json({ error: 'Gunakan URL resmi berbentuk https://spse.inaproc.id/nama-lpse.', correlation_id: requestId }, { status: 422 });
  if (sourceId !== null && (!Number.isInteger(sourceId) || sourceId < 1)) return NextResponse.json({ error: 'Sumber tidak valid.', correlation_id: requestId }, { status: 422 });
  try {
    await saveProcurementSource(viewer.slug, { sourceId, label, sourceUrl, status }, requestId);
    return NextResponse.json({ message: sourceId ? 'Sumber pencarian berhasil diperbarui.' : 'Sumber pencarian berhasil ditambahkan.', correlation_id: requestId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sumber gagal disimpan.', correlation_id: requestId }, { status: 422 });
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = correlationId();
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Permintaan tidak diizinkan.', correlation_id: requestId }, { status: 403 });
  const viewer = await resolveViewer(request.nextUrl.searchParams.get('view') ?? undefined);
  if (!viewer || viewer.role !== 'admin') return NextResponse.json({ error: 'Akses khusus Admin.', correlation_id: requestId }, { status: 403 });
  const body = await request.json() as { sourceId?: number };
  const sourceId = Number(body.sourceId);
  if (!Number.isInteger(sourceId) || sourceId < 1) return NextResponse.json({ error: 'Sumber tidak valid.', correlation_id: requestId }, { status: 422 });
  try {
    await deleteProcurementSource(viewer.slug,sourceId,requestId);
    return NextResponse.json({ message: 'Sumber pencarian berhasil dihapus.', correlation_id: requestId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sumber gagal dihapus.', correlation_id: requestId }, { status: 422 });
  }
}
