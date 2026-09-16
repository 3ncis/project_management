import { redirect } from 'next/navigation';
import Image from 'next/image';
import { BrandMark } from './components/BrandMark';
import { LoginForm } from './components/LoginForm';
import { resolveViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const viewer = await resolveViewer();
  if (viewer) redirect(viewer.role === 'admin' ? '/admin' : '/dashboard');
  return <main className="login-shell"><section className="login-brand-panel"><div className="red-grid" /><BrandMark /><div className="login-copy"><span className="kicker light">AI TENDER & PL OPPORTUNITY DASHBOARD</span><h1>Peluang lebih tepat.<br/><em>Penawaran lebih siap.</em></h1><p>Satu ruang kerja untuk menemukan Tender dan Pengadaan Langsung, menilai kecocokan penyedia, serta melacak penawaran.</p></div><div className="brand-stats"><span><b>2</b>User penyedia</span><span><b>24/7</b>AI assistance</span><span><b>100%</b>Role protected</span></div></section><section className="login-form-panel"><div className="login-card"><span className="login-number">01 / SECURE ACCESS</span><h2>Masuk ke ruang peluang Anda.</h2><p>Gunakan username dan password yang diberikan Administrator. Akses dashboard akan mengikuti role akun Anda.</p><LoginForm /><small className="login-note">Lima percobaan gagal akan mengunci akun sementara selama 15 menit.</small></div><Image className="login-accent" src="/padma-shri-logo.png" width={240} height={240} alt="" aria-hidden="true" /></section></main>;
}
