import { NextRequest } from 'next/server';
import { getAdminAgentLiveSnapshot } from '@/lib/database';
import { resolveViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const viewer = await resolveViewer(request.nextUrl.searchParams.get('view') ?? undefined);
  if (!viewer || viewer.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Akses khusus Admin.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      let previous = '';
      let heartbeatAt = Date.now();
      const startedAt = Date.now();

      try {
        while (!cancelled && !request.signal.aborted && Date.now() - startedAt < 55_000) {
          const snapshot = await getAdminAgentLiveSnapshot();
          if (cancelled || request.signal.aborted) break;
          const payload = JSON.stringify(snapshot);

          if (payload !== previous) {
            controller.enqueue(encoder.encode(`event: snapshot\ndata: ${payload}\n\n`));
            previous = payload;
          } else if (Date.now() - heartbeatAt > 10_000) {
            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
            heartbeatAt = Date.now();
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch {
        if (!cancelled && !request.signal.aborted) {
          const message = 'Monitoring terputus. Silakan hubungkan kembali.';
          controller.enqueue(encoder.encode(`event: stream-error\ndata: ${JSON.stringify({ message })}\n\n`));
        }
      } finally {
        try { controller.close(); } catch {}
      }
    },
    cancel() { cancelled = true; },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
