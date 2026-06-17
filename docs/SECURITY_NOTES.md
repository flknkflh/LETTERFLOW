# Catatan Keamanan

## Yang Sudah Dikunci

- Semua endpoint `/api/*` selain `/api/auth/login` wajib memakai token sesi.
- Token dikirim lewat `Authorization: Bearer ...`.
- Link download file memakai token query agar tombol download browser tetap bisa bekerja.
- Remote user hanya bisa dilakukan jika token asli adalah `super-admin`.
- Endpoint admin seperti reset data, backup, manajemen user, dan database file dikunci server-side.
- Akses detail/download surat dicek server-side berdasarkan role dan relasi user ke surat.
- Password disimpan memakai hash `scrypt`, bukan plaintext.
- Password lama dari seed `data/db.json` otomatis di-hash saat migrasi/read.
- Query PostgreSQL memakai parameter binding dan whitelist kolom kategori pencarian.
- Path download file dibatasi hanya di folder upload lokal.
- Login diberi rate limit sederhana per IP dan NIP.

## Batasan

- Server memang dibuat terbuka untuk perangkat satu WiFi. Jangan port-forward aplikasi ini ke internet.
- Token download ada di URL agar link PDF/download tetap berfungsi. Gunakan hanya di jaringan lokal tepercaya.
- Gunakan password kuat untuk akun produksi, terutama `super-admin`.
