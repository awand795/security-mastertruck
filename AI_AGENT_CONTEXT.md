# AI AGENT CONTEXT & HANDOFF GUIDE
## Pos Security Gerbang Bengkel KIM 3 (Master Truck)

Dokumen ini adalah panduan lengkap (*single source of truth*) untuk repositori **Bengkel-Kim3-Security**. Disusun agar AI agent (OpenCode, Claude, Cursor, dll.) atau engineer mana pun dapat langsung memahami arsitektur, mengakses SSH server, mengedit API di API Builder, menjalankan query database, serta melanjutkan pengembangan fitur tanpa hambatan.

---

## 1. Ringkasan Eksekutif Proyek

- **Nama Aplikasi**: Bengkel KIM 3 - Security Gate Portal (Master Truck)
- **Lokasi Direktori**: `D:\my-project\Project Backendless\Bengkel-Kim3-Security`
- **Repositori Partner (Web Fleet Customer)**: `D:\my-project\Project Backendless\Bengkel-Kim3` (Lihat Bagian 7 untuk hubungan antar-project)
- **Teknologi Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), Zustand, TanStack React Query v5, Axios, Lucide React
- **Port Lokal Vite**: `http://localhost:3500` (Proxy `/api` ➔ `http://94.237.69.119:8081`)
- **Fungsi Utama Portal Security**:
  1. **Check-In Kendaraan (Kedatangan)**: Pencatatan kedatangan armada masuk (Booking Jadwal terkonfirmasi vs Walk-In), live auto-detection nomor polisi, registrasi data pengemudi & keluhan servis.
  2. **Multi-Camera Documentation**: Pengambilan foto 4 sudut fisik utama (Depan, Belakang, Kanan, Kiri) serta sudut lecet/khusus yang tersimpan di `sch_pos.ms_foto`.
  3. **Monitoring Kendaraan di Dalam Bengkel (Active Inside)**: Daftar live armada yang saat ini berada di area bengkel dengan status pengerjaan & durasi parkir.
  4. **Pemeriksaan Keluar (Check-Out)**: Eksekusi pelepasan armada keluar setelah pekerjaan selesai dan invoice POS lunas.
  5. **Gate Pass Digital (Memo Keluar)**: Arsip dan penerbitan bukti izin keluar resmi berstempel digital security.

---

## 2. Kredensial Server & Akses SSH

### A. Akses SSH ke Server API Builder
- **Server IP**: `94.237.69.119`
- **SSH Port**: `8822` *(Catatan: port non-standar, wajib sertakan `-p 8822`)*
- **User**: `awanda`
- **Private Key**: `C:\Users\awand\Downloads\awanda.pem`
- **Perintah SSH Terminal**:
  ```bash
  ssh -i "C:\Users\awand\Downloads\awanda.pem" -p 8822 -o StrictHostKeyChecking=no awanda@94.237.69.119
  ```

### B. Database Konfigurasi API Builder (`data_setting_sync`)
- **Lokasi**: Di dalam server `94.237.69.119` (Localhost)
- **Host**: `127.0.0.1` | **Port**: `8832` | **Database**: `data_setting_sync`
- **User**: `postgres` | **Password**: `postgre!PowerData@202608`
- **Tabel Konfigurasi Endpoint**: `sch_sync.api_endpoints`
- **ID Koneksi Database POS Bengkel**: `1790050800000`

### C. Database Operasional Bengkel & Web Fleet (`dba_dev_pos`)
- **Host Eksternal**: `122.248.253.73` | **Port**: `8832` | **Database**: `dba_dev_pos`
- **User**: `postgres` | **Password**: `techRiderDevelop`
- **Schema Terkait**:
  - `sch_pos` — Data operasional bengkel riil (Work Order, POS Kasir, Mekanik, `kunjungan_masuk`, `ms_foto`, `tbl_member_unit`).
  - `sch_fleet` — Data Web Fleet Customer & Pos Security (Kendaraan, Booking, `memo_keluar`, `v_kunjungan_gerbang`).

---

## 3. Autentikasi Staf Security & Integrasi DarkoPOS

Portal Security menggunakan sistem autentikasi terintegrasi dengan DarkoPOS:

### A. DarkoPOS Login Endpoint
- **URL**: `POST {{DARKOPOS_BASE_URL}}/api/v1/users/login`
- **Header**:
  - `x-api-key`: `TURNONTHEAPI98` (atau variabel `VITE_DARKOPOS_API_KEY`)
  - `Content-Type`: `application/json`
