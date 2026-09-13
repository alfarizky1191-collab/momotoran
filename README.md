# Momotoran

Aplikasi touring Android: login, grup privat, peta anggota, dan tracking background dengan Expo SDK 57 + Supabase.

## Perilaku tracking
- Tekan Mulai dan berikan izin lokasi sepanjang waktu. Android menampilkan notifikasi foreground service.
- Layar terkunci atau kembali ke daftar grup tidak menghentikan tracking.
- Tekan Berhenti untuk mengakhiri; keluar akun juga menghentikan layanan.
- Force-stop, restart HP, atau pembatasan baterai vendor dapat menghentikan tracking. Uji perangkat fisik diperlukan.
- Request dibatasi 12 detik; antrean hanya menyimpan satu titik terbaru.
- Penghapusan posisi yang gagal disimpan sebagai pekerjaan lokal dan dicoba lagi. Posisi tidak diperbarui selama dua menit disembunyikan dari anggota lain; cron menghapus baris kedaluwarsa setiap menit.
- Posisi dari HP dengan jam melenceng dapat ditolak. Gunakan waktu otomatis perangkat.

## Keamanan grup
Kode baru terdiri dari 16 karakter heksadesimal dan berlaku tujuh hari. Maksimal lima percobaan join per akun per 15 menit. Leader dapat mengganti kode, mengeluarkan anggota (kode ikut diganti), atau menyelesaikan touring. Anggota dapat keluar sendiri. RLS tetap membatasi akses grup. Rate limit per akun belum menjadi perlindungan terhadap banyak akun penyerang.

Dua RPC SECURITY DEFINER sengaja diizinkan untuk authenticated; keduanya memeriksa caller dan izin operasi. private.join_attempts sengaja tidak memiliki policy akses client. Catatan ini menjelaskan advisory yang masih muncul, bukan klaim bebas risiko.

## Setup
Salin .env.example ke .env dan isi konfigurasi Supabase. Jangan commit nilai konfigurasi, password, service_role, atau signing key. ANON_KEY menerima publishable key.
Migration awal dan touring_hardening sudah diterapkan ke project terhubung. Jangan menjalankan ulang di sana.

Lihat [panduan Android](docs/ANDROID-TEST.md) untuk build dan pengujian.
npm ci
npm run typecheck
node --test tests/tracking.cjs

## Verifikasi
Lulus: TypeScript, 3 tes unit tracking dengan mock native, export bundle Android, native prebuild dan izin manifest, serta tes SQL transaksional join/rate limit/otorisasi/remove/rotasi kode/penolakan lokasi setelah selesai.
Belum diuji: APK fisik, login email dua perangkat, lokasi saat layar terkunci, ketahanan baterai, refresh sesi auth setelah satu jam, dan pembatasan baterai vendor.
Belum tersedia: alur lupa password dan rilis Play Store. Pengujian mock bukan bukti bahwa GPS berjalan pada HP nyata.
