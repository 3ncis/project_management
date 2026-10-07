# Mengaktifkan pilihan akun Google

## Apa yang diperbaiki

Tombol lama Google/Apple/telepon menuju URL login ChatGPT yang sama, bukan Google OAuth. Tombol Google kini menuju Google secara langsung dengan `prompt=select_account`, tanpa `login_hint`, sehingga meminta pemilihan akun. Google tetap mengendalikan tampilan login, misalnya jika belum ada akun yang masuk di browser.

Koneksi ini mengonfirmasi identitas Google untuk sesi Admin yang sudah login. Ini **bukan** login otomatis sebagai Admin, bukan login ChatGPT, dan tidak mengaktifkan OpenAI API. Role dashboard tetap ditentukan oleh login username/password aplikasi. Identitas Google berakhir saat sesi aplikasi berakhir atau logout (maksimal 12 jam); setelah itu hubungkan kembali.

## 1. Buat OAuth Client Google

1. Buka [Google Cloud Console](https://console.cloud.google.com/), pilih/buat project milik Anda.
2. Buka **Google Auth Platform** (atau **APIs & Services → OAuth consent screen**). Isi nama aplikasi, email dukungan, dan kontak developer. Pilih audience sesuai organisasi; untuk akun Gmail pribadi gunakan External.
3. Jika aplikasi masih dalam mode Testing, tambahkan email Gmail yang akan mencoba login pada daftar **Test users**.
4. Di **Clients / Credentials**, buat **OAuth client ID**, jenis **Web application**.
5. Isi **Authorized redirect URIs** persis:

   ```text
   http://localhost:3000/api/auth/google/callback
   ```

   Jangan menambahkan `#openai`, query string, atau garis miring di akhir. Port harus sama dengan aplikasi. `localhost` dan `127.0.0.1` merupakan alamat berbeda. Alur server ini tidak membutuhkan Authorized JavaScript origins.
6. Simpan Client ID dan Client Secret di komputer Anda. Jangan kirim secret ke chat, screenshot, Git, atau kode frontend.

## 2. Konfigurasi localhost

Folder aplikasi: `D:\Job seeker\ai-job-seeker-dashboard`.

Salin `.dev.vars.example` menjadi `.dev.vars` **hanya jika `.dev.vars` belum ada**. Jika sudah ada, tambahkan variabel berikut tanpa menimpa konfigurasi lainnya:

```dotenv
GOOGLE_CLIENT_ID=isi-client-id-anda.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=isi-client-secret-anda
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
OAUTH_SESSION_SECRET=isi-64-karakter-hex-acak
```

Buat `OAUTH_SESSION_SECRET` dengan Node.js (jangan gunakan contoh statis):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Tempel hasilnya langsung ke file lokal, jangan ke chat. `.dev.vars` diabaikan Git. Jangan mengarsipkan atau mengunggahnya ke direktori publik.

Gunakan Node.js 22.13+ (runtime yang diuji: 24.19). Restart server dengan `npm run dev`. Login aplikasi sebagai Admin, buka **Koneksi akun**, lalu **Continue with Google**. Tombol tetap dinonaktifkan apabila konfigurasi kosong/tidak valid. Pilih akun Google, setujui permintaan identitas dasar, dan pastikan kembali ke `/admin#openai` dengan nama/email yang benar. Tombol **Ganti akun Google** kembali meminta pilihan akun.

Untuk database lokal yang benar-benar baru, atur juga `APP_ADMIN_INITIAL_PASSWORD`, `APP_PADMA_INITIAL_PASSWORD`, dan `APP_ORTYD_INITIAL_PASSWORD` dengan password kuat, berbeda, minimal 12 karakter. Password default development sudah tidak dibuat otomatis. Variabel initial hanya dipakai untuk akun yang belum memiliki password; tidak mengganti password database lama. Akun yang pernah memakai password default harus diganti dari Kelola akun.

## 3. Konfigurasi hosting nanti

Gunakan OAuth client terpisah untuk production. Tambahkan URI berikut pada client production:

```text
https://padma-shri-ai-job-seeker.houseofsorashop.chatgpt.site/api/auth/google/callback
```

Atur empat variabel yang sama melalui pengelola secret/environment hosting, dengan redirect URI HTTPS tersebut dan signing secret baru. Jangan gunakan prefix `NEXT_PUBLIC_`. Publikasikan kode hanya setelah konfigurasi dan pengujian staging siap. Perubahan lokal ini tidak otomatis mengubah situs production.

## Troubleshooting

- `redirect_uri_mismatch`: samakan scheme, host, port, path pada Console dan file konfigurasi.
- Akses ditolak: tambahkan akun ke Test users dan periksa kebijakan organisasi Google.
- Permintaan kedaluwarsa: login aplikasi kembali, klik Google sekali, dan selesaikan dalam 10 menit. Jangan membuka beberapa alur login bersamaan.
- Tombol belum aktif: periksa empat variabel, format signing secret 64 karakter hex, dan restart server.
- Nama akun berubah tetapi AI belum bekerja: OAuth Google bukan API key OpenAI. API memerlukan konfigurasi dan pengujian tersendiri.

## Keamanan dan batas pengujian

Alur memakai authorization code, PKCE S256, state bertanda tangan, cookie HttpOnly/SameSite, pemeriksaan sesi Admin, dan verifikasi email melalui endpoint userinfo Google. Token Google tidak disimpan. Akun tidak boleh mendapat role berdasarkan email Google semata.

Unit test dapat menguji URL, state, cookie, dan respons Google simulasi. Login Google nyata **belum bisa diuji tanpa OAuth Client ID dan Client Secret milik Anda**.

Referensi: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [autentikasi OpenAI API](https://developers.openai.com/api/reference/overview).
