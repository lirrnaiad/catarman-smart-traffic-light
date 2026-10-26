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
- source_spec: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-9-override-lifecycle-and-override-log-plan.md`
  summary: The backend publisher can leave an override command in flight when the broker drops between send and PUBACK, so POST /api/overrides hangs until reconnect and MQTT.js resends the command late, or the row is marked REJECTED while the controller applies it.
  evidence: medium, timing unverified. `backend/src/mqtt/publisher.ts` checks `client.connected` only before `publishAsync` (backend core, 1.3), and the backend connects with `clean: false`, so in-flight QoS 1 is resent on reconnect, the very late-apply AD-5 guards against. Story 9's review (finding 1). Settle it by dropping the broker mid-publish in a test, then bounding the publish (a timeout plus discarding the in-flight packet) in the publisher.
- source_spec: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-12-history-vehicle-counts-and-the-counts-slice-plan.md`
  summary: A persist handler that hits a transient DB error loses that QoS 1 message, because dispatch acks it anyway and handlers swallow errors per message.
  evidence: `backend/src/mqtt/client.ts` runs `void dispatch(...)`; `vision-counts.persist.ts` logs and returns on an insert failure. This comes from the 1.3 ingest design and affects every persist handler (counts, breaches).
- source_spec: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-12-history-vehicle-counts-and-the-counts-slice-plan.md`
  summary: AD-5's redelivery rule ("affectedRows is 0") never fires, because mysql2 connects with CLIENT_FOUND_ROWS; story 15's breach insert needs the same insertId-based check that story 12 uses, or the spine's wording should change.
  evidence: The story 12 implementer probed this against MySQL. `vehicle_count.insert.ts` returns `insertId > 0`, and its redelivery test runs against the real database.
- source_spec: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-15-breach-ingest-and-breach-log-plan.md`
  summary: A transient DB error during breach ingest loses that breach for good, because the 1.3 dispatcher acks QoS 1 messages even when a handler fails.
  evidence: `vision-breach.persist.ts` logs `not stored` and returns, like `vision-counts.persist.ts`; a breach is enforcement evidence, so this loss weighs more than a lost count.
- source_plan: `_bmad-output/backlog/bug-live-view-overflows-and-override-buttons-overlap-plan.md`
  summary: When the right column runs out of room, the counts table clips its bottom rows (E, W) with no visible sign, while the Hour total still shows the full sum.
  evidence: `counts-panel.tsx` wraps the table in `min-h-0 flex-1 overflow-hidden`. Rows measured 35 px against a 30 px minimum in every state at 1920×1080 on Linux fonts, which is about 20 px of slack. A taller font on the Windows demo laptop (Bahnschrift), or a raw rejection code long enough to wrap the notice, could use it up. Check on the demo laptop. If it clips, enforce a minimum or shorten the labels.
- source_plan: `_bmad-output/backlog/bug-live-view-overflows-and-override-buttons-overlap-plan.md`
  summary: DESIGN.md still says the right column's last panel (MDRRMO override) fills, and that count rows sit 5 px apart. Since 2026-10-26 the counts panel flexes, the override panel keeps its content height, and Pending shows in the button's label place.
  evidence: DESIGN.md Layout & Spacing ("the last panel in a side column flexes to fill", "MDRRMO override (fills…)") and Components (counts table, 5px spacing), against `counts-panel.tsx` and `override-panel.tsx` after the fix. Record the user's option-A decision through `bmad-ux`, so a later change built from DESIGN.md doesn't restore the old layout.
- source_plan: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-refactor-sweep-plan.md`
  summary: A failed MQTT subscribe is only logged, so after a broker session loss the link bar can read Broker connected while no message arrives. Disposition: new robustness story (retry the subscribe, or surface the failure in the link slice).
  evidence: `backend/src/mqtt/client.ts:83-85` logs `[mqtt] subscribe failed` and does nothing else. Retrospective F13. It changes behavior, so the 1.17 refactor sweep leaves it out.
- source_plan: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-refactor-sweep-plan.md`
  summary: The override panel shows "Corridor ended — link loss or fault" for a release made while the stream was down, because it learns of releases only from frames it saw. Disposition: new robustness story (re-read the release on the new epoch before calling the end unexpected).
  evidence: `dashboard/src/components/override/override-panel.tsx:203-220` keys the notice on `releases.current`, which holds only commands this page sent or saw. Retrospective F13. It changes behavior, so the 1.17 refactor sweep leaves it out.
- source_plan: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-refactor-sweep-plan.md`
  summary: In the controller-offline branch of the override service, an insert failure surfaces as 500 INTERNAL instead of 409 CONTROLLER_OFFLINE. Disposition: new robustness story.
  evidence: `backend/src/services/overrides.ts:58-71` awaits `insertOverride` for the REJECTED row before it throws `offline()`, so a DB error escapes first. Retrospective F13. It changes behavior, so the 1.17 refactor sweep leaves it out.
- source_plan: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-refactor-sweep-plan.md`
  summary: The SSE hub ignores `res.write` backpressure. Disposition: accepted for M1, whose demo has one local tab; revisit for M2 if more viewers or remote clients connect.
  evidence: `backend/src/sse/hub.ts:52-54` writes every frame to every client and never checks the return value or waits for `drain`. Retrospective F13. At M1's rates and one localhost client, the buffer never builds up.
- source_plan: `_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-refactor-sweep-plan.md`
  summary: One live context holds every slice, so each slice frame re-renders every live consumer. Disposition: accepted, marked as a shortcut in the code; revisit for M2 (per-slice contexts or `useSyncExternalStore`) if renders show up in profiling.
  evidence: `dashboard/src/lib/live/live-provider.tsx:79-85` sets one `LiveState` per frame. Retrospective F13. The M1 demo run showed changes reaching the stream in 6 to 54 ms with no visible lag on `/`.
