# M1 demo run

This is the record of the M1 success signal, run end to end on the demo laptop (ticket 1.18). Fill in each blank as you go. A check passes only when every item under it passes. Run every command from the repository root.

| | |
| --- | --- |
| Date | 2026-10-26, 13:50 to 14:10 (Asia/Manila) |
| Run by | Claude Code, driving Chrome through Claude in Chrome, for Sean. The offline pass on the demo laptop is still to do (see [About this run](#about-this-run)). |
| Laptop and OS | Sean's laptop, Fedora Linux 44 (kernel 7.2.11) |
| Node, MySQL, Mosquitto | `node -v`: v24.22.1 · MySQL: 9.7.4 · Mosquitto: 2.1.2 · native or compose: compose (Docker 29.9.2, rootless) |
| Commit | `git log --oneline -1`: `90138d1 Merge pull request #23 from lirrnaiad/docs/m1-demo-checklist` |
| Browser | Google Chrome 156.0.8078.47 on a 1920×1080 screen. Not F11: the window gave the page 1920×937, so the layout was measured (see check 3) |

## Results

| # | Done when | Pass? | Notes |
| --- | --- | --- | --- |
| 1 | A fresh clone installs, then starts offline, and the gates pass | Pass, offline simulated | Install, seed and gates pass. `npm run build` passes in a sandbox with no network. The run itself had the internet on, but every socket stayed on loopback |
| 2 | CAP-1: simulated telemetry fills every view, and the backend can stop and return | Pass | Every REPL command showed on `/`. Backend stop: all 7 panels STALE, Broker disconnected; back live with no reload |
| 3 | CAP-3: live status on `/` | Pass, measured | Document 1080 px tall and `main` 948/948 in every state. Commands reach the stream in 6 to 54 ms |
| 4 | CAP-5: override Flow 1 and its failure paths | Pass | Ack in 57 ms, 2 s all-red, then NS green. Conflict fault, controller offline and the 5 s timeout notices all show |
| 5 | CAP-4 and CAP-6: traffic peaks and the breach log | Pass | 24/24 hours equal the SQL sums, peak 07:00 = 3012. Crop is a 64×48 JPEG |
| 6 | CAP-2: history survives a restart | Pass | Nothing lost. The 2 breaches and 39 count rows sent while the backend was down are stored |

## About this run

This run was made with the internet on, because Claude in Chrome needs it. Instead of cutting the internet, it showed the system needs none:

- `npm run build` ran inside `unshare -rn`, a sandbox with no network (a probe to github.com failed), and passed.
- While the backend and simulator ran, `ss -tanp` listed every TCP socket they held. All were on `127.0.0.1`: the API listening on port 4000, MySQL on 3306, the broker on 1883 and the browser on loopback.
- Chrome's request log for every view lists only `http://127.0.0.1:4000` and `data:` URLs. It also shows Next.js's `HEAD` prefetch probes as 503, but the same `HEAD` requests return 200 from the page and from `curl`, so these are prefetches the log caught, not errors.

The Chrome window could not go full screen at 1920×1080 (the page asked, but the viewport stayed 1920×937). The dashboard is a fixed 1080 px layout, so check 3 measured it in each state: the document's height, `main`'s scroll and client height, whether each override button's center hits that button, whether buttons overlap or overflow, and whether the fault row stays inside its panel.

Still to do by a person on the demo laptop, about five minutes: turn the internet off, run `npm run build`, `npm start` and `npm run sim -- --scenario demo`, press F11, and check that `/` has no scroll bar and updates live, including at L4. Then fill in this line:

- [ ] Offline pass on the demo laptop: date, by, laptop, result:

## 1. Fresh clone, offline start, gates

With the internet on:

- [x] `git clone git@github.com:lirrnaiad/catarman-smart-traffic-light.git`, then follow `docs/setup.md` steps 1 to 6, or its Compose path.
- [x] `npm run db:seed` loads 24 h of demo counts, so `/traffic/` has history.
- [x] `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` all pass.

Turn the internet off (Wi-Fi off, cable out), then (this run left it on; see [About this run](#about-this-run)):

- [x] Terminal 1: `npm run build`, then `npm start`. The backend logs that it listens on `127.0.0.1:4000`.
- [x] Terminal 2: `npm run sim -- --scenario demo`. Keep this terminal open: its REPL drives the checks below.
- [x] Open `http://127.0.0.1:4000/` in Chromium, full screen. The dashboard shows simulated telemetry.

The demo scenario stops the vision role at 32 s, raises a sensor fault at 42 s and turns flood on at 52 s. When it finishes, type `vision start`, `sensor ok` and `flood off` before the checks that need a healthy intersection. L4 holds until the sensor has been dry for 30 s, then resumes through an all-red (degradation-levels.md), so wait for L1 after `flood off`.

## 2. CAP-1: simulated telemetry, backend stop

- [x] Every M1 view fills and updates with no vision node or ESP32: `/`, `/traffic/`, `/breaches/`, `/log/overrides/`, `/log/states/`.
- [x] The REPL drives each of these, and `/` shows it: `level L1`, `level L2`, `level L3`, `level L4`, then `level auto`; `flood on`, then `flood off`; `sensor fault`, then `sensor ok`; `conflict raise`, then `conflict reset`; `emit-breach`.
- [x] Stop the backend (Ctrl+C in terminal 1) while the simulator runs. The simulator keeps cycling (`state` in the REPL shows the aspects changing). The dashboard marks every panel STALE, and the link health bar reads Broker disconnected.
- [x] `npm start` again. Without a reload, the dashboard reconnects and goes live.

## 3. CAP-3: live status on `/`

- [x] At 1920×1080 the page has no scroll bar.
- [x] Each aspect, level, flood and fault change appears within 1 s, with no reload.
- [x] L1, L2, L3, L4 (flashing amber), FAULT and an active override each read distinctly, and the banners follow them.

## 4. CAP-5: override Flow 1 and its failure paths

- [x] Flow 1: during L4 (`level L4`), press Corridor NS. A confirm dialog opens. Confirm. The panel reads Pending (only for a moment, since the simulator acks within about 25 ms; the timeout path below holds it for 5 s), then Current shows Corridor NS beside the L4 ladder. The heads go through a 2 s all-red, then NS holds green. Release (confirmed too) returns to automatic.
- [x] `/log/overrides/` has a timestamped entry for each activation and release.
- [x] Conflict fault: `conflict raise`, then press any override and confirm. The rejected notice shows. Then `conflict reset`.
- [x] Controller offline: type `quit` in terminal 2, press any override and confirm. The controller-offline notice shows.
- [x] Timeout: with the simulator still stopped, run a fake controller that never acks (terminal 2, or Windows PowerShell 7). Press Corridor NS and confirm. After 5 s the timeout notice shows.

  ```sh
  mosquitto_pub -t stl/int-01/controller/status -r -m '{"v":1,"online":true,"source":"sim"}'
  for i in $(seq 30); do mosquitto_pub -t stl/int-01/controller/state -m '{"v":1,"level":"L1","signals":{"NS":"GREEN","EW":"RED"},"flood":"DRY","fault":false}'; sleep 1; done
  mosquitto_pub -t stl/int-01/controller/status -r -m '{"v":1,"online":false,"source":"sim"}'
  ```

  In PowerShell 7, the loop is `1..30 | % { mosquitto_pub ...; Start-Sleep 1 }`. On the Compose path, put `docker exec smart-traffic-light-mosquitto-1` in front of each `mosquitto_pub`. Restart the simulator with `npm run sim` afterwards.

## 5. CAP-4 and CAP-6: traffic peaks and the breach log

- [x] `/traffic/` shows 24 bars for today and flags the peak hour. Each hour's total equals the stored sum for that hour, which this query gives (`mysql -u stl -p stl`, password `stl`, or MySQL Workbench). Change the date to today's:

  ```sql
  SELECT HOUR(occurred_at + INTERVAL 8 HOUR) AS manila_hour, SUM(count) AS total
  FROM vehicle_count
  WHERE DATE(occurred_at + INTERVAL 8 HOUR) = '2026-10-26'
  GROUP BY manila_hour ORDER BY manila_hour;
  ```

  Compare it with `http://127.0.0.1:4000/api/counts/hourly?date=2026-10-26`, each bucket's `total`, and spot-check the peak bar on `/traffic/`.
- [x] `/breaches/` lists every breach, newest first, with the time, class, approach and the blurred crop.
- [x] No identifying data is stored or shown. `DESCRIBE breach_event;` lists only the event id, approach, class, centroid and times. The crop is the bundled blurred placeholder, 64 px at most.

## 6. CAP-2: history survives a restart

With the internet still off (this run: on). This run did check 6 together with check 2's backend stop:

- [x] Note what `/log/states/`, `/log/overrides/`, `/breaches/` and today's `/traffic/` show.
- [x] Stop the backend (Ctrl+C in terminal 1). In the REPL, `emit-breach N car`, then `emit-breach S jeepney`. Wait 10 s so the simulator also publishes counts.
- [x] Restart MySQL: `sudo systemctl restart mysqld` (Fedora), `sudo systemctl restart mysql` (Ubuntu), `Restart-Service MySQL*` as administrator (Windows), or `docker compose -f infra/compose.yaml restart mysql`.
- [x] `npm start`. Everything noted above is still there, and `/breaches/` now also lists the two breaches sent while the backend was down. The counts sent while it was down appear in the current hour.

## Submission

When all six checks pass, commit this file on a branch, open a pull request and merge it. `main` is protected, so it can't be pushed to directly. That merge is the M1 submission.
