import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { getGoogleConnection } from "@/lib/google-account";

const messages: Record<string, string> = {
  connected: "Identitas Google berhasil dihubungkan untuk sesi ini.",
  "not-configured":
    "Konfigurasi Google OAuth belum lengkap atau alamat callback tidak sesuai.",
  "invalid-session": "Sesi Admin berakhir. Silakan login kembali.",
  "invalid-state":
    "Permintaan login tidak valid atau kedaluwarsa. Klik Continue with Google kembali.",
  cancelled: "Login Google dibatalkan. Anda dapat mencoba kembali.",
  failed: "Login Google gagal. Periksa konfigurasi OAuth dan coba kembali.",
};

export async function OpenAIAccountCard({
  user,
  googleStatus,
}: {
  user: ChatGPTUser | null;
  googleStatus?: string;
}) {
  const { configured, account } = await getGoogleConnection();
  const local = process.env.NODE_ENV !== "production";
  const chatGPTUser = local ? null : user;
  return (
    <section className="credential-card" id="openai">
      <div className="section-heading">
        <div>
          <span className="kicker">KHUSUS ROLE ADMIN</span>
          <h2>Koneksi akun</h2>
        </div>
      </div>
      <div
        className="account-signin-card"
        aria-labelledby="account-signin-title"
      >
        <header className="account-signin-heading">
          <h3 id="account-signin-title">
            {account ? "Akun Anda terhubung" : "Hubungkan akun Anda"}
          </h3>
          <p>
            {account
              ? "Kelola identitas akun yang digunakan pada sesi ini."
              : "Masuk dengan akun pilihan Anda melalui halaman resmi penyedia."}
          </p>
        </header>
        {googleStatus && messages[googleStatus] && (
          <p role="status" className="account-signin-message">
            {messages[googleStatus]}
          </p>
        )}
        {account && (
          <div className="account-signin-identity">
            <span className="account-signin-avatar" aria-hidden="true">
              {account.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{account.name}</strong>
              <span>{account.email}</span>
            </div>
            <small>Terhubung</small>
          </div>
        )}
        <form action="/api/auth/google" method="post" target="_top">
          <button
            className="account-provider-button"
            type="submit"
            disabled={!configured}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59A6 6 0 0 1 12 5.96Z"
              />
            </svg>
            {account ? "Ganti akun Google" : "Continue with Google"}
          </button>
        </form>
        {!configured && (
          <p className="account-signin-hint">
            Google belum tersedia. Lengkapi konfigurasi OAuth terlebih dahulu.
          </p>
        )}
        <div className="account-signin-divider">
          <span>ATAU</span>
        </div>
        {chatGPTUser && (
          <div className="account-signin-identity">
            <div>
              <strong>{chatGPTUser.displayName}</strong>
              <span>{chatGPTUser.email}</span>
            </div>
          </div>
        )}
        {local ? (
          <>
            <button
              type="button"
              className="account-continue-button"
              disabled
              aria-describedby="chatgpt-local-note"
            >
              Continue with ChatGPT
            </button>
            <p id="chatgpt-local-note" className="account-signin-hint">
              Login ChatGPT tersedia melalui hosting, bukan localhost.
            </p>
          </>
        ) : (
          <a
            className="account-continue-button"
            href={
              chatGPTUser
                ? chatGPTSignOutPath("/admin#openai")
                : chatGPTSignInPath("/admin#openai")
            }
            target="_top"
          >
            {chatGPTUser ? "Ganti akun ChatGPT" : "Continue with ChatGPT"}
          </a>
        )}
      </div>
    </section>
  );
}
