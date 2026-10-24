- source_plan: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-s0-workspace-contracts-schema-and-local-infra-plan.md`
  summary: Verify `npm run broker` (infra/scripts/broker.mjs with infra/mosquitto/mosquitto.conf) against a native Mosquitto 2.0/2.1 on Linux and Windows, including the `C:\Program Files\mosquitto` fallback.
  evidence: Ticket 1.1's verify requires `npm run broker` to succeed on a fresh clone, but the S0 machine had no native Mosquitto, so only compose and a stub were tested. To settle it, install Mosquitto (Fedora `sudo dnf install mosquitto`, the mosquitto.org Windows installer), stop the OS service, run `npm run broker`, and confirm it listens on 127.0.0.1:1883 and writes infra/mosquitto/data/.
- source_spec: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-2-backend-core-http-database-and-sse-hub-plan.md`
  summary: Test the `npm run db:seed` CLI path as a child process: multi-statement seed files apply, and a SQL error exits 1.
  evidence: Story 1.2's tests import only `seed()` with their own pool, so dropping `multipleStatements: true` or `process.exitCode = 1` from `backend/scripts/db-seed.ts` passes every test. No seed files exist yet; entry 12 adds the first one.
- source_spec: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-2-backend-core-http-database-and-sse-hub-plan.md`
  summary: Test that `createApp` serves `dashboard/out/` at `/`, and that `/api/nope` still returns the JSON 404.
  evidence: The static mount in `backend/src/app.ts` has no test, and its path is a module-level constant. A wrong relative path or a mount above `/api` passes every current test. Settle it once the dashboard export exists (entry 7 or entry 18's demo run).
- source_spec: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-2-backend-core-http-database-and-sse-hub-plan.md`
  summary: Test the `DASHBOARD_ORIGINS` parse default and trimming in `backend/src/config.ts`.
  evidence: The tests always load `.env.test`'s exact, space-free value, so changing the default or removing `.trim()` passes. It needs the `Env` schema exported or a mocked-env re-import.
- source_spec: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-12-history-vehicle-counts-and-the-counts-slice-plan.md`
  summary: A persist handler that hits a transient DB error loses that QoS 1 message, because dispatch acks it anyway and handlers swallow errors per message.
  evidence: `backend/src/mqtt/client.ts` runs `void dispatch(...)`; `vision-counts.persist.ts` logs and returns on an insert failure. This comes from the 1.3 ingest design and affects every persist handler (counts, breaches).
- source_spec: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-12-history-vehicle-counts-and-the-counts-slice-plan.md`
  summary: AD-5's redelivery rule ("affectedRows is 0") never fires, because mysql2 connects with CLIENT_FOUND_ROWS; story 15's breach insert needs the same insertId-based check that story 12 uses, or the spine's wording should change.
  evidence: The story 12 implementer probed this against MySQL. `vehicle_count.insert.ts` returns `insertId > 0`, and its redelivery test runs against the real database.
