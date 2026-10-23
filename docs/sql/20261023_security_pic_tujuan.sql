-- ==============================================================================
-- SECURITY: FIELD "PIC / TUJUAN" DARI TABEL KARYAWAN (tbl_employee)
-- Tanggal: 23 Oktober 2026
--
-- Perubahan:
-- 1. dba_dev_pos: kolom baru sch_pos.kunjungan_masuk.pic_tujuan (VARCHAR 100).
-- 2. Endpoint baru GET /kim3/security/employees -> daftar karyawan aktif
--    dari sch_pos.tbl_employee (untuk dropdown PIC di form Check In).
-- 3. POST /kim3/security/check-in     -> menyimpan pic_tujuan.
-- 4. GET  /kim3/security/active-inside -> mengembalikan pic_tujuan.
-- 5. GET  /kim3/security/memo-keluar   -> mengembalikan pic_tujuan.
--
-- Jalankan bagian A di dba_dev_pos (122.248.253.73:8832)
-- Jalankan bagian B di data_setting_sync (127.0.0.1:8832 via server API Builder)
-- ==============================================================================

-- ##############################################################################
-- BAGIAN A - dba_dev_pos: TAMBAH KOLOM PIC_TUJUAN
-- ##############################################################################

ALTER TABLE sch_pos.kunjungan_masuk
    ADD COLUMN IF NOT EXISTS pic_tujuan VARCHAR(100);

-- ##############################################################################
-- BAGIAN B - data_setting_sync: ENDPOINT & UPDATE SQL ENDPOINT
-- ##############################################################################

-- ENDPOINTS BEGIN
-- ---------------------------------------------------------------------------
-- 1. ENDPOINT BARU: GET /kim3/security/employees
-- ---------------------------------------------------------------------------
INSERT INTO sch_sync.api_endpoints (
    id,
    name,
    method,
    endpoint_path,
    connection_id,
    sql_query,
    parameters,
    enable_pagination,
    is_public,
    allow_raw_sql,
    group_name,
    security_mode,
    auth_action,
    allowed_roles,
    auth_token,
    created_at,
    updated_at
)
VALUES (
    md5(random()::text || clock_timestamp()::text),
    'Security Employee List (PIC)',
    'GET',
    '/kim3/security/employees',
    '1790050800000',
    $sql$
SELECT
    e.id,
    e.employeename,
    e.employeeid,
    CASE WHEN e.isserviceadvisor THEN 'Service Advisor'
         ELSE COALESCE(NULLIF(p.positionname, 'NO POSITION'), 'Karyawan')
    END AS positionname,
    e.mobilenumber,
    e.isserviceadvisor
FROM sch_pos.tbl_employee e
LEFT JOIN sch_pos.tbl_job_position p ON p.id = e.positionid
WHERE e.status = true
  AND e.deletedat IS NULL
  AND e.employeename ~ '[A-Za-z]'
  AND (
      COALESCE(CAST(:q AS text), '') = ''
      OR e.employeename ILIKE '%' || CAST(:q AS text) || '%'
      OR COALESCE(p.positionname, '') ILIKE '%' || CAST(:q AS text) || '%'
  )
ORDER BY
    e.isserviceadvisor DESC,
    CASE WHEN e.isserviceadvisor THEN '' ELSE COALESCE(p.positionname, '') END ASC,
    e.employeename ASC
LIMIT 2000;
$sql$,
    '[{"name":"q","type":"string","required":false}]',
    false,
    true,
    false,
    'General',
    'HYBRID',
    'NONE',
    NULL,
    'KIM3-SECURE-TOKEN-2026-X998A7B6C',
    NOW(),
    NOW()
)
ON CONFLICT (endpoint_path) DO UPDATE SET
    name = EXCLUDED.name,
    method = EXCLUDED.method,
    connection_id = EXCLUDED.connection_id,
    sql_query = EXCLUDED.sql_query,
    parameters = EXCLUDED.parameters,
    enable_pagination = EXCLUDED.enable_pagination,
    is_public = EXCLUDED.is_public,
    allow_raw_sql = EXCLUDED.allow_raw_sql,
    group_name = EXCLUDED.group_name,
    security_mode = EXCLUDED.security_mode,
    auth_action = EXCLUDED.auth_action,
    allowed_roles = EXCLUDED.allowed_roles,
    auth_token = EXCLUDED.auth_token,
    updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2. UPDATE: POST /kim3/security/check-in -> simpan pic_tujuan