- **Request Body**:
  ```json
  {
    "company": "BENGKEL MASTER TRUK",
    "userid": "adminPOS",
    "password": "yourPassword"
  }
  ```
- **Response Sukses (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User POS - Administrator logged in",
    "profile": {
      "userid": "adminPOS",
      "username": "POS - Administrator",
      "usercompany": "BENGKEL MASTER TRUK",
      "role": "OWN",
      "store": 1
    },
    "id_token": "eyJhbGciOi..."
  }
  ```

### B. Konfigurasi Autentikasi Production
- Endpoint login telah diset secara fixed ke service API DarkoPOS production:
  `http://52.77.133.95:9004/api/v1/users/login`
- Tidak lagi menggunakan konfigurasi dynamic tunnel / modal "Set URL" agar stabil dan bebas bug di lingkungan production.
- **Akun Fallback Pengembangan**:
  - User ID: `adminPOS` / Password: `adminPOS`
  - User ID: `security` / Password: `security123`

---

## 4. Endpoint Security di DarkoSync (API Builder)

Semua endpoint berikut dilayani oleh API Builder pada host `http://94.237.69.119:8081/api/data/*` dengan header `X-Api-Key: KIM3-SECURE-TOKEN-2026-X998A7B6C`.

| No | Endpoint Path | Method | Fungsi & SQL Logic |
|---|---|---|---|
| 1 | `/kim3/security/checkin-candidates` | `GET` | Live search gabungan: booking aktif dari `sch_fleet.v_security_booking_active` + unit terdaftar dari `sch_fleet.v_kendaraan_lookup`. Menampilkan status confirmed/unconfirmed, booking lewat H-1, dan badge unit nonaktif. |
| 2 | `/kim3/kendaraan-lookup` | `GET` | Lookup unit armada dari `sch_pos.tbl_member_unit` / `sch_fleet.v_kendaraan_lookup` berdasarkan nopol (legacy, tetap tersedia). |
| 3 | `/kim3/security/check-in` | `POST` | Merekam kedatangan ke `sch_pos.kunjungan_masuk` dengan validasi server-side: booking wajib confirmed, masih dalam window H-1, plat harus cocok, dan walk-in ditolak bila plat masih punya booking aktif. |
| 4 | `/kim3/security/add-foto` | `POST` | Menyimpan dokumentasi fisik kendaraan ke `sch_pos.ms_foto`. |
| 5 | `/kim3/security/active-inside` | `GET` | Mengambil daftar kendaraan aktif di area bengkel (`waktu_check_out IS NULL`). |
| 6 | `/kim3/security/check-out` | `POST` | Melakukan checkout kendaraan (`waktu_check_out = NOW()`). Validasi: invoice POS wajib LUNAS. |
| 7 | `/kim3/security/memo-keluar` | `GET` | Riwayat kendaraan keluar dan daftar memo/gate pass. |
| 8 | `/kim3/security/foto-kunjungan` | `GET` | Mengambil list foto fisik (`sch_pos.ms_foto`) berdasarkan `kunjungan_id`. |

### Contoh Perintah Update Endpoint via SSH
```bash
ssh -i "C:\Users\awand\Downloads\awanda.pem" -p 8822 -o StrictHostKeyChecking=no awanda@94.237.69.119 "PGPASSWORD='postgre!PowerData@202608' psql -h 127.0.0.1 -p 8832 -U postgres -d data_setting_sync -c \"
SELECT endpoint_path, http_method, is_active FROM sch_sync.api_endpoints WHERE endpoint_path LIKE '/kim3/security%' ORDER BY endpoint_path;
\""
```

---

## 5. Struktur Database Operasional (`dba_dev_pos`)

