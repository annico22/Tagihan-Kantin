# Rekap Tagihan Kantin 2026 — Kantin Dipo (Vercel)

Aplikasi rekap tagihan sewa kantin (Koperasi Konsumen Al Hidayah Jakarta Maju Bersama)
yang datanya diambil langsung dari Google Sheet. Dibuat tanpa proses build:
satu file HTML mandiri + satu serverless function, sehingga bisa langsung
di-deploy ke Vercel.

## Isi proyek

| File | Fungsi |
|---|---|
| `index.html` | Halaman utama mandiri (dashboard, rekap tenant, invoice, tanda terima, cetak rekap, PDF) — desain, logo, dan cap sudah tertanam di dalam file |
| `api/sheet.js` | Serverless function: mengambil data live dari Google Sheet, memprosesnya dengan aturan penagihan, mengembalikan JSON siap tampil |
| `vercel.json` | Konfigurasi Vercel (minimal; folder `api/` otomatis jadi serverless function) |

## Aturan penagihan yang dipakai aplikasi

- Hanya bulan **Januari–Oktober 2026** yang dihitung.
  **Februari–Maret selalu libur** (Ramadhan) dan tidak ditagih.
- **Kolom bulan yang kosong = BELUM BAYAR**, ditagih sesuai tarif lantai.
  Jangan pernah mengartikan kolom kosong sebagai "tidak ditagih" atau "lunas".
- Tarif: **Lt.2 = Rp 1.650.000/bulan**, **Lt.3 = Rp 1.100.000/bulan**.
- Tenant **Higashi** baru mulai berjualan **September 2026** — bulan sebelumnya
  tampil sebagai "Belum berjualan", bukan tunggakan.
- **Bambu Sushi, Juni 2026**: kurang bayar Rp 850.000
  (ditagih 1.650.000, sudah dibayar 800.000).
- **Kantin Bu Rudi, April 2026**: bayar 1.300.000 vs tagihan 1.100.000 —
  selisih Rp 200.000 adalah **iuran koperasi**, bukan lebih bayar sewa.
  April tetap dihitung lunas pas.
- **Dapur Wan Gembul, Januari 2026**: ditagih dan dibayar Rp 1.667.000, tetap lunas.

Semua aturan ini ada di `api/sheet.js`. Kalau ada tenant baru
yang mulai berjualan di tengah tahun, tambahkan namanya di `START_MONTHS` di
file yang sama.

## Fitur

- Dashboard: Total Tagihan, Total Terbayar, Lebih bayar, Tenant Menunggak,
  plus tombol "Lihat 9 tenant lainnya" dan "Buka sumber" (link ke Sheet).
- Pembayaran per tenant: tabel ringkasan (Tagihan / Terbayar / Tunggakan /
  Status) dengan pencarian dan pil filter (Semua / Lunas / Lebih bayar /
  Belum bayar / Kurang bayar), tombol Cetak Rekap dan Preview per tenant.
- Invoice tunggakan per bulan: tiap bulan tertunggak punya tombol Cetak
  sendiri (satu slip per halaman A4), nomor/tanggal/jatuh tempo bisa diubah.
- Tanda Terima per bulan lunas: panel "Isi tanda terima" untuk mengubah nama
  tenant, nama penyewa, dan uraian/jumlah per bulan; tiap bulan punya tombol
  Cetak dan Lihat slip sendiri.
- Cetak Rekap: dokumen rekap satu tenant + tombol Simpan / Bagikan PDF (A4).
- Cap basah + tanda tangan tertanam di kolom tanda tangan slip Invoice dan
  Tanda Terima (preview maupun PDF).
- Data selalu live dari Sheet: kalau isi Sheet berubah, angka di aplikasi ikut
  berubah tanpa perlu deploy ulang. Tombol "Muat ulang data" mengambil ulang
  dari server; kalau server gagal, aplikasi menampilkan data terakhir yang
  tersimpan di perangkat dengan spanduk penanda.

