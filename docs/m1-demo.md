# M1 demo run

This is the record of the M1 success signal, run end to end on the demo laptop (ticket 1.18). Fill in each blank as you go. A check passes only when every item under it passes. Run every command from the repository root.

| | |
| --- | --- |
| Date | |
| Run by | |
| Laptop and OS | |
| Node, MySQL, Mosquitto | `node -v`: · MySQL: · Mosquitto: · native or compose: |
| Commit | `git log --oneline -1`: |
| Browser | Chromium version: , full screen (F11) at 1920×1080 |

## Results

| # | Done when | Pass? | Notes |
| --- | --- | --- | --- |
| 1 | A fresh clone installs, then starts offline, and the gates pass | | |
| 2 | CAP-1: simulated telemetry fills every view, and the backend can stop and return | | |
| 3 | CAP-3: live status on `/` | | |
| 4 | CAP-5: override Flow 1 and its failure paths | | |
| 5 | CAP-4 and CAP-6: traffic peaks and the breach log | | |
| 6 | CAP-2: history survives a restart | | |

## 1. Fresh clone, offline start, gates

With the internet on:

- [ ] `git clone git@github.com:lirrnaiad/catarman-smart-traffic-light.git`, then follow `docs/setup.md` steps 1 to 6, or its Compose path.
- [ ] `npm run db:seed` loads 24 h of demo counts, so `/traffic/` has history.
- [ ] `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` all pass.

Turn the internet off (Wi-Fi off, cable out), then:

- [ ] Terminal 1: `npm run build`, then `npm start`. The backend logs that it listens on `127.0.0.1:4000`.
- [ ] Terminal 2: `npm run sim -- --scenario demo`. Keep this terminal open: its REPL drives the checks below.
- [ ] Open `http://127.0.0.1:4000/` in Chromium, full screen. The dashboard shows simulated telemetry.

The demo scenario stops the vision role at 32 s, raises a sensor fault at 42 s and turns flood on at 52 s. When it finishes, type `vision start`, `sensor ok` and `flood off` before the checks that need a healthy intersection. L4 holds until the sensor has been dry for 30 s, then resumes through an all-red (degradation-levels.md), so wait for L1 after `flood off`.

## 2. CAP-1: simulated telemetry, backend stop

- [ ] Every M1 view fills and updates with no vision node or ESP32: `/`, `/traffic/`, `/breaches/`, `/log/overrides/`, `/log/states/`.
- [ ] The REPL drives each of these, and `/` shows it: `level L1`, `level L2`, `level L3`, `level L4`, then `level auto`; `flood on`, then `flood off`; `sensor fault`, then `sensor ok`; `conflict raise`, then `conflict reset`; `emit-breach`.
- [ ] Stop the backend (Ctrl+C in terminal 1) while the simulator runs. The simulator keeps cycling (`state` in the REPL shows the aspects changing). The dashboard marks every panel STALE, and the link health bar reads Broker disconnected.
- [ ] `npm start` again. Without a reload, the dashboard reconnects and goes live.

## 3. CAP-3: live status on `/`

- [ ] At 1920×1080 the page has no scroll bar.
- [ ] Each aspect, level, flood and fault change appears within 1 s, with no reload.
- [ ] L1, L2, L3, L4 (flashing amber), FAULT and an active override each read distinctly, and the banners follow them.

## 4. CAP-5: override Flow 1 and its failure paths

- [ ] Flow 1: during L4 (`level L4`), press Corridor NS. A confirm dialog opens. Confirm. The panel reads Pending (only for a moment, since the simulator acks within about 25 ms; the timeout path below holds it for 5 s), then Current shows Corridor NS beside the L4 ladder. The heads go through a 2 s all-red, then NS holds green. Release (confirmed too) returns to automatic.
- [ ] `/log/overrides/` has a timestamped entry for each activation and release.
- [ ] Conflict fault: `conflict raise`, then press any override and confirm. The rejected notice shows. Then `conflict reset`.
- [ ] Controller offline: type `quit` in terminal 2, press any override and confirm. The controller-offline notice shows.
- [ ] Timeout: with the simulator still stopped, run a fake controller that never acks (terminal 2, or Windows PowerShell 7). Press Corridor NS and confirm. After 5 s the timeout notice shows.

  ```sh
  mosquitto_pub -t stl/int-01/controller/status -r -m '{"v":1,"online":true,"source":"sim"}'
  for i in $(seq 30); do mosquitto_pub -t stl/int-01/controller/state -m '{"v":1,"level":"L1","signals":{"NS":"GREEN","EW":"RED"},"flood":"DRY","fault":false}'; sleep 1; done
  mosquitto_pub -t stl/int-01/controller/status -r -m '{"v":1,"online":false,"source":"sim"}'
  ```

  In PowerShell 7, the loop is `1..30 | % { mosquitto_pub ...; Start-Sleep 1 }`. On the Compose path, put `docker exec smart-traffic-light-mosquitto-1` in front of each `mosquitto_pub`. Restart the simulator with `npm run sim` afterwards.

## 5. CAP-4 and CAP-6: traffic peaks and the breach log

- [ ] `/traffic/` shows 24 bars for today and flags the peak hour. Each hour's total equals the stored sum for that hour, which this query gives (`mysql -u stl -p stl`, password `stl`, or MySQL Workbench). Change the date to today's:

  ```sql
  SELECT HOUR(occurred_at + INTERVAL 8 HOUR) AS manila_hour, SUM(count) AS total
  FROM vehicle_count
  WHERE DATE(occurred_at + INTERVAL 8 HOUR) = '2026-10-26'
  GROUP BY manila_hour ORDER BY manila_hour;
  ```

  Compare it with `http://127.0.0.1:4000/api/counts/hourly?date=2026-10-26`, each bucket's `total`, and spot-check the peak bar on `/traffic/`.
- [ ] `/breaches/` lists every breach, newest first, with the time, class, approach and the blurred crop.
- [ ] No identifying data is stored or shown. `DESCRIBE breach_event;` lists only the event id, approach, class, centroid and times. The crop is the bundled blurred placeholder, 64 px at most.

## 6. CAP-2: history survives a restart

With the internet still off:

- [ ] Note what `/log/states/`, `/log/overrides/`, `/breaches/` and today's `/traffic/` show.
- [ ] Stop the backend (Ctrl+C in terminal 1). In the REPL, `emit-breach N car`, then `emit-breach S jeepney`. Wait 10 s so the simulator also publishes counts.
- [ ] Restart MySQL: `sudo systemctl restart mysqld` (Fedora), `sudo systemctl restart mysql` (Ubuntu), `Restart-Service MySQL*` as administrator (Windows), or `docker compose -f infra/compose.yaml restart mysql`.
- [ ] `npm start`. Everything noted above is still there, and `/breaches/` now also lists the two breaches sent while the backend was down. The counts sent while it was down appear in the current hour.

## Submission

When all six checks pass, commit this file on a branch, open a pull request and merge it. `main` is protected, so it can't be pushed to directly. That merge is the M1 submission.
