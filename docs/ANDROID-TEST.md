# Uji Momotoran di dua HP Android

Status: pemeriksaan TypeScript dan bundling Android dapat dijalankan di workspace. GPS, render peta native, login email, dan komunikasi dua HP belum diuji pada perangkat fisik. Export bundle bukan APK.

## Jalankan dari laptop

1. Pasang Node.js 22.13 atau lebih baru dan Git.
2. Clone repo, atau jalankan git pull jika sudah ada.

   git clone https://github.com/alfarizky1191-collab/momotoran.git
   cd momotoran
   npm ci

3. Salin .env.example ke .env. Isi EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_ANON_KEY dari dialog Connect di dashboard Supabase. Variabel ANON_KEY menerima publishable key. Jangan memakai service_role atau secret key. Konfigurasi lokal workspace ChatGPT tidak otomatis ada di laptop.
4. Jalankan npm start. Hubungkan laptop dan kedua HP ke jaringan Wi-Fi yang sama.
5. Buka menggunakan Expo Go yang mendukung SDK 57 dan pindai QR Metro. Jika versi Expo Go tidak mendukung SDK 57, gunakan development build yang sesuai; jangan mengganti versi dependency satu per satu.

## Skenario perangkat (belum dijalankan)

- Daftarkan dua akun yang berbeda. Konfirmasi email jika diminta, lalu login manual.
- HP A membuat grup; bagikan kode melalui tombol Bagikan kode grup. HP B bergabung.
- Pastikan kedua nama tampil dan pembuat ditandai Leader.
- Mulai lokasi di kedua HP saat berhenti di tempat aman. Izinkan lokasi. Periksa marker dan akurasi.
- Tolak izin lokasi lalu coba lagi: aplikasi harus menampilkan pesan dan tombol tetap bisa dipakai.
- Putus internet saat mengirim: pesan posisi belum terkirim harus muncul. Sambungkan kembali dan tunggu pembaruan GPS berikutnya.
- Tekan Berhenti & hapus posisi: GPS berhenti dan posisi di HP lain hilang setelah sinkronisasi (maksimal sekitar 10 detik pada koneksi sehat). Jika hapus gagal, pesan menjelaskan posisi terakhir masih tersimpan.
- Kunci HP: foreground tracking dijeda. Buka aplikasi dan tekan Mulai untuk melanjutkan. Posisi lama tetap ditandai dengan umur data; marker abu-abu setelah 60 detik.
- Tekan Kembali: hentikan GPS dan hapus posisi sebelum kembali ke grup.
- Pindahkan peta manual: pembaruan GPS tidak menarik peta kembali berulang kali.

## Batasan

Belum ada APK atau background tracking. Belum ada uji ketahanan baterai. Snapshot grup diperiksa setiap 10 detik untuk menangani penghapusan posisi dan perubahan anggota, selain Realtime. Posisi yang tersimpan dari aplikasi yang mati mendadak belum mempunyai proses penghapusan terjadwal. Kode undangan belum mempunyai pembatasan percobaan; jangan gunakan rilis ini untuk berbagi lokasi sensitif secara luas.

Build Android mandiri membutuhkan konfigurasi Google Maps Android yang dibatasi package/signing certificate dan akun Expo/EAS jika memakai cloud build. Tidak ada Maps key atau signing credential di Git.
