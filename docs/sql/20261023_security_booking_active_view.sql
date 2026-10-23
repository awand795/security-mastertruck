-- ==============================================================================
-- SECURITY CHECK-IN: BOOKING ACTIVE VIEW
-- Database: dba_dev_pos (122.248.253.73:8832)
-- Schema : sch_fleet
-- Tanggal: 23 Oktober 2026
--
-- Tujuan:
-- - Satu baris per booking aktif (tidak dobel walau ada beberapa baris POS).
-- - Mengekspos status lokal booking_service dan status POS.
-- - Menentukan booking yang masih dalam window H-1, booking lama yang belum
--   confirmed (tetap diblokir), dan booking lama yang sudah confirmed (diabaikan).
-- ==============================================================================

DROP VIEW IF EXISTS sch_fleet.v_security_booking_active;

CREATE OR REPLACE VIEW sch_fleet.v_security_booking_active AS
WITH base AS (
    SELECT
        b.id AS booking_id,
        b.no_booking,
        b.no_polisi,
        REPLACE(UPPER(TRIM(b.no_polisi)), ' ', '') AS no_polisi_clean,
        b.id_pelanggan,
        u.nama_lengkap AS customer_name,
        u.no_telepon AS customer_telepon,
        b.jenis_layanan,
        b.keluhan,
        b.catatan,
        COALESCE(
            (p.reschedule_date AT TIME ZONE 'Asia/Jakarta')::date,
            b.tanggal_booking
        ) AS tanggal_booking,
        COALESCE(
            TO_CHAR(p.reschedule_date AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
            b.jam_booking
        ) AS jam_booking,
        b.status AS status_lokal,
        p.status::text AS status_pos,
        CASE
            WHEN COALESCE(b.is_canceled, false) = true
                 OR p.status = 'CANCELED' THEN 'Dibatalkan'
            WHEN p.status = 'RESCHEDULED' THEN 'Rescheduled'
            WHEN p.status = 'CONFIRMED'
                 OR LOWER(COALESCE(b.status, '')) = 'confirmed' THEN 'Confirmed'
            WHEN LOWER(COALESCE(b.status, '')) = 'rescheduled' THEN 'Rescheduled'
            ELSE 'Menunggu Konfirmasi'
        END AS status_booking
    FROM sch_fleet.booking_service b
    LEFT JOIN LATERAL (
        SELECT p.status, p.reschedule_date
        FROM sch_pos.tbl_fleet_booking_service p
        WHERE p.booking_no = b.no_booking
        ORDER BY p.id DESC
        LIMIT 1
    ) p ON true
    LEFT JOIN sch_fleet.pengguna u ON u.id = b.id_pelanggan
    WHERE COALESCE(b.is_canceled, false) = false
      AND LOWER(COALESCE(b.status, '')) NOT IN (
          'check_in', 'check_out', 'booking canceled', 'dibatalkan'
      )
      AND COALESCE(p.status::text, '') <> 'CANCELED'
      AND NOT EXISTS (
          SELECT 1
          FROM sch_pos.kunjungan_masuk km
          WHERE km.booking_id = b.id
            AND km.waktu_check_out IS NULL
      )
)
SELECT
    base.*,
    (base.status_booking = 'Confirmed') AS is_confirmed,
    (
        base.tanggal_booking
        >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - 1
    ) AS is_within_window,
    (
        base.tanggal_booking
        < (NOW() AT TIME ZONE 'Asia/Jakarta')::date - 1
        AND base.status_booking <> 'Confirmed'
    ) AS is_stale_unconfirmed,
    (
        base.tanggal_booking
        < (NOW() AT TIME ZONE 'Asia/Jakarta')::date - 1
        AND base.status_booking = 'Confirmed'
    ) AS is_stale_confirmed,
    (
        base.tanggal_booking
        >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - 1
        OR (
            base.tanggal_booking
            < (NOW() AT TIME ZONE 'Asia/Jakarta')::date - 1
            AND base.status_booking <> 'Confirmed'
        )
    ) AS should_show,
    (
        base.status_booking = 'Confirmed'
        AND base.tanggal_booking
            >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - 1
    ) AS can_checkin
FROM base;

COMMENT ON VIEW sch_fleet.v_security_booking_active IS
'Booking aktif untuk live search Security. should_show = booking dalam window H-1 atau booking lama yang masih belum confirmed (wajib diblokir).';
