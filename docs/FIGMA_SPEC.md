# Figma Spec Dashboard Surat Online

## Frame
- Desktop: 1440 x 1024.
- Tablet: 1024 x 768.
- Mobile: 390 x 844.

## Struktur Layar
- Topbar: identitas "Bag InArTala", judul "Surat Online", switch role Admin/Operator dan Client.
- Summary metrics: Total Surat, Menunggu Nomor TU, Butuh TTD, Selesai.
- Admin Dashboard: form input/edit surat dan panel TTD elektronik.
- Client Dashboard: form catatan client.
- Area bawah: daftar surat di kiri, detail monitoring di kanan.

## Komponen
- Role switch: segmented control.
- Metric card: angka besar dan label singkat.
- Letter card: perihal, nomor, status, posisi.
- Detail panel: metadata surat, ringkasan, preview tanda tangan, siklus surat, catatan.
- Form admin: input, select, textarea, tombol simpan.
- Signature canvas: area tanda tangan dan metadata penandatangan.

## Warna
- Background: `#f5f7fb`.
- Topbar: `#102a3a`.
- Primary: `#0f766e`.
- Accent: `#b45309`.
- Text utama: `#18212f`.
- Muted: `#657084`.
- Border: `#d9e0ea`.

## Aturan Role
- Admin/Operator melihat form edit dan TTD elektronik.
- Client melihat monitoring dan form catatan.
- Daftar dan detail surat dipakai oleh kedua role.

## Catatan Implementasi
File web di folder `public` dapat dijadikan acuan visual Figma. Layout sengaja dibuat setingkat dashboard operasional, bukan landing page.
