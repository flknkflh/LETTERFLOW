# Setup PostgreSQL Lokal

Aplikasi sekarang memakai PostgreSQL sebagai database utama. File `data/db.json` tetap disimpan sebagai sumber migrasi awal: saat tabel PostgreSQL masih kosong, data dari `db.json` akan diimpor otomatis.

## 1. Install PostgreSQL

Install PostgreSQL di komputer server. Saat instalasi, catat password user `postgres`.

## 2. Buat Database

Buka terminal PostgreSQL atau pgAdmin, lalu buat database:

```sql
CREATE DATABASE surat_online;
```

Tabel akan dibuat otomatis oleh aplikasi saat server dijalankan.

## 3. Jalankan Server

Jika user/password PostgreSQL memakai default aplikasi:

```bash
npm start
```

Default aplikasi:

```text
PGHOST=localhost
PGPORT=5432
PGDATABASE=surat_online
PGUSER=postgres
PGPASSWORD=postgres
```

Jika password berbeda, jalankan dari Command Prompt:

```bat
set PGUSER=postgres
set PGPASSWORD=password_anda
set PGDATABASE=surat_online
npm start
```

Atau pakai satu URL koneksi:

```bat
set DATABASE_URL=postgres://postgres:password_anda@localhost:5432/surat_online
npm start
```

## 4. Akses Lewat WiFi

Setelah server berjalan, buka alamat WiFi yang muncul di terminal dari perangkat lain yang tersambung ke jaringan yang sama.
