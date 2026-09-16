'use client';
import { useState } from 'react';

type SearchSource = Record<string, string | number | null> | null;
type SearchRun = Record<string, string | number | null> | null;

export function TenderSearchTrigger({ source, run, view }: { source: SearchSource; run: SearchRun; view?: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function trigger() {
    setPending(true); setMessage('');
    const suffix = view ? `?view=${encodeURIComponent(view)}` : '';
    const response = await fetch(`/api/procurement-search/trigger${suffix}`, { method: 'POST' });
    const result = await response.json() as { message?: string; error?: string };
    setMessage(result.message ?? result.error ?? 'Tidak ada respons.'); setPending(false);
    if (response.ok) window.location.reload();
  }

  return <section className="search-trigger-card">
    <div><span className="kicker light">AI TENDER DISCOVERY</span><h2>Cari pekerjaan terbaru</h2><p>{source ? <>Sumber pencarian: <a href={String(source.source_url)} target="_blank" rel="noreferrer">{String(source.label)} ↗</a></> : 'Admin belum menetapkan URL sumber pencarian.'}</p>{run && <small>Trigger terakhir: {new Date(String(run.triggered_at)).toLocaleString('id-ID')} · <b>{String(run.status)}</b></small>}</div>
    <button className="button button-yellow" type="button" onClick={trigger} disabled={pending || !source}>{pending ? 'Memindai SPSE…' : 'Mulai pencarian Tender/PL'} <span>→</span></button>
    {message && <p className="search-trigger-message" role="status">{message}</p>}
  </section>;
}