-- ---------------------------------------------------------------------------
UPDATE sch_sync.api_endpoints
SET sql_query = $sql$
WITH input AS (
    SELECT
        CAST(NULLIF(CAST(:booking_id AS text), '') AS integer) AS booking_id,
        REPLACE(UPPER(TRIM(CAST(:no_polisi AS text))), ' ', '') AS no_polisi,
        COALESCE(NULLIF(TRIM(CAST(:jenis_kedatangan AS text)), ''), 'WALK_IN') AS jenis_kedatangan
),
validation AS (
    SELECT
        i.booking_id,
        i.no_polisi,
        i.jenis_kedatangan,
        b.booking_id AS found_booking_id,
        b.no_polisi_clean,
        b.is_confirmed,
        b.is_within_window,
        b.can_checkin,
        b.is_stale_unconfirmed,
        CASE
            WHEN i.no_polisi = '' THEN 'Nomor polisi wajib diisi.'
            WHEN i.booking_id IS NULL
                 AND UPPER(i.jenis_kedatangan) = 'BOOKING'
                THEN 'Booking wajib dipilih.'
            WHEN i.booking_id IS NOT NULL
                 AND b.booking_id IS NULL
                THEN 'Booking tidak ditemukan atau sudah selesai.'
            WHEN i.booking_id IS NOT NULL
                 AND b.no_polisi_clean <> i.no_polisi
                THEN 'Nomor polisi tidak sesuai dengan booking.'
            WHEN i.booking_id IS NOT NULL
                 AND b.is_confirmed = false
                THEN 'Booking belum dikonfirmasi. Silakan konfirmasi ke Admin Bengkel.'
            WHEN i.booking_id IS NOT NULL
                 AND b.is_within_window = false
                THEN 'Booking sudah melewati batas H-1. Silakan konfirmasi ulang ke Admin Bengkel.'
            WHEN i.booking_id IS NOT NULL
                 AND b.can_checkin = false
                THEN 'Booking belum dapat digunakan untuk check-in.'
            WHEN i.booking_id IS NULL
                 AND EXISTS (
                     SELECT 1
                     FROM sch_fleet.v_security_booking_active x
                     WHERE x.no_polisi_clean = i.no_polisi
                       AND x.should_show = true
                 )
                THEN 'Plat ini memiliki booking aktif. Silakan pilih data booking.'
            WHEN EXISTS (
                SELECT 1
                FROM sch_pos.kunjungan_masuk km
                WHERE REPLACE(UPPER(TRIM(km.no_polisi)), ' ', '') = i.no_polisi
                  AND km.waktu_check_out IS NULL
            )
                THEN 'Kendaraan masih tercatat di dalam bengkel.'
            ELSE NULL
        END AS error_message
    FROM input i
    LEFT JOIN sch_fleet.v_security_booking_active b
        ON b.booking_id = i.booking_id
),
ins_km AS (
    INSERT INTO sch_pos.kunjungan_masuk (
        nomor_tiket,
        booking_id,
        jenis_kedatangan,
        no_polisi,
        nama_pengemudi,
        no_telepon_pengemudi,
        tipe_kunjungan,
        keluhan,
        waktu_masuk,
        petugas_security_masuk,
        catatan_masuk,
        pic_tujuan
    )
    SELECT
        COALESCE(
            NULLIF(TRIM(CAST(:nomor_tiket AS text)), ''),
            'TG-' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYMMDD') || '-' ||
            LPAD(COALESCE((
                SELECT COUNT(*) + 1
                FROM sch_pos.kunjungan_masuk
                WHERE DATE(waktu_masuk AT TIME ZONE 'Asia/Jakarta')
                    = (NOW() AT TIME ZONE 'Asia/Jakarta')::date
            ), 1)::text, 4, '0')
        ),
        v.booking_id,
        CASE
            WHEN v.booking_id IS NOT NULL THEN 'BOOKING'
            ELSE v.jenis_kedatangan
        END,
        v.no_polisi,
        NULLIF(TRIM(CAST(:nama_pengemudi AS text)), ''),
        NULLIF(TRIM(CAST(:no_telepon_pengemudi AS text)), ''),
        COALESCE(NULLIF(TRIM(CAST(:tipe_kunjungan AS text)), ''), 'SERVICE'),
        NULLIF(TRIM(CAST(:keluhan AS text)), ''),
        NOW() AT TIME ZONE 'Asia/Jakarta',
        COALESCE(
            NULLIF(TRIM(CAST(:petugas_security AS text)), ''),
            :sys_user,
            'Security KIM 3'
        ),
        NULLIF(TRIM(CAST(:catatan_masuk AS text)), ''),
        NULLIF(TRIM(CAST(:pic_tujuan AS text)), '')
    FROM validation v
    WHERE v.error_message IS NULL
    RETURNING *
),
upd_booking AS (
    UPDATE sch_fleet.booking_service b
    SET status = 'check_in',
        update_by = 'Security',
        update_dt = NOW()
    FROM ins_km k
    WHERE k.booking_id IS NOT NULL
      AND b.id = k.booking_id
    RETURNING b.id
)
SELECT
    (EXISTS (SELECT 1 FROM ins_km)) AS success,
    CASE
        WHEN EXISTS (SELECT 1 FROM ins_km) THEN 'Check-in berhasil.'
        ELSE COALESCE(
            (SELECT error_message FROM validation),
            'Check-in gagal. Silakan periksa data kendaraan.'
        )
    END AS message,
    km.id,
    km.nomor_tiket,
    km.booking_id,
    km.jenis_kedatangan,
    km.no_polisi,
    km.nama_pengemudi,
    km.no_telepon_pengemudi,
    km.tipe_kunjungan,
    km.keluhan,
    km.waktu_masuk,
    km.petugas_security_masuk,
    km.catatan_masuk,
    km.pic_tujuan
