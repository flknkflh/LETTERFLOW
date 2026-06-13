# Surat Online Bag InArTala

Aplikasi web lokal untuk monitoring evaluasi surat, permintaan nomor ke Subbag TU, catatan client, dan tanda tangan elektronik.

## Cara Menjalankan

Pilihan paling mudah:

1. Double-click `start-local.bat`.
2. Buka `http://localhost:3000` di komputer server.
3. Untuk perangkat lain dalam WiFi yang sama, buka alamat `http://IP-KOMPUTER:3000`.

Pilihan terminal:

```bash
npm start
```

Server berjalan dari komputer sendiri dan database tersimpan lokal di:

```text
PostgreSQL database: surat_online
```

`data/db.json` sekarang hanya dipakai sebagai sumber migrasi awal jika tabel PostgreSQL masih kosong.

## Setup PostgreSQL Lokal

Default koneksi aplikasi:

```text
host: localhost
port: 5432
database: surat_online
user: postgres
password: postgres
```

Jika password/user berbeda, set environment variable sebelum menjalankan:

```bash
set PGUSER=postgres
set PGPASSWORD=password_anda
set PGDATABASE=surat_online
npm start
```

Panduan ringkas ada di `docs/POSTGRES_SETUP.md`.

## Dashboard

- Admin/Operator: tambah surat, edit surat, ubah status/posisi, isi nomor surat, beri catatan, simpan TTD elektronik.
- Client: pantau status surat dan beri catatan.

## Dokumen Perencanaan

- PRD: `docs/PRD.md`
- Figma spec: `docs/FIGMA_SPEC.md`
- Siklus surat: `docs/SIKLUS_SURAT.md`

## Catatan Jaringan Lokal

Jika perangkat satu WiFi belum bisa membuka aplikasi:

- Pastikan komputer server dan perangkat client berada di WiFi yang sama.
- Gunakan IP LAN komputer server, bukan `localhost`, dari perangkat lain.
- Izinkan Node.js di Windows Firewall untuk jaringan private/local.
# LETTERFLOW
