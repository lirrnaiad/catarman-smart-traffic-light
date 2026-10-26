-- About 24 h of demo vehicle counts ending now (entry 12). One message per 5-minute slot,
-- every approach x configured class. Deterministic: motorcycles and tricycles dominate,
-- with peaks around 07:00 and 17:00 Asia/Manila. Re-running replaces the seed rows.

-- One transaction, so a failed insert keeps the previous seed.
START TRANSACTION;

DELETE FROM vehicle_count WHERE msg_id LIKE '00000000-5eed-%';

INSERT INTO vehicle_count (msg_id, approach, vehicle_class, count, occurred_at, received_at)
WITH RECURSIVE
  slots (n) AS (
    SELECT 0 UNION ALL SELECT n + 1 FROM slots WHERE n < 287
  ),
  timed AS (
    SELECT n, UTC_TIMESTAMP(3) - INTERVAL (n * 5) MINUTE AS at FROM slots
  ),
  classes (id, weight, k) AS (
    SELECT 'motorcycle', 6, 0 UNION ALL
    SELECT 'tricycle', 5, 1 UNION ALL
    SELECT 'car', 2, 2 UNION ALL
    SELECT 'jeepney', 1, 3 UNION ALL
    SELECT 'utility_van', 1, 4
  ),
  approaches (a, mul, j) AS (
    SELECT 'N', 1.2, 0 UNION ALL
    SELECT 'S', 1.1, 1 UNION ALL
    SELECT 'E', 0.9, 2 UNION ALL
    SELECT 'W', 0.8, 3
  ),
  shaped AS (
    SELECT t.n, t.at, c.id, c.weight, c.k, p.a, p.mul, p.j,
           HOUR(CONVERT_TZ(t.at, '+00:00', '+08:00')) AS h
    FROM timed t CROSS JOIN classes c CROSS JOIN approaches p
  )
SELECT
  CONCAT('00000000-5eed-4000-8000-', LPAD(n, 12, '0')),
  a,
  id,
  GREATEST(1, ROUND(
    weight * mul
    * (CASE WHEN h < 5 THEN 0.2 WHEN h >= 22 THEN 0.4 ELSE 1 END
       + 2.5 * GREATEST(0, 1 - ABS(h - 7) / 2)
       + 2.5 * GREATEST(0, 1 - ABS(h - 17) / 2))
    * (1 + MOD(n * 7 + k * 3 + j, 5) / 10)
  )),
  at,
  at
FROM shaped;

COMMIT;
