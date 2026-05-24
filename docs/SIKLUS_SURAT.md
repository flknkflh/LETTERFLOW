# Siklus Surat Bag InArTala

## Alur Utama
1. Draft Admin
2. Minta Nomor Subbag TU
3. Verifikasi Subbag TU
4. Review Pimpinan
5. Butuh TTD Elektronik
6. Ditandatangani Elektronik
7. Selesai/Arsip

## Hak Akses
- Admin/Operator membuat surat pada tahap Draft Admin.
- Admin/Operator mengajukan permintaan nomor ke Subbag TU dengan status Minta Nomor Subbag TU.
- Admin/Operator mengisi nomor setelah diterima dari Subbag TU.
- Admin/Operator mengubah posisi surat sesuai proses berjalan.
- Admin/Operator menyimpan tanda tangan elektronik.
- Client hanya memantau dan memberi catatan.

## Monitoring Evaluasi
- Setiap surat memiliki status dan posisi.
- Client dapat bertanya melalui catatan, misalnya "surat sudah sampai mana".
- Semua catatan tersimpan di detail surat.
- Riwayat otomatis tercatat saat surat dibuat, diedit, diberi catatan, atau ditandatangani.

## Deployment Lokal
1. Jalankan `npm start`.
2. Buka `http://localhost:3000` di komputer server.
3. Untuk perangkat lain dalam WiFi yang sama, buka alamat IP LAN yang muncul di terminal, misalnya `http://192.168.1.10:3000`.
4. Pastikan firewall Windows mengizinkan Node.js menerima koneksi jaringan lokal.
