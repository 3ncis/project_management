'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function UserManagement({ slug, status, role }: { slug: string; status: string; role: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [message, setMessage] = useState('');

  async function toggle() {
    const nextStatus = status === 'active' ? 'inactive' : 'active';
    const purpose = window.prompt(`Tuliskan alasan perubahan status ${slug} menjadi ${nextStatus}:`);
    if (!purpose?.trim() || !window.confirm(`Konfirmasi perubahan status ${slug} menjadi ${nextStatus}?`)) return;
    setPending(true);
    const response = await fetch('/api/admin/user-status?view=admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetSlug: slug, status: nextStatus, purpose }) });
    setPending(false);
    if (!response.ok) { const result = await response.json() as { error?: string }; setMessage(result.error ?? 'Status gagal diubah.'); return; }
    router.refresh();
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get('newPassword') ?? '');
    if (!window.confirm(`Ganti password akun ${slug} dan keluarkan seluruh sesinya?`)) return;
    setPending(true); setMessage('');
    const response = await fetch('/api/admin/user-password?view=admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetSlug: slug, newPassword, purpose: form.get('purpose') }) });
    const result = await response.json() as { message?: string; error?: string };
    setPending(false); setMessage(result.message ?? result.error ?? 'Permintaan selesai.');
    if (response.ok) { formElement.reset(); setEditingPassword(false); router.refresh(); }
  }

  return <div className="user-actions">
    <div className="user-action-buttons">{role !== 'admin' && <button className="table-action" onClick={toggle} disabled={pending}>{status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</button>}<button className="table-action password-action" onClick={() => { setEditingPassword((value) => !value); setMessage(''); }} disabled={pending}>Ganti password</button></div>
    {editingPassword && <form className="password-reset-form" onSubmit={changePassword}><label>Password baru<input name="newPassword" type="password" minLength={12} autoComplete="new-password" required placeholder="Minimal 12 karakter" /></label><label>Alasan perubahan<input name="purpose" minLength={5} required placeholder="Contoh: reset atas permintaan user" /></label><div><button className="table-action password-action" type="submit" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan password'}</button><button className="table-action" type="button" onClick={() => setEditingPassword(false)}>Batal</button></div></form>}
    {message && <small className="action-message" role="status">{message}</small>}
  </div>;
}
