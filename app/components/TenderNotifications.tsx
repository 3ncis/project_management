'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { requestJson } from '@/lib/http';
type Row = Record<string, string | number | null>;
export function TenderNotifications({ items, slug }: { items: Row[]; slug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  if (!items.length) return null;
  async function read() {
    setPending(true); setMessage('');
    const { ok, result } = await requestJson(`/api/notifications/read?view=${encodeURIComponent(slug)}`, { method: 'POST' });
    setPending(false);
    if (ok) router.refresh();
    else setMessage(result.error ?? 'Notifikasi gagal diperbarui.');
  }
  return <section className="tender-notification"><span className="notification-icon">!</span><div><strong>{items.length} pekerjaan Tender/PL baru ditemukan</strong><p>{items.slice(0, 2).map((item) => String(item.title)).join(' · ')}</p>{message && <p role="alert">{message}</p>}</div><a href="#opportunities">Lihat peluang</a><button onClick={read} disabled={pending}>{pending ? '…' : 'Tandai dibaca'}</button></section>;
}
