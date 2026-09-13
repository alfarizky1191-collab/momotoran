# Build dan uji Android Momotoran

Background tracking memerlukan development build atau APK mandiri. Expo Go bukan target uji fitur ini.

## Konfigurasi yang dibutuhkan
1. Login akun Expo/EAS pada laptop. Hubungkan project Momotoran melalui EAS CLI.
2. Aktifkan Google Maps SDK for Android, buat key yang dibatasi package id.my.momotoran dan SHA-1 signing certificate build.
3. Isi EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (publishable key), dan GOOGLE_MAPS_ANDROID_API_KEY di environment build. Jangan memasukkan nilainya ke Git.
4. Dari repo, jalankan npm ci. Untuk APK pengujian, jalankan npx eas-cli build --platform android --profile preview. Selesaikan pemilihan project/signing di akun sendiri.
5. Pasang APK yang dihasilkan pada dua HP. Preview APK memuat bundle, sehingga tidak membutuhkan Metro laptop.
6. Development build alternatif: npx eas-cli build --platform android --profile development lalu npx expo start --dev-client.

Di workspace saat ini belum tersedia Android SDK, akses Expo/EAS, atau Maps key; APK belum dibangun. Android native prebuild dan export bundle sudah lulus, tetapi keduanya bukan APK.

## Uji wajib di tempat aman
- Login dengan dua akun berbeda; buat grup dan join menggunakan kode baru 16 karakter.
- Tekan Mulai dan izinkan lokasi sepanjang waktu. Pastikan notifikasi Momotoran tampil.
- Kunci layar HP A selama 10–15 menit sambil berpindah tempat; HP B harus menerima posisi yang terus diperbarui.
- Uji lebih dari satu jam untuk memeriksa pembaruan sesi login di background.
- Kembali ke daftar grup: tracking tetap berjalan. Buka grup untuk menghentikan.
- Putus internet lalu sambungkan kembali: posisi terbaru dikirim, tanpa memutar ulang titik lama.
- Tekan Berhenti saat pengiriman berlangsung: request tidak menahan UI tanpa batas; posisi lama harus dihapus setelah tersambung.
- Force-stop dan restart HP: jangan mengharapkan tracking terus berjalan. Buka aplikasi dan mulai lagi. Periksa umur posisi di HP lain.
- Setelah dua menit tanpa update, lokasi hilang dari anggota lain; penghapusan fisik menyusul pada cron berikutnya.
- Uji izin ditolak, GPS dimatikan, baterai hemat, dan pengaturan baterai vendor. Jika perlu, izinkan penggunaan baterai tidak dibatasi untuk Momotoran.
- Leader mengeluarkan anggota: akses lokasi terputus dan kode undangan lama tidak berlaku.
- Selesaikan touring: lokasi dihapus dan unggahan baru ditolak server.
- Pastikan tidak ada credential di perubahan Git sebelum push.
