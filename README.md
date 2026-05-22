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
data/db.json
```

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
