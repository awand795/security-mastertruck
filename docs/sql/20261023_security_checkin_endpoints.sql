-- ==============================================================================
-- SECURITY CHECK-IN: LIVE SEARCH CANDIDATES + SERVER-SIDE VALIDATION
-- Database: data_setting_sync (127.0.0.1:8832 via SSH API Builder)
-- Schema : sch_sync
-- Tanggal: 23 Oktober 2026
--
-- Perubahan:
-- 1. Endpoint baru GET /kim3/security/checkin-candidates
--    - Booking aktif (window H-1 + booking lama yang belum confirmed)
--    - Unit dari sch_fleet.v_kendaraan_lookup
--    - Satu daftar gabungan untuk live search plat.
-- 2. Endpoint POST /kim3/security/check-in
--    - Validasi booking confirmed / window H-1 / plat cocok.
--    - Menolak walk-in jika plat masih punya booking aktif.
--    - Mengembalikan success + message.
--
-- Prasyarat: jalankan 20261023_security_booking_active_view.sql di dba_dev_pos.
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENDPOINT: GET /kim3/security/checkin-candidates
-- -----------------------------------------------------------------------------
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
    'Security Check-In Candidates',
    'GET',
    '/kim3/security/checkin-candidates',
    '1790050800000',
    $sql$
WITH active_bookings AS (
    SELECT *
    FROM sch_fleet.v_security_booking_active
    WHERE should_show = true
      AND (
          COALESCE(CAST(:q AS text), '') = ''
          OR no_polisi_clean ILIKE '%' || REPLACE(UPPER(CAST(:q AS text)), ' ', '') || '%'
      )
    ORDER BY
        is_confirmed DESC,
        is_stale_unconfirmed ASC,
        tanggal_booking ASC,
        jam_booking ASC,
        booking_id DESC
    LIMIT 10
),
unit_members AS (
    SELECT DISTINCT ON (v.no_polisi_clean)
        v.id AS unit_id,
        v.no_polisi,
        v.no_polisi_clean,
        v.member_id,
        v.nama_perusahaan,
        v.nama_pengguna_fleet,
        v.nama_pic,
        v.no_telepon,
        v.jenis_armada,
        v.merk,
        v.model,
        v.tahun,
        v.status_aktif,
        EXISTS (
            SELECT 1
            FROM sch_fleet.v_security_booking_active b
            WHERE b.no_polisi_clean = v.no_polisi_clean
              AND b.should_show = true
        ) AS has_active_booking
    FROM sch_fleet.v_kendaraan_lookup v
    WHERE (
        COALESCE(CAST(:q AS text), '') = ''
        OR v.no_polisi_clean ILIKE '%' || REPLACE(UPPER(CAST(:q AS text)), ' ', '') || '%'
    )
    ORDER BY
        v.no_polisi_clean,
        v.status_aktif DESC NULLS LAST,
        v.id DESC
    LIMIT 10
),
combined AS (
SELECT
    'BOOKING'::text AS source,
    b.booking_id,
    b.no_booking,
    b.no_polisi,
    b.no_polisi_clean,
    b.customer_name,
    b.customer_telepon,
    b.jenis_layanan,
    b.keluhan,
    b.catatan,
    b.tanggal_booking,
    b.jam_booking,
    b.status_booking,
    b.is_confirmed,
    b.can_checkin,
    b.is_within_window,
    b.is_stale_unconfirmed,
    NULL::integer AS unit_id,
    NULL::integer AS member_id,
    NULL::text AS nama_perusahaan,
    NULL::text AS nama_pengguna_fleet,
    NULL::text AS nama_pic,
    NULL::text AS unit_telepon,
    NULL::text AS jenis_armada,
    NULL::text AS merk,
    NULL::text AS model,
    NULL::integer AS tahun,
    NULL::boolean AS status_aktif,
    false AS has_active_booking
FROM active_bookings b

UNION ALL

SELECT
    'MEMBER_UNIT'::text AS source,
    NULL::integer AS booking_id,
    NULL::text AS no_booking,
    u.no_polisi,
    u.no_polisi_clean,
    u.nama_perusahaan AS customer_name,
    u.no_telepon AS customer_telepon,
    NULL::text AS jenis_layanan,
    NULL::text AS keluhan,
    NULL::text AS catatan,
    NULL::date AS tanggal_booking,
    NULL::text AS jam_booking,
    NULL::text AS status_booking,
    false AS is_confirmed,
    (NOT u.has_active_booking) AS can_checkin,
    false AS is_within_window,
    false AS is_stale_unconfirmed,
    u.unit_id,
    u.member_id,
    u.nama_perusahaan,
    u.nama_pengguna_fleet,
    u.nama_pic,
    u.no_telepon AS unit_telepon,
    u.jenis_armada,
    u.merk,
    u.model,
    u.tahun,
    u.status_aktif,
    u.has_active_booking
FROM unit_members u
)
SELECT *
FROM combined
ORDER BY
    CASE source WHEN 'BOOKING' THEN 0 ELSE 1 END,
    is_confirmed DESC,
    is_stale_unconfirmed ASC,
    tanggal_booking ASC NULLS LAST,
    jam_booking ASC NULLS LAST,
    no_polisi ASC
LIMIT 20;
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

-- -----------------------------------------------------------------------------
-- 2. ENDPOINT: POST /kim3/security/check-in
-- -----------------------------------------------------------------------------
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
        catatan_masuk
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
        NULLIF(TRIM(CAST(:catatan_masuk AS text)), '')
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
    km.catatan_masuk
FROM (SELECT 1) dummy
LEFT JOIN ins_km km ON true;
$sql$,
    parameters = '[{"name":"nomor_tiket","type":"string","required":false},{"name":"no_polisi","type":"string","required":true},{"name":"booking_id","type":"integer","required":false},{"name":"jenis_kedatangan","type":"string","required":false},{"name":"nama_pengemudi","type":"string","required":false},{"name":"no_telepon_pengemudi","type":"string","required":false},{"name":"tipe_kunjungan","type":"string","required":false},{"name":"keluhan","type":"string","required":false},{"name":"petugas_security","type":"string","required":false},{"name":"catatan_masuk","type":"string","required":false}]',
    auth_token = 'KIM3-SECURE-TOKEN-2026-X998A7B6C',
    allowed_roles = NULL,
    updated_at = NOW()
WHERE endpoint_path = '/kim3/security/check-in'
  AND method = 'POST';

-- -----------------------------------------------------------------------------
-- 3. PASTIKAN FOTO CHECK-IN BISA DIUNGGAH DENGAN STATIC API KEY
-- -----------------------------------------------------------------------------
UPDATE sch_sync.api_endpoints
SET security_mode = 'HYBRID',
    allowed_roles = NULL,
    auth_token = 'KIM3-SECURE-TOKEN-2026-X998A7B6C',
    updated_at = NOW()
WHERE endpoint_path = '/kim3/security/add-foto'
  AND method = 'POST';

-- -----------------------------------------------------------------------------
-- 4. VERIFIKASI
-- -----------------------------------------------------------------------------
SELECT endpoint_path, method, name
FROM sch_sync.api_endpoints
WHERE endpoint_path IN (
    '/kim3/security/checkin-candidates',
    '/kim3/security/check-in'
)
ORDER BY endpoint_path;
