# PRD Aplikasi Surat Online Bag InArTala

## Tujuan
Menyediakan aplikasi surat menyurat lokal untuk memantau perjalanan surat, meminta nomor surat ke Subbag TU, mengelola catatan, dan menyimpan tanda tangan elektronik.

## Ruang Lingkup
- Web dashboard hanya untuk jaringan lokal.
- Server berjalan dari komputer sendiri.
- Database disimpan di komputer sendiri dalam file `data/db.json`.
- Akses dari perangkat lain hanya selama satu WiFi dengan komputer server.
- Role yang tersedia: Admin/Operator dan Client.

## Pengguna
- Admin/Operator: membuat, mengedit, mengubah status, mengisi nomor surat, dan menyimpan tanda tangan elektronik.
- Client: melihat progres surat dan memberi catatan.

## Kebutuhan Utama
- Monitoring posisi surat secara online lokal.
- Status surat dapat menunjukkan surat sudah sampai tahap mana.
- Permintaan nomor surat ke Subbag TU tercatat melalui status dan nomor surat.
- Tanda tangan elektronik tersimpan di detail surat.
- Admin dapat melakukan proses edit.
- Client tidak dapat mengedit data surat, hanya memberi catatan.

## Dashboard Admin
- Ringkasan total surat, surat menunggu nomor TU, surat butuh TTD, dan surat selesai.
- Form tambah/edit surat.
- Pengaturan status dan posisi surat.
- Canvas tanda tangan elektronik.
- Catatan admin.
- Detail siklus surat.

## Dashboard Client
- Monitoring daftar surat.
- Detail status, posisi, nomor surat, tujuan, dan ringkasan.
- Catatan untuk bertanya jalannya surat.
- Tidak ada kontrol edit surat.

## Data Surat
- Nomor surat.
- Perihal.
- Pemohon.
- Unit.
- Tujuan.
- Jenis surat.
- Prioritas.
- Status.
- Posisi surat.
- Ringkasan.
- Catatan.
- Riwayat.
- Tanda tangan elektronik.

## Batasan Teknis
- Aplikasi menggunakan Node.js bawaan tanpa dependency tambahan.
- Penyimpanan saat ini berbasis JSON lokal agar mudah dipindahkan dan dijalankan.
- Untuk produksi formal, penyimpanan dapat ditingkatkan ke SQLite/PostgreSQL lokal dan autentikasi password per role.

## Kriteria Selesai
- Admin dapat tambah dan edit surat.
- Client dapat melihat surat dan mengirim catatan.
- TTD elektronik dapat disimpan dari canvas.
- Status surat terlihat jelas sebagai siklus proses.
- Server dapat diakses dari `localhost` dan IP LAN komputer server.
