# Audit dan revisi localhost — 21 September 2026

## Hasil utama

Penyebab pilihan akun Google tidak muncul: tombol Google, Apple, telepon, dan email sebelumnya menunjuk ke URL login ChatGPT yang sama. Tidak ada alur Google OAuth khusus. Implementasi baru memisahkan identitas Google, identitas ChatGPT dari hosting, dan akses OpenAI API. Konfigurasi OAuth serta panduan tersedia di `.dev.vars.example` dan `docs/GOOGLE-LOGIN.md`. Secret asli belum diisi.

## Perbaikan

| Temuan | Revisi lokal |
| --- | --- |
| Tombol provider menyesatkan; akun development dianggap terhubung | Google OAuth server-side dengan `prompt=select_account`, PKCE, state bertanda tangan, pemeriksaan sesi Admin, cookie HttpOnly, verifikasi email. Tombol nonaktif saat konfigurasi belum tersedia. Identitas ChatGPT simulasi tidak dianggap akun nyata. |
| Query `?view=admin` dapat memberi akses Admin saat development | Role selalu berasal dari sesi autentikasi database; parameter preview tidak memberi otorisasi. |
| Password awal development sudah diketahui dari source | Tidak lagi dibuat otomatis; database baru memerlukan password environment minimal 12 karakter. Password database lama tidak diubah. |
| Sesi lama dapat hidup lagi setelah akun nonaktif diaktifkan | Menonaktifkan akun kini juga mencabut sesinya. |
| Form tersangkut jika jaringan/JSON gagal | Helper `requestJson` digunakan bersama oleh login, kelola user, sumber, pencarian, dan notifikasi. |
| JSON `null`/rusak menyebabkan API error | Parser objek bersama diterapkan pada login dan mutasi admin. |
| Duplikasi akses binding D1 | Disatukan pada `db/binding.ts`. |
| Fungsi simpan password OpenAI lama tidak dipakai dan memberi status connected tanpa verifikasi | Fungsi simpan/hapus credential legacy dihilangkan. Tabel dan data lama tidak dihapus. Fallback kunci enkripsi nol juga dihilangkan. |
| Schema `ai_agent_steps` hanya ada pada bootstrap runtime | Ditambahkan pada Drizzle schema dan migrasi 0010, aman jika tabel/index sudah ada. |
| Seed sumber berpotensi bertabrakan saat startup bersamaan | Insert sumber menggunakan `INSERT OR IGNORE`. |
| Metrik operasional diisi angka contoh statis | Tampilan dihitung dari log run yang tersimpan, bukan seed metrik contoh. Ini metrik run, bukan pengukuran uptime/latency API menyeluruh. |
| Batas tender memakai akhir seluruh jadwal, termasuk kontrak | Memakai batas pemasukan penawaran/kualifikasi. Jadwal yang tidak dikenali dilewati. |
| Tanggal tidak valid dinormalisasi otomatis menjadi tanggal lain | Validasi tanggal/jam ditambahkan. |
| Endpoint dari HTML dapat mengarah ke host lain sambil membawa cookie | Endpoint dibatasi ke host dan tenant SPSE yang sama, redirect ditolak, fetch dibatasi 15 detik. |
| Pembatalan SSE tidak menghentikan loop polling | Cancel flag menghentikan polling setelah operasi berjalan selesai; error internal tidak dikirim mentah. |
| PDF error tidak selalu membebaskan resource | `loadingTask.destroy()` dipanggil melalui finally. Bitmap juga ditutup jika canvas tidak tersedia. |

## Duplikasi

Pemeriksaan hash pada 49 file source/test di app, lib, db, tests tidak menemukan file identik utuh. Ini **bukan** pembuktian tidak ada potongan kode serupa. Duplikasi akses D1 dan penanganan respons form telah dikurangi.

Definisi tabel runtime dalam `lib/database.ts` masih tumpang tindih dengan Drizzle. Bootstrap kompatibilitas ini tidak dicabut sekaligus karena database lama bergantung padanya. Refactor migrasi terpusat perlu dilakukan dengan backup dan uji upgrade tersendiri. Database pengguna tidak di-reset dalam audit ini.

## Verifikasi

- `npm test`: 17 tes lulus, termasuk OAuth, JSON/network errors, parser NIB, sumber INAPROC, batas jadwal, endpoint SPSE, dan migrasi seluruh schema ke SQLite in-memory.
- `node scripts/check-local.mjs`: 13 pemeriksaan HTTP lulus; akses tanpa sesi tetap ditolak walaupun memakai parameter role, JSON rusak mengembalikan 422, permintaan lintas-origin ditolak.
- `npx tsc --noEmit --incremental false`: lulus.
- `npm run lint`: lulus.
- `npm run build`: lulus; ada peringatan bundle melebihi 500 kB, bukan kegagalan build.
- `npm audit --omit=dev`: 0 kerentanan yang dilaporkan registry saat pemeriksaan. Tidak mencakup dependensi development atau jaminan bebas celah.
- UI localhost/Admin diperiksa melalui sesi browser yang sudah login: informasi OAuth belum dikonfigurasi muncul, tombol Google nonaktif, identitas simulasi tidak ditampilkan sebagai akun nyata.

## Batas dan pekerjaan lanjutan

1. Login Google nyata belum diuji tanpa OAuth Client ID/Secret. Buat credential milik Anda dan ikuti `GOOGLE-LOGIN.md`. Jangan kirim secret ke chat.
2. Tidak ditemukan pemanggilan OpenAI API pada alur pencarian yang diperiksa; proses memakai `rule-engine`. Menghubungkan Google tidak mengubahnya menjadi inference OpenAI.
3. Uji tidak mencakup login/logout semua akun dengan password nyata, perubahan password/status user nyata, upload ulang seluruh PDF/gambar, seluruh situs SPSE, atau load/concurrency test. Tidak ada klaim bahwa semua fungsi bebas bug.
4. KBLI hasil OCR masih menggunakan heuristik dan sebagian daftar judul lokal; bukan validasi terhadap katalog KBLI lengkap. Server masih menerima hasil OCR dari klien. Perlu validasi/review dokumen untuk penggunaan berisiko tinggi.
5. Scanner masih memiliki batas halaman/paket per sumber dan berjalan dalam request sinkron. Worker/queue serta pagination lengkap perlu pengembangan terpisah untuk cakupan nasional yang terjamin. Satu rute SPSE gagal masih dapat menggagalkan hasil tenant terkait.
6. Data peluang lama yang tersimpan dengan batas kontrak tidak otomatis dihitung ulang oleh patch parser. Perlu pemindaian ulang/verifikasi sumber sebelum menganggap jadwal lama sudah benar; data tersebut tidak dihapus dalam audit.
7. Akun database lama yang pernah memakai password default harus diganti sendiri melalui Kelola akun. Perubahan kode tidak otomatis merotasi password pengguna.
8. Tidak ada deployment production pada pekerjaan lokal ini. Migrasi baru diuji in-memory; tidak dijalankan ke database production.