FROM (SELECT 1) dummy
LEFT JOIN ins_km km ON true;
$sql$,
    parameters = '[{"name":"nomor_tiket","type":"string","required":false},{"name":"no_polisi","type":"string","required":true},{"name":"booking_id","type":"integer","required":false},{"name":"jenis_kedatangan","type":"string","required":false},{"name":"nama_pengemudi","type":"string","required":false},{"name":"no_telepon_pengemudi","type":"string","required":false},{"name":"tipe_kunjungan","type":"string","required":false},{"name":"keluhan","type":"string","required":false},{"name":"petugas_security","type":"string","required":false},{"name":"catatan_masuk","type":"string","required":false},{"name":"pic_tujuan","type":"string","required":false}]',
    auth_token = 'KIM3-SECURE-TOKEN-2026-X998A7B6C',
    allowed_roles = NULL,
    updated_at = NOW()
WHERE endpoint_path = '/kim3/security/check-in'
  AND method = 'POST';

-- ---------------------------------------------------------------------------
-- 3. UPDATE: GET /kim3/security/active-inside -> tampilkan pic_tujuan
-- ---------------------------------------------------------------------------
UPDATE sch_sync.api_endpoints
SET sql_query = REPLACE(
    sql_query,
    '    km.petugas_security_masuk,',
    E'    km.pic_tujuan,\n    km.petugas_security_masuk,'
)
WHERE endpoint_path = '/kim3/security/active-inside'
  AND method = 'GET'
  AND sql_query NOT LIKE '%km.pic_tujuan%';

-- ---------------------------------------------------------------------------
-- 4. UPDATE: GET /kim3/security/memo-keluar -> tampilkan pic_tujuan
-- ---------------------------------------------------------------------------
UPDATE sch_sync.api_endpoints
SET sql_query = REPLACE(
    sql_query,
    '    km.petugas_security_masuk,',
    E'    km.pic_tujuan,\n    km.petugas_security_masuk,'
)
WHERE endpoint_path = '/kim3/security/memo-keluar'
  AND method = 'GET'
  AND sql_query NOT LIKE '%km.pic_tujuan%';
-- ENDPOINTS END

-- ##############################################################################
-- VERIFIKASI (jalankan manual bila perlu)
-- ##############################################################################
-- dba_dev_pos:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='sch_pos' AND table_name='kunjungan_masuk'
--      AND column_name='pic_tujuan';
-- data_setting_sync:
--   SELECT endpoint_path, method FROM sch_sync.api_endpoints
--    WHERE endpoint_path IN ('/kim3/security/employees','/kim3/security/check-in',
--          '/kim3/security/active-inside','/kim3/security/memo-keluar')
--    ORDER BY endpoint_path;
--   SELECT sql_query LIKE '%pic_tujuan%' FROM sch_sync.api_endpoints
--    WHERE endpoint_path IN ('/kim3/security/check-in','/kim3/security/active-inside',
--          '/kim3/security/memo-keluar');
