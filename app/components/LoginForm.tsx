'use client';
import { FormEvent, useState } from 'react';

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
    const result = await response.json() as { destination?: string; error?: string };
    if (!response.ok || !result.destination) { setMessage(result.error ?? 'Login gagal.'); setPending(false); return; }
    window.location.assign(result.destination);
  }

  return <form className="login-auth-form" onSubmit={submit}>
    <label>Username<input name="username" autoComplete="username" minLength={3} required placeholder="Masukkan username" /></label>
    <label>Password<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" minLength={8} required placeholder="Masukkan password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? 'Sembunyikan' : 'Lihat'}</button></div></label>
    <button className="button button-primary wide" type="submit" disabled={pending}>{pending ? 'Memeriksa akun…' : 'Masuk ke dashboard'} <span>→</span></button>
    {message && <p className="login-error" role="alert">{message}</p>}
  </form>;
}
