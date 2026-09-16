'use client';
import { FormEvent, useState } from 'react';

type Source = Record<string, string | number | null>;

export function ProcurementSourceManager({ sources, view }: { sources: Source[]; view?: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [active, setActive] = useState(true);

  function resetForm() {
    setEditingId(null); setLabel(''); setSourceUrl(''); setActive(true); setMessage('');
  }

  function edit(source: Source) {
    setEditingId(Number(source.id));
    setLabel(String(source.label));
    setSourceUrl(String(source.source_url));
    setActive(source.status === 'active');
    setMessage('Sumber dipilih. Ubah data lalu simpan.');
    document.getElementById('search-source')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage('');
    const suffix = view ? `?view=${encodeURIComponent(view)}` : '';
    const response = await fetch(`/api/admin/procurement-source${suffix}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceId: editingId, label, sourceUrl, status: active ? 'active' : 'inactive' }),
    });
    const result = await response.json() as { message?: string; error?: string };
    setMessage(result.message ?? result.error ?? 'Tidak ada respons.'); setPending(false);
    if (response.ok) window.location.reload();
  }

  async function remove(source: Source) {
    if (!window.confirm(`Hapus sumber "${String(source.label)}"? Riwayat pencarian tetap tersimpan.`)) return;
    setPending(true); setMessage('');
    const suffix = view ? `?view=${encodeURIComponent(view)}` : '';
    const response = await fetch(`/api/admin/procurement-source${suffix}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceId: Number(source.id) }) });
    const result = await response.json() as { message?: string; error?: string };
    setMessage(result.message ?? result.error ?? 'Tidak ada respons.'); setPending(false);
    if (response.ok) window.location.reload();
  }

  const activeCount = sources.filter((item) => item.status === 'active').length;
  return <section className="data-panel procurement-source-panel" id="search-source">
    <div className="section-heading"><div><span className="kicker">ADMIN SEARCH CONTROL</span><h2>Kelola sumber SPSE Tender/PL</h2><p>Tambahkan atau edit sumber LPSE resmi. Semua sumber berstatus aktif dipakai bersama ketika User menjalankan pencarian.</p></div><span className="record-count">{activeCount} aktif</span></div>
    <form className="source-form" onSubmit={submit}>
      <label>Nama sumber<input name="label" required minLength={3} maxLength={80} value={label} onChange={(event)=>setLabel(event.target.value)} placeholder="SPSE Kementerian/Lembaga" /></label>
      <label>URL dasar SPSE resmi<input name="sourceUrl" type="url" required value={sourceUrl} onChange={(event)=>setSourceUrl(event.target.value)} placeholder="https://spse.inaproc.id/kemnaker" /></label>
      <label className="source-active-control"><input type="checkbox" checked={active} onChange={(event)=>setActive(event.target.checked)} />Dipakai dalam pencarian</label>
      <div className="source-form-actions"><button className="button button-yellow" type="submit" disabled={pending}>{pending ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : 'Tambah sumber'}</button>{editingId&&<button className="button source-cancel" type="button" onClick={resetForm}>Batal</button>}</div>
    </form>
    {message && <p className="form-message" role="status">{message}</p>}
    <div className="source-list">{sources.map((source) => <div key={String(source.id)}><span className={`status-dot ${source.status === 'active' ? 'online' : ''}`}>{String(source.status)}</span><div><strong>{String(source.label)}</strong><a href={String(source.source_url)} target="_blank" rel="noreferrer">{String(source.source_url)} ↗</a></div><small>{source.last_triggered_at ? `Terakhir dipakai ${new Date(String(source.last_triggered_at)).toLocaleString('id-ID')}` : 'Belum pernah dipakai'}</small><div className="source-row-actions"><button className="source-edit" type="button" onClick={()=>edit(source)} disabled={pending}>Edit</button><button className="source-delete" type="button" onClick={()=>remove(source)} disabled={pending}>Hapus</button></div></div>)}</div>
  </section>;
}
