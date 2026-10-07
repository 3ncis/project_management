'use client';
import { FormEvent, useMemo, useState } from 'react';
import { requestJson } from '@/lib/http';

type Source = Record<string, string | number | null>;
const PAGE_SIZE = 25;

export function ProcurementSourceManager({ sources, view }: { sources: Source[]; view?: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [active, setActive] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  function resetForm() { setEditingId(null); setLabel(''); setSourceUrl(''); setActive(true); setMessage(''); }
  function edit(source: Source) {
    setEditingId(Number(source.id)); setLabel(String(source.label)); setSourceUrl(String(source.source_url)); setActive(source.status === 'active');
    setMessage('Sumber dipilih. Ubah data lalu simpan.');
    document.getElementById('search-source')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage('');
    const suffix = view ? `?view=${encodeURIComponent(view)}` : '';
    const { ok, result } = await requestJson(`/api/admin/procurement-source${suffix}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceId: editingId, label, sourceUrl, status: active ? 'active' : 'inactive' }),
    });
    setMessage(result.message ?? result.error ?? 'Tidak ada respons.'); setPending(false);
    if (ok) window.location.reload();
  }

  async function remove(source: Source) {
    if (!window.confirm(`Hapus sumber "${String(source.label)}"? Riwayat pencarian tetap tersimpan.`)) return;
    setPending(true); setMessage('');
    const suffix = view ? `?view=${encodeURIComponent(view)}` : '';
    const { ok, result } = await requestJson(`/api/admin/procurement-source${suffix}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceId: Number(source.id) }) });
    setMessage(result.message ?? result.error ?? 'Tidak ada respons.'); setPending(false);
    if (ok) window.location.reload();
  }

  const activeCount = sources.filter((item) => item.status === 'active').length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter((source) => `${source.label ?? ''} ${source.source_url ?? ''}`.toLowerCase().includes(q));
  }, [sources, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return <section className="data-panel procurement-source-panel" id="search-source">
    <div className="section-heading">
      <div><span className="kicker">ADMIN SEARCH CONTROL</span><h2>Kelola sumber SPSE Tender/PL</h2><p>Daftar SPSE resmi INAPROC. Semua sumber aktif tersimpan nasional dan dipindai bergiliran dalam batch aman agar pencarian tidak timeout atau membebani endpoint SPSE.</p></div>
      <span className="record-count">{activeCount} aktif / {sources.length} sumber</span>
    </div>
    <form className="source-form" onSubmit={submit}>
      <label>Nama sumber<input name="label" required minLength={3} maxLength={80} value={label} onChange={(event)=>setLabel(event.target.value)} placeholder="SPSE Kementerian/Lembaga" /></label>
      <label>URL dasar SPSE resmi<input name="sourceUrl" type="url" required value={sourceUrl} onChange={(event)=>setSourceUrl(event.target.value)} placeholder="https://spse.inaproc.id/kemnaker" /></label>
      <label className="source-active-control"><input type="checkbox" checked={active} onChange={(event)=>setActive(event.target.checked)} />Dipakai dalam pencarian</label>
      <div className="source-form-actions"><button className="button button-yellow" type="submit" disabled={pending}>{pending ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : 'Tambah sumber'}</button>{editingId&&<button className="button source-cancel" type="button" onClick={resetForm}>Batal</button>}</div>
    </form>
    {message && <p className="form-message" role="status">{message}</p>}
    <div className="source-toolbar">
      <input type="search" value={query} onChange={(event)=>{ setQuery(event.target.value); setPage(1); }} placeholder="Cari LPSE, instansi, atau URL INAPROC…" aria-label="Cari sumber SPSE" />
      <span>{filtered.length} ditemukan</span>
    </div>
    <div className="source-list">{visible.map((source) => <div key={String(source.id)}>
      <span className={`status-dot ${source.status === 'active' ? 'online' : ''}`}>{String(source.status)}</span>
      <div><strong>{String(source.label)}</strong><a href={String(source.source_url)} target="_blank" rel="noreferrer">{String(source.source_url)} ↗</a></div>
      <small>{source.last_triggered_at ? `Terakhir dipakai ${new Date(String(source.last_triggered_at)).toLocaleString('id-ID')}` : 'Belum pernah dipakai'}</small>
      <div className="source-row-actions"><button className="source-edit" type="button" onClick={()=>edit(source)} disabled={pending}>Edit</button><button className="source-delete" type="button" onClick={()=>remove(source)} disabled={pending}>Hapus</button></div>
    </div>)}</div>
    <div className="source-pagination">
      <button type="button" className="table-action" disabled={safePage<=1} onClick={()=>setPage((p)=>Math.max(1,p-1))}>← Sebelumnya</button>
      <span>Halaman {safePage} / {pageCount}</span>
      <button type="button" className="table-action" disabled={safePage>=pageCount} onClick={()=>setPage((p)=>Math.min(pageCount,p+1))}>Berikutnya →</button>
    </div>
  </section>;
}