### A. Tabel Kunjungan Masuk (`sch_pos.kunjungan_masuk`)
```sql
CREATE TABLE sch_pos.kunjungan_masuk (
    id SERIAL PRIMARY KEY,
    nomor_tiket VARCHAR(50) NOT NULL UNIQUE,
    booking_id BIGINT,
    jenis_kedatangan VARCHAR(20) DEFAULT 'WALK_IN', -- 'BOOKING' atau 'WALK_IN'
    no_polisi VARCHAR(20) NOT NULL,
    nama_pengemudi VARCHAR(100) NOT NULL,
    no_telepon_pengemudi VARCHAR(30),
    tipe_kunjungan VARCHAR(50) DEFAULT 'Service Berkala',
    keluhan TEXT,
    catatan_masuk TEXT,
    petugas_security_masuk VARCHAR(100),
    waktu_masuk TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    petugas_security_keluar VARCHAR(100),
    waktu_check_out TIMESTAMP,
    catatan_keluar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### B. Tabel Dokumentasi Foto (`sch_pos.ms_foto`)
> [!IMPORTANT]
> **Catatan Perubahan Nama Tabel**: Tabel dokumentasi foto yang sebelumnya bernama `master_foto` telah resmi diganti menjadi **`sch_pos.ms_foto`**. Jangan gunakan nama `master_foto` lagi.

```sql
CREATE TABLE sch_pos.ms_foto (
    id SERIAL PRIMARY KEY,
    kunjungan_id BIGINT NOT NULL REFERENCES sch_pos.kunjungan_masuk(id) ON DELETE CASCADE,
    jenis_event VARCHAR(20) NOT NULL, -- 'MASUK' atau 'KELUAR'
    sudut_pandang VARCHAR(50) NOT NULL, -- 'Tampak Depan', 'Tampak Belakang', 'Tampak Samping Kanan', 'Tampak Samping Kiri', dll.
    foto_data TEXT NOT NULL, -- Base64 data URL atau URL file foto
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### C. Tabel Master Unit Member (`sch_pos.tbl_member_unit`)
Menyimpan data seluruh armada truk member bengkel KIM 3 (nopol, merek, tipe, nama pemilik/PT, no telepon driver). Digunakan untuk auto-fill data saat walk-in unit terdaftar.

### D. View Integrasi Gerbang (`sch_fleet.v_kunjungan_gerbang`)
VIEW lintas schema yang menjembatani data gerbang `sch_pos.kunjungan_masuk` agar langsung terbaca dan tersinkronisasi di dashboard Web Fleet Customer (`Bengkel-Kim3`).

### E. View Booking Aktif Security (`sch_fleet.v_security_booking_active`)
VIEW khusus Security (tidak mengubah view customer) yang menghasilkan **satu baris per booking aktif** dan mengekspos flag:
- `is_confirmed`, `is_within_window` (H-1), `can_checkin`
- `is_stale_unconfirmed` (booking lama yang masih belum confirmed — tetap ditampilkan dan diblokir)
- `is_stale_confirmed` (booking lama yang sudah confirmed — diabaikan)
- `should_show` (booking dalam window H-1 atau stale unconfirmed)

View ini juga dipakai untuk validasi server-side pada endpoint check-in.

---

## 6. Detail Implementasi Frontend & Aturan Logika Bisnis

### A. Alur Check-In Tunggal (Unified Flow)
Di [`src/views/CheckInView.tsx`](file:///D:/my-project/Project%20Backendless/Bengkel-Kim3-Security/src/views/CheckInView.tsx):
- **Tidak ada toggle terpisah** antara "Booking" dan "Walk-In".
- Cukup ketikkan **Nomor Polisi**, sistem menampilkan daftar kandidat yang bisa dipilih (booking aktif + unit member terdaftar), lalu mendeteksi kondisi:
  1. **Booking Confirmed (window H-1)**:
     - Ditandai badge hijau *"Confirmed"*.
     - Data pelanggan, driver, rencana servis, dan `booking_id` terisi otomatis.
     - Tombol Check In **Aktif**.
  2. **Booking Belum Confirmed**:
     - Muncul banner peringatan amber: *"Booking belum dikonfirmasi. Silakan konfirmasi ke Admin Bengkel."*
     - Tombol simpan Check In **Wajib Di-Disabled**.
  3. **Booking Lewat H-1 & Belum Confirmed**:
     - Tetap terdeteksi dan ditampilkan dengan badge merah *"Lewat H-1"*.
     - Banner merah dan tombol Check In **Wajib Di-Disabled** sampai Admin mengonfirmasi ulang.
  4. **Walk-In Armada Terdaftar (`tbl_member_unit`)**:
     - Ditandai badge biru *"Member Unit"*; unit nonaktif diberi badge *"Nonaktif"*.
     - Nama perusahaan dan profil kendaraan terisi otomatis.
     - `jenis_kedatangan = 'WALK_IN'`, Tombol Check In **Aktif** (termasuk unit nonaktif, dengan verifikasi fisik).
     - Jika plat tersebut punya booking aktif, baris unit ditampilkan tetapi **disabled** dan security wajib memilih data booking.
  5. **Walk-In Murni (Armada Baru / Tidak Terdaftar)**:
     - Ditandai badge abu-abu *"Walk-In Biasa"*.
     - Petugas mengisi nama supir, telepon, dan keluhan manual.
     - Tombol Check In **Aktif**.

> [!IMPORTANT]
> Frontend hanya lapisan UX. Endpoint `/kim3/security/check-in` tetap memvalidasi ulang booking confirmed, window H-1, kecocokan plat, dan booking aktif sebelum insert.

### B. Penanganan Kamera Multi-Device
Di [`src/components/common/CameraCaptureModal.tsx`](file:///D:/my-project/Project%20Backendless/Bengkel-Kim3-Security/src/components/common/CameraCaptureModal.tsx):
- Di smartphone, kamera diarahkan ke kamera belakang (`facingMode: { ideal: 'environment' }`).
- Di laptop/PC, constraint `environment` sering ditolak oleh webcam (`OverconstrainedError` / `NotAllowedError`).
- Implementasi memiliki fallback cerdas: bila constraint gagal, langsung meminta `{ video: true, audio: false }` default webcam tanpa melempar alert error.
- Saat modal ditutup, seluruh track video dilepas (`track.stop()`) agar lampu sensor kamera tidak terus menyala.

---

## 7. Hubungan Dua Proyek & Panduan Workspace OpenCode

Kedua repositori ini berada di bawah satu folder induk: `D:\my-project\Project Backendless`

```
D:\my-project\Project Backendless\
├── Bengkel-Kim3\              # Web Fleet Customer & Admin Portal (Port 3000)
│   ├── AI_AGENT_CONTEXT.md    # Konteks panduan Web Fleet
│   └── src\                   # View Customer, SPK Tracking, Booking Reservasi
│
└── Bengkel-Kim3-Security\     # Pos Security Gerbang Portal (Port 3500)
    ├── AI_AGENT_CONTEXT.md    # Dokumen ini (Konteks panduan Pos Security)
    └── src\                   # View CheckIn, CheckOut, ActiveInside, MemoKeluar
```

### Cara Beroperasi Lintas Proyek di OpenCode / AI Agent
Bila Anda membuka folder induk `D:\my-project\Project Backendless` pada OpenCode:
1. **Paham Konteks Lintas Modul**:
   - Saat Customer di `Bengkel-Kim3` membuat reservasi jadwal booking, data masuk ke `sch_fleet.booking_service`.
   - Di `Bengkel-Kim3-Security`, petugas security melihat booking tersebut di Check-In saat truk tiba.
   - Saat Security menyelesaikan Check-In, status gerbang tersinkronisasi ke `sch_fleet.v_kunjungan_gerbang` sehingga customer dapat melihat status *"Truk Sudah di Bengkel"*.
   - Saat servis selesai dan Kasir POS menerbitkan invoice serta pembayaran lunas (`sch_pos.tbl_pos`), status di Security berubah menjadi *"Siap Checkout"*.
   - Saat Security melakukan Check-Out, Gate Pass / Memo Keluar diterbitkan dan SPK di Web Fleet Customer ditutup dengan timestamp `waktu_check_out`.
2. **Menjalankan Dev Server**:
   - Web Fleet Customer:
     ```powershell
     cd "D:\my-project\Project Backendless\Bengkel-Kim3"; npm run dev -- --port 3000
     ```
   - Security Gate Portal:
     ```powershell
     cd "D:\my-project\Project Backendless\Bengkel-Kim3-Security"; npm run dev -- --port 3500
     ```

---

## 8. Verifikasi Build & Pengujian

Sebelum menyelesaikan tugas atau melakukan push commit:
```bash
cd "D:\my-project\Project Backendless\Bengkel-Kim3-Security"

# 1. Cek tipe TypeScript
npx tsc --noEmit

# 2. Build aplikasi Vite
npm run build

# 3. Status git & commit
git status
git add .
git commit -m "feat/fix(...): keterangan perubahan"
```

---
*Dokumen ini diperbarui secara berkala dan siap digunakan sebagai panduan serah terima mandiri bagi AI Agent berikutnya di OpenCode.*