## Langkah 1 — Upload ke GitHub

### Cara A: lewat web GitHub (tanpa git, paling mudah)

1. Buat repository kosong di github.com (tombol **New repository**),
   misalnya bernama `rekap-kantin-2026`.
2. Di halaman repository, klik **Add file → Upload files**.
3. Seret seluruh isi folder proyek ini (file `index.html`, `README.md`,
   `vercel.json`, dan folder `api/` beserta `sheet.js` di dalamnya).
4. Klik **Commit changes**. Selesai — repository sudah berisi proyek.

### Cara B: lewat terminal (git)

```bash
cd rekap-kantin-vercel
git init
git add .
git commit -m "Rekap Tagihan Kantin 2026"
git branch -M main
git remote add origin https://github.com/USERNAME/rekap-kantin-2026.git
git push -u origin main
```

Ganti `USERNAME` dengan username GitHub Anda. Saat `git push`, GitHub akan
meminta login — pakai Personal Access Token sebagai password (bukan password akun).

## Langkah 2 — Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) dan login (bisa pakai akun GitHub).
2. Klik **Add New → Project** → pilih repository `rekap-kantin-2026` → **Import**.
3. Biarkan semua pengaturan apa adanya (Framework Preset: **Other**,
   tidak perlu Build Command) → klik **Deploy**.
4. Tunggu sampai selesai — Vercel akan memberi alamat, misalnya
   `https://rekap-kantin-2026.vercel.app`. Buka alamat itu, aplikasi langsung jalan.
   **Bookmark alamat itu** — itulah link kerja harian, tidak perlu lewat Muse lagi.

### Mengganti ID Google Sheet (opsional)

Kalau suatu saat sheet-nya pindah, tidak perlu mengubah kode:

1. Di dashboard Vercel, buka project → **Settings → Environment Variables**.
2. Tambah variabel: Name `SHEET_ID`, Value = ID sheet baru
   (ID adalah bagian di antara `/d/` dan `/edit` pada URL Google Sheet).
3. **Deployments → ⋯ → Redeploy** agar variabel berlaku.

Tanpa variabel ini, aplikasi memakai ID sheet Kantin Dipo yang sekarang.
Catatan: fungsi `api/sheet.js` membaca Sheet lewat endpoint gviz, jadi Sheet
harus tetap bisa diakses lewat link (seperti sekarang).

## Penting: aplikasi yang sudah di-deploy itu publik

Berbeda dengan aplikasi di Muse yang bersifat privat, **siapa pun yang punya
link Vercel bisa membuka aplikasi ini** dan melihat nama tenant, pemilik,
serta jumlah tunggakan. Pertimbangkan sebelum membagikan link-nya.

Cara melindunginya:

- **Paling mudah (butuh paket Pro Vercel):** di dashboard Vercel, aktifkan
  **Deployment Protection → Password Protection**, lalu bagikan password-nya
  hanya ke orang yang berhak.
- **Gratis tapi perlu ubahan kode:** tambahkan halaman login sederhana
  (misalnya password tunggal yang dicek sebelum data ditampilkan). Ini bukan
  keamanan tingkat tinggi, tapi cukup untuk menghalangi pengunjung iseng.
  Kalau mau, minta dibuatkan.
- **Paling aman:** jangan membagikan link-nya ke publik; hanya dibuka
  sendiri atau lewat perangkat yang Anda pegang.

## Menjalankan di komputer sendiri (opsional, untuk tes)

```bash
cd rekap-kantin-vercel
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000`. Catatan: tombol "Muat ulang data" memakai
`/api/sheet` yang hanya tersedia setelah di-deploy ke Vercel; saat dijalankan
lokal seperti ini, data tidak akan termuat (normal — bukan kerusakan).
Untuk tes lokal lengkap, jalankan lewat `vercel dev` (butuh Vercel CLI).
