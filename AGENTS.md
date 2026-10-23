# AI AGENT CONTEXT & MULTI-PROJECT GUIDE (OPENCODE)
## Proyek: Pos Security Gerbang Bengkel KIM 3 (Master Truck)

Selamat datang, AI Agent (OpenCode / Cursor / Claude). Dokumen ini memberikan pemahaman lengkap mengenai repositori ini (**Pos Security Gerbang**) serta repositori partner terkait (**Web Fleet Customer**).

---

## 1. Identitas Proyek Ini: Pos Security Gerbang (`Bengkel-Kim3-Security`)
- **Direktori Kerja**: `D:\my-project\Project Backendless\Bengkel-Kim3-Security` (atau folder aktif saat ini).
- **Port Lokal**: `http://localhost:3500`
- **Remote Git**: `https://github.com/awand795/security-mastertruck.git`
- **Panduan Detail**: Buka dan baca [`./AI_AGENT_CONTEXT.md`](./AI_AGENT_CONTEXT.md).
- **Fungsi Utama**:
  - Pemeriksaan Check-In kedatangan armada fisik masuk bengkel.
  - Smart detection nomor polisi (Booking terkonfirmasi, Booking belum konfirmasi, Walk-In armada member di `sch_pos.tbl_member_unit`, atau Walk-In murni).
  - Multi-camera dokumentasi 4 sudut fisik (Depan, Belakang, Samping Kanan, Samping Kiri) di `sch_pos.ms_foto`.
  - Monitoring kendaraan aktif di dalam bengkel (`waktu_check_out IS NULL`).
  - Pemeriksaan Check-Out kendaraan (hanya dapat dieksekusi jika invoice kasir POS berstatus LUNAS).
  - Penerbitan Gate Pass Digital / Memo Keluar (`sch_fleet.memo_keluar`).
  - Autentikasi Staf Security via DarkoPOS API (`POST /api/v1/users/login`).

---

## 2. Proyek Partner: Web Fleet Customer (`Bengkel-Kim3`)
> [!IMPORTANT]
> Proyek partner berada di folder tetangga: `../Bengkel-Kim3` (Path absolut: `D:\my-project\Project Backendless\Bengkel-Kim3`).
> **Anda memiliki izin penuh untuk membaca dan mengedit file di folder `../Bengkel-Kim3` bila user meminta perubahan yang berkaitan dengan Web Fleet Customer.**

- **Port Lokal Web Fleet**: `http://localhost:3000`
- **Konteks Detail Web Fleet**: Buka file `../Bengkel-Kim3/AI_AGENT_CONTEXT.md`.
- **Fungsi Utama Web Fleet**:
  - Portal pelanggan armada (monitoring armada, live SPK tracking milestone, persetujuan estimasi & item tambahan, cetak faktur POS, manajemen dokumen legalitas).
  - Reservasi booking servis oleh customer (`sch_fleet.booking_service`).
  - Portal Super Admin untuk manajemen user & pengaturan situs.
- **Remote Git Web Fleet**: `https://github.com/awand795/bengkel-kim3.git`

---

## 3. Integrasi & Alur Data Antar Kedua Proyek

Kedua proyek berbagi database operasional yang sama (`dba_dev_pos` di `122.248.253.73:8832`) dan gateway API yang sama (`http://94.237.69.119:8081` dengan `X-Api-Key: KIM3-SECURE-TOKEN-2026-X998A7B6C`).

```
[POS SECURITY (Port 3500)]                          [CUSTOMER FLEET (Port 3000)]
         │                                                        │
         │◄───────────────────────────────────────────────────────┤ 1. Customer reservasi booking
2. Deteksi nopol saat kedatangan                                  │    (sch_fleet.booking_service)
   (Cek Booking Confirmed / Walk-In)                              │
   Ambil Foto 4 Sudut (sch_pos.ms_foto)                           │
         │                                                        │
3. Eksekusi Check-In (sch_pos.kunjungan_masuk)                    │
         └───────────────────────────────────────────────────────►│ 4. Live Monitoring Masuk
                                                                  │    (via sch_fleet.v_kunjungan_gerbang)
                                                                  │
                                                                  │ 5. Pengerjaan WO Mekanik &
                                                                  │    Kasir POS Melunasi Invoice
6. Truk Masuk Daftar "Siap Checkout" ◄────────────────────────────┤    (sch_pos.tbl_pos status 'Lunas')
   Security Eksekusi Check-Out                                    │
   Terbit Gate Pass (sch_fleet.memo_keluar)                       │
         └───────────────────────────────────────────────────────►│ 7. Status SPK Selesai & Ditutup
                                                                       (waktu_check_out terisi)
```

---

## 4. Kredensial Server & Akses Cepat

- **SSH API Builder Server**:
  ```bash
  ssh -i "C:\Users\awand\Downloads\awanda.pem" -p 8822 -o StrictHostKeyChecking=no awanda@94.237.69.119
  ```
- **Database Setting Gateway (`data_setting_sync`)**:
  - `127.0.0.1:8832` | user: `postgres` | pass: `postgre!PowerData@202608` | Tabel: `sch_sync.api_endpoints`
- **Database Operasional (`dba_dev_pos`)**:
  - `122.248.253.73:8832` | user: `postgres` | pass: `techRiderDevelop` | Schemas: `sch_fleet`, `sch_pos`

---

## 5. Perintah Menjalankan Server Lintas Folder

```powershell
# Jalankan Security Gate Portal (Port 3500):
npm run dev -- --port 3500

# Jalankan Web Fleet Customer (Port 3000):
cd "../Bengkel-Kim3"; npm run dev -- --port 3000
```
