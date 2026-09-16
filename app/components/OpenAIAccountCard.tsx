import type { ChatGPTUser } from '@/app/chatgpt-auth';
import { chatGPTSignInPath, chatGPTSignOutPath } from '@/app/chatgpt-auth';

export function OpenAIAccountCard({ user }: { user: ChatGPTUser | null }) {
  const connected = Boolean(user);
  const signInPath = chatGPTSignInPath('/admin#openai');

  return <section className="credential-card" id="openai">
    <div className="section-heading">
      <div>
        <span className="kicker">AKUN OPENAI SAAT INI</span>
        <h2>Koneksi OpenAI</h2>
      </div>
      <span className={`status-dot ${connected ? 'online' : ''}`}>
        {connected ? 'Terhubung' : 'Belum terhubung'}
      </span>
    </div>

    {user ? <>
      <p className="muted">Dashboard menggunakan identitas akun ChatGPT yang sedang aktif. Password OpenAI tidak diminta dan tidak disimpan.</p>
      <div className="openai-account">
        <span className="openai-account-avatar" aria-hidden="true">{user.displayName.slice(0, 2).toUpperCase()}</span>
        <div>
          <small>Akun ChatGPT aktif</small>
          <strong>{user.displayName}</strong>
          <span>{user.email}</span>
        </div>
        <a className="button button-ghost" href={chatGPTSignOutPath('/admin#openai')} target="_top">Ganti akun</a>
      </div>
    </> : <div className="openai-login-layout">
      <div className="openai-login-copy">
        <span className="kicker">SECURE OPENAI SIGN-IN</span>
        <h3>Hubungkan akun AI Anda.</h3>
        <p>Gunakan Google, Apple, nomor telepon, atau email yang terdaftar pada akun ChatGPT. Pilihan dan kredensial diproses sepenuhnya di halaman resmi OpenAI.</p>
        <div className="openai-login-safe"><b>AMAN</b><span>Dashboard tidak menerima atau menyimpan password akun Anda.</span></div>
      </div>
      <div className="openai-login-modal" aria-label="Pilihan masuk OpenAI">
        <h3>Log in or sign up</h3>
        <p>Dapatkan respons AI yang lebih cerdas dan gunakan akun ChatGPT Anda.</p>
        <div className="openai-provider-list">
          <a href={signInPath} target="_top"><span className="provider-google" aria-hidden="true">G</span>Continue with Google</a>
          <a href={signInPath} target="_top"><span className="provider-apple" aria-hidden="true">●</span>Continue with Apple</a>
          <a href={signInPath} target="_top"><span className="provider-phone" aria-hidden="true">☎</span>Continue with phone</a>
        </div>
        <div className="openai-or"><span>ATAU</span></div>
        <a className="openai-email-choice" href={signInPath} target="_top">Email address</a>
        <a className="openai-continue" href={signInPath} target="_top">Continue</a>
        <small>Metode login dipilih dan dikonfirmasi pada halaman OpenAI.</small>
      </div>
    </div>}

    <small className="security-note">Koneksi ini digunakan untuk identitas akun. Akses OpenAI API production tetap memakai API key rahasia di server dan tidak menggunakan sesi atau password ChatGPT.</small>
  </section>;
}
