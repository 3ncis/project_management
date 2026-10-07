# Menjalankan AI Job Seeker Dashboard di localhost

## Persyaratan

- Windows 10/11
- Node.js 22.13 atau lebih baru
- npm

## Menjalankan aplikasi

1. Ekstrak ZIP ke folder yang tidak dilayani sebagai folder publik web.
2. Buka PowerShell pada folder hasil ekstrak.
3. Jalankan:

   ```powershell
   npm install
   npm run dev
   ```

4. Buka `http://localhost:3000`.

Folder `.wrangler/state/v3/d1` berisi database lokal dan folder `.wrangler/state/v3/r2` berisi dokumen NIB lokal. Keduanya sudah disertakan supaya data localhost dapat diteruskan. Jangan memindahkan isi kedua folder secara terpisah saat server sedang berjalan.

## Google OAuth

Secret Google **tidak disertakan** di dalam ZIP. Untuk mengaktifkannya pada komputer tujuan, jalankan:

```powershell
node --experimental-strip-types scripts/import-google-oauth.mjs "C:\lokasi\client_secret_....json"
```

Perintah tersebut membuat `.dev.vars`, yang sengaja diabaikan Git dan tidak boleh diunggah. OAuth client harus memiliki callback persis `http://localhost:3000/api/auth/google/callback`. Restart `npm run dev` setelah konfigurasi dibuat.

## Yang sengaja tidak disertakan

- `node_modules`, karena dibuat ulang melalui `npm install`.
- hasil build/cache `.next`, `.vinext`, dan `dist`.
- `.git`, log, arsip lama, cache observability, dan cache browser.
- `.dev.vars`, file OAuth JSON, password, client secret, dan secret lain.

Jangan unggah ZIP ini ke folder web publik karena database lokal dapat berisi data dashboard. Untuk hosting production, gunakan konfigurasi environment/secrets milik penyedia hosting dan database production terpisah.
