---
epic: epic-m1-midterm-prototype
date: 2026-10-26
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# Retrospective: M1 Midterm prototype

## Epic summary

**Epic:** `epic-m1-midterm-prototype`, CAP-1 to CAP-6 on simulated telemetry, due and submitted 2026-10-26 (`docs/m1-demo.md`, merged in #24 and #25).

**Tickets** (`tickets.py status`, build order): 1.1 to 1.16 and 1.18 are `done`. None is at `built`.

**Unfinished, retro'd over with the user's agreement (2026-10-26):** 1.17 Refactor sweep, `planned`. It was deferred until after 1.18 on the due date (epic Notes, last Decision), so the submitted code is the code the demo run checked. This forces the machine verdict to **rejected**.

**User's focus for this run:** the `/` layout bug, the seams between tickets, the test gaps behind 1.17, and an even pass over the rest.

### Evidence inventory

| Evidence | Available | Notes |
| --- | --- | --- |
| Epic file, Done when 1–6 | Yes | `epic-m1-midterm-prototype.md` |
| Initiative Requirements | No section | The initiative file holds only Notes. The epic's Requirements section points at the spec's CAP-1 to CAP-6 and the spine's AD-1 to AD-19, which were used instead. |
| Entries | Yes | `tickets.toml`; every entry has `file: null`, so no story files exist. Each plan's frozen Intent holds the reviewed intent. |
| Plans | 17 of 18 | One per done ticket. 1.17 has none. 1.18's plan holds only frontmatter (`tickets.py mark`). The `/` fix (#22) has its own plan outside the tree: `plan-live-layout-overflow.md`, `ticket: ''`, `status: built`. |
| Diff range | Derived | See below |
| Previous retrospective | None | This is the initiative's first epic (`tickets.toml` at the initiative lists one). |
| Session logs | Partial | 8 Claude Code sessions on Sean's machine (S0, planning, the #20 integration, the #22 fix, the demo run). The teammates' build sessions for 1.2 to 1.16 are on their own machines and were not available, so process lessons come from the plans, not the sessions. |
| `deferred-work.md` | Yes | 10 entries from plans 1, 2, 9, 12, 15 and the #22 fix: the scope 1.17 was to start from. |

### Ranges

The plans could not give clean ranges. Three developers built on parallel branches, and plans 4 to 16 record `baseline_commit` from an older build version (plans 1 to 4 also or only record `baseline_revision`), so slicing baseline to baseline would interleave tickets. The ranges are therefore:

- **Epic:** `f27587b..942d8c3`, from S0's `baseline_revision` to the merge of #26 (ticket 1.18 closed). Cut before `1eb79e0` (#27, the BMad tooling repair), which is not epic work. `git_evidence.py` over it: 74 commits, 31 merges, of which 17 were measured (the rest are side-branch merges such as "Merge live signal state (1.8) for story 13"), no binary revisions.
- **Per ticket:** each ticket's PR merge on `main`, from `git log --merges --first-parent`: #1 (1.1), #6 (1.4), #8 (1.6), #10 (1.2), #11 (1.8, carrying 1.3 and 1.7), #12 (1.9), #13 (1.10), #14 (1.11), #20 (1.5 and 1.12 to 1.16, integrated 2026-10-26 10:18), #22 (the `/` fix), #23 to #26 (1.18).
- **Demo run vs the cut:** `git diff 90138d1 942d8c3` touches only `docs/m1-demo.md` and 1.18's plan, so the demo run checked the epic's final code.

**Change volume** (product code, non-merge): source net +8,871 lines, tests net +8,726 (contracts 849/723, backend 2,279/2,951, simulator 1,201/1,414, dashboard 4,372/3,638, infra 170/0). No dependency changed after S0 (`git diff 886c9cc 942d8c3` on every `package.json`), as rule 6 requires.

## Findings

Each finding has a source and a disposition: what to do about it, and what would prevent the next one.

### Process: the `/` layout bug (#22)

- **F1. The no-scroll checks measured the wrong element.** Stories 8, 10, 13 and 16 each recorded "Document scroll stayed 1920×1080" or "`scrollHeight` 1080" (their plans' Verification). The overflow was inside the fixed-height `main` (scrollHeight 993 > clientHeight 948) and inside the override grid, where buttons shrank to about 24 px and overlapped, so a click on Corridor NS sent Release (`plan-live-layout-overflow.md`, Intent). A document-level check can't see either. Story 8 also verified the fault row by its text ("the fault row read FAULT · Conflict monitor"), which doesn't show that it was visible.
  - *Instance:* fixed in #22, measured in every state, and re-measured in the demo run (check 3).
  - *Prevention:* for `/`, a check measures `main`'s scroll against client height, each button's centre hit test and each panel's bottom edge, not `document.scrollHeight`. The measuring script used for #22 and the demo run lives in a session scratchpad, not the repo.
- **F2. The right column was composed by three stories, and no one checked it whole until the due date.** Counts (13), Latest breach (16) and the override panel (10) each own one panel. Story 10 checked its panel on 2026-10-24 before 13 and 16 had mounted above it, and the mock's own right column is 27 px over its 904 px (419 + 186 + 286 + gaps = 931), so the budget never closed even on paper (`plan-live-layout-overflow.md`, Implementation Notes). The full `/`, with all six mounts, first existed on `main` at `d3af9de` (#20, 2026-10-26 10:18).
  - *Instance:* fixed (#22).
  - *Prevention:* a design-time budget check that the panels of one column add up, and a whole-page check whenever a mount line lands on `main`, not only each story's own panel.
- **F3. Integration was concentrated on the due date.** 1.5 and 1.12 to 1.16 reached `main` in one PR, #20, on 2026-10-26, after building on branches that merged other unmerged branches ("Merge live signal state (1.8) for story 13", "…for story 16", "Merge dashboard shell frame (1.7) for story 14", "…for story 15"). The layout bug surfaced in the rehearsal the same day.
  - *Instance:* accept; M1 is submitted.
  - *Prevention:* merge each story to `main` when it's done, and the next story branches from `main`.

### Process: gates and bookkeeping

- **F4. Ticket 1.9's high-risk human gate was merged open.** The epic's Notes require that "before merge, a second Squad C developer runs EXPERIENCE Flow 1's failure paths against the simulator". Plan 9 lists it as still open (lines 147, 200, 208), and PR #12 merged on 2026-10-24 16:22 (`2172f2c`). Plan 10 notes it again as open. Today's demo run covered those paths (check 4: conflict fault, controller offline and timeout all showed their notices), so the risk was retired afterwards.
  - *Instance:* accept, covered by the demo run.
  - *Prevention:* a high-risk gate is closed or explicitly waived, with a line in the plan, before the PR merges.
- **F5. The #22 fix lives outside the ticket tree.** `plan-live-layout-overflow.md` sits at the initiative root with `ticket: ''` and `status: built`, so `tickets.py` doesn't see it, and nobody called it done.
  - *Instance:* defer to `bmad-ticket`: file it as a backlog bug and mark it done, or leave it as is.
  - *Prevention:* a fix found during a hitl ticket gets a backlog ticket first.
- **F6. The plans use two baseline keys.** Plans 4 to 16 record `baseline_commit` (plan 4 records both), which this retrospective's range method doesn't read. The cause is the older `bmad-build` copies in `.claude/skills` from `6e3d5c9`, repaired in #27.
  - *Instance:* accept.
  - *Prevention:* already done (#27). Teammates pull and restart Claude Code.

### Aggregate views

- **Architecture delta: clean.** Each package imports only `@stl/contracts` (`backend`, `simulator`, `dashboard`). Each CAP's handlers, routes and jobs import only that CAP's own service, and services import only `services/errors.ts`, as AD-16 and the epic's Decision require. Only 1.2 and 1.3, the owners, touched `be/index.ts` and `be/app.ts`. `ui/app/page.tsx` holds only mount lines, from 1.8, 1.10, 1.13 and 1.16. Checked by import grep, not by a dependency tool, because none is installed and rule 6 forbids adding one.
- **God-class / size: clean.** The largest source files are `simulator/src/controller-role.ts` (444 lines), `state-history.tsx` (409), `traffic-peaks.tsx` (378) and `vision-role.ts` (373), each written in one commit with one job. Nothing grew across tickets: the files that more than one commit touched are `override-panel.tsx`, `counts-panel.tsx`, `flood-fault-panel.tsx` and `repl.ts`, by #22 and entry 5's planned extension. No product path has churn only in a merge.
- **F7. Duplication: the slice list is hardcoded twice.** `backend/src/sse/hub.ts:10` (1.2) and `dashboard/src/lib/live/hooks.ts:6` (1.6) each list `link`, `state`, `counts` and `demand`. Contracts describe the split only in a comment (`contracts/src/api/stream/index.ts:18-22`), and no test ties the two lists together: a search of every test for `SLICES` and `SLICE_NAMES` finds nothing, and `contracts/test/stream.test.ts:13-23` pins only the order of `streamSchemas`. A slice added on one side only, such as M2's power slice, would reach the dashboard as an occurrence and never update `useLive`.
  - *Instance:* defer to 1.17. Export `SLICE_NAMES` from contracts (an AD-4 one-commit chore) and use it in both.
  - *Prevention:* a list that both sides of the wire need lives in `contracts/`.
- **Duplication, minor (F8).** `dashboard/src/components/traffic/traffic-peaks.tsx:34-44` builds its own Asia/Manila `Intl` formatter, while `dashboard/src/lib/time.ts:1` says every displayed time goes through it. The backend's two Manila-hour computations (`services/counts.ts:21`, `vehicle_count.by-hour.ts:20`) agree, and the live hour counts and `/traffic/` share `vehicleCountsByHour`, which the demo run confirmed (24/24 hours).
  - *Instance:* defer to 1.17.
- **Pattern divergence: clean apart from F8.** The persist handlers share one shape (log and return on failure), and the repositories share one file-per-query pattern.

### Spec reconciliation

- **Done when 1–6 are met** on the demo laptop, in `docs/m1-demo.md` (all six checks Pass, plus the offline pass with the Wi-Fi off). The demo laptop is Sean's Fedora laptop (user, 2026-10-26). Story 7's plan still says "The demo laptop runs Windows, which has Bahnschrift" (line 70); that note is out of date for M1.
- **F9. AD-5's redelivery rule doesn't match the code.** The spine says "When `affectedRows` is 0, the message is a redelivery" (`architecture-smart-traffic-light.md:198`). With mysql2's `CLIENT_FOUND_ROWS`, a duplicate counts as 1, so story 12 switched to `insertId > 0` (`vehicle_count.insert.ts:17,37`) and story 15 adopted it (`breach_event.insert.ts:19,41`). The hand-off between the tickets held (`deferred-work.md`, story 12), but a handler built from the spine, such as M2's speed alert, would reintroduce the bug.
  - *Instance:* propose a spine reconciliation through `bmad-architecture`.
- **F10. DESIGN.md is stale after #22.** It still says the override panel fills the right column and that count rows sit 5 px apart. Since #22, the counts panel flexes, the override panel keeps its content height, and Pending shows in the button's label slot (`deferred-work.md`, last two entries).
  - *Instance:* propose through `bmad-ux`.
- **Accepted deviation (recorded so later runs don't re-flag it).** Pending replaces the pressed button's label, and the label stays in its accessible name. EXPERIENCE only says the button "reads" Pending. The user approved this placement (#22 plan, Intent).

### Code review over the seams (bmad-review)

Lenses: adversarial, edge-case-hunter and verification-gap, over `f27587b..942d8c3` narrowed to the seams between tickets (contracts, backend MQTT dispatch, publisher and handlers, the override service and timeout job, the SSE hub, the dashboard live layer and the override panel): 49 files, 2,015 lines. They ran inline, one after another, without subagents, which this session uses only on the user's request. The full findings are in the run's scratchpad as JSON. Findings that two lenses share are merged here.

- **Checked and clean.**
  - **The override lifecycle between 1.9 and 1.10.** REQUESTED is emitted before publishing (`overrides.ts:73-75`), and timeouts are conditional (`override_command.timeouts.ts:26`). A late APPLIED after TIMEOUT clears the notice, which is tested on the backend's status filter and in `override-panel.test.tsx:307`. A missed frame is re-read on a new epoch (`override-panel.tsx:185-201`, tested at line 324).
  - **The override UPDATEs.** `affectedRows` is correct in `override_command.resolve.ts:20` and `override_command.timeouts.ts:29`, because each filters on the status it changes.
  - **The contract schema.** `npm run contracts:schema` regenerates with no drift.
- **F11. A QoS 1 message is acked whatever its handler does** (adversarial, edge-case and verification-gap). `backend/src/mqtt/client.ts:89-91` dispatches with `void`, and the persist handlers log and return on an insert error (`vision-counts.persist.ts:25-31`, `vision-breach.persist.ts:81-86`), so a transient MySQL error loses counts and breaches for good. `controller-state.persist.ts:54-58` loses the transition the same way. The dispatch test asserts handler isolation only (`client.test.ts:84`). This is already recorded twice in `deferred-work.md` (stories 12 and 15), and it falls short of CAP-2's retention.
  - *Instance:* defer. It's a behavior change, not cleanup, so per 1.17's description it becomes a new story.
- **F12 (review). The override publish is unbounded** (adversarial, edge-case and verification-gap). `backend/src/mqtt/publisher.ts:27-31` checks `connected` once, and `publishAsync` has no timeout. If the broker drops before PUBACK, POST `/api/overrides` hangs, and with `clean: false` the command is resent on reconnect and applied late. Only the disconnected-before-publish path is tested (`publisher.test.ts:40`). It's in `deferred-work.md` (story 9).
  - *Instance:* defer to 1.17 or a new story.
- **F13. Lower-weight seam findings.**
  - **No subscribe retry:** a failed subscribe is only logged (`client.ts:83-85`), so after a broker session loss the link bar could read Broker connected while nothing arrives.
  - **False "ended" notice:** the override panel learns of a release only from frames it saw, so a release made during a stream drop shows "Corridor ended — link loss or fault" (`override-panel.tsx:203-220`).
  - **Wrong rejection code:** an insert failure in the controller-offline branch surfaces as INTERNAL instead of CONTROLLER_OFFLINE (`overrides.ts:58-71`).
  - **No SSE backpressure:** `hub.ts:52-54` ignores `res.write` backpressure.
  - **Re-renders:** one live context re-renders every consumer on each frame (`live-provider.tsx:79-85`, marked as a shortcut).
  - *Instance:* triage when 1.17 starts. Accept any that M2's load doesn't make worse.

### The test gaps behind 1.17

`deferred-work.md`'s entries, with what today's evidence settled:

| Entry | Status after the demo run |
| --- | --- |
| `npm run broker` against native Mosquitto (S0) | Settled on Windows: stories 8 and 13 ran `npm run broker` and plan 4 ran `mosquitto.exe -c infra/mosquitto/mosquitto.conf`. Still open on Linux. |
| `db:seed` CLI as a child process (1.2) | Multi-statement apply exercised (demo check 1). The SQL-error exit 1 is still untested. |
| `createApp` serves `dashboard/out/` at `/`, `/api/nope` gives JSON 404 (1.2) | Static mount exercised (every view loaded from `127.0.0.1:4000`). The 404 and a test are still open. |
| `DASHBOARD_ORIGINS` parse default and trim (1.2) | Open |
| Override publish in flight (1.9) | Open: F12 |
| Persist on transient DB error (1.12, 1.15) | Open: F11 |
| AD-5 `affectedRows` wording (1.12) | Open: F9 |
| Counts table clips with no sign (#22) | Not reached at L4 in the offline pass on Sean's Fedora laptop, which is the M1 demo laptop (user, 2026-10-26). The entry's premise, a Windows demo laptop with Bahnschrift, no longer holds for M1. It still applies to a teammate's Windows machine. |
| DESIGN.md stale (#22) | Open: F10 |

## Behavior verification

The epic changed runtime behavior, and it was exercised end to end on 2026-10-26 in the M1 demo run (`docs/m1-demo.md`), on a fresh clone of `90138d1`, which has the same product code as the epic's cut:

- **Gates:** pass (624 tests), and `npm run build` passes with no network.
- **CAP-1 and the backend stop:** every REPL command showed on `/`. With the backend stopped, all 7 panels went STALE, and the dashboard came back live with no reload.
- **CAP-3:** `main` 948/948, the hit tests pass and the fault row is visible in every state. Changes reach the stream in 6 to 54 ms.
- **CAP-5:** Flow 1 acknowledged in 57 ms, with a 2 s all-red and NS green. The conflict, offline and timeout notices show, and `/log/overrides/` has each activation and release.
- **CAP-4 and CAP-6:** 24 of 24 hours equal the SQL sums. The crop is a 64×48 JPEG, and `breach_event` has no identifying column.
- **CAP-2:** after the backend and MySQL restart, history is intact, and the 2 breaches and 39 count rows sent while the backend was down are stored.
- **Offline pass:** Sean, with the Wi-Fi off and F11, at L4: no scroll bar, the fault row visible, still live.

Not exercised: the failure paths of F11, F12 and F13 (a transient DB error, a broker drop mid-publish, a failed subscribe), and `/` on Windows fonts, which the teammates' machines use but the demo laptop doesn't.

## Previous-retro follow-through

Nothing to follow through: no previous retrospective file exists, because this is the initiative's first epic.

## Action items

Every item is proposed. The retrospective applies nothing: remediation goes through the normal build loop, and spec reconciliations wait for the person who owns that document. Sean decides what runs and who takes each one.

| # | Action | From | Kind | Owner |
| --- | --- | --- | --- | --- |
| 1 | Scope 1.17 from this retrospective as well as `deferred-work.md`: export `SLICE_NAMES` from contracts and use it in `hub.ts` and `hooks.ts`, with a test (an AD-4 one-commit chore first); route `traffic-peaks.tsx`'s date label through `lib/time.ts`; add the `db:seed` exit-1, `/api/nope` 404 and `DASHBOARD_ORIGINS` tests; run `npm run broker` against native Mosquitto on Linux; triage the F13 items. | F7, F8, F13, test gaps | Remediation, proposed | 1.17, via `bmad-build` |
| 2 | New story, CAP-2 robustness: a persist failure must not lose a QoS 1 message. Ack after the persist handlers resolve, or retry the insert, and test it against a failing pool. This changes behavior, so per 1.17's description it doesn't belong in the sweep. | F11 | Remediation, proposed | Sean, via `bmad-ticket` |
| 3 | Bound the override publish: a timeout on `publishAsync` that drops the in-flight packet, and a test where the broker drops before PUBACK. It goes in 1.17 if it stays small, otherwise in item 2's story. | F12 | Remediation, proposed | 1.17 or item 2 |
| 4 | Reword AD-5's redelivery rule: `insertId` = 0 after `INSERT … ON DUPLICATE KEY UPDATE id = id` marks a redelivery (CLIENT_FOUND_ROWS makes `affectedRows` 1). | F9 | Spec reconciliation, proposed | Sean, via `bmad-architecture` |
| 5 | Update DESIGN.md for #22: the counts panel flexes, the override panel keeps its content height, count rows sit 3 px apart, and Pending shows in the button's label slot. | F10 | Spec reconciliation, proposed | Sean, via `bmad-ux` |
| 6 | Mark story 7's note "The demo laptop runs Windows" as superseded: the M1 demo runs on Sean's Fedora laptop (user, 2026-10-26). | Open question, answered | Bookkeeping, proposed | Sean |
| 7 | File the #22 fix as a backlog bug from `plan-live-layout-overflow.md` and mark it done, or record why it stays outside the tree. | F5 | Bookkeeping, proposed | Sean, via `bmad-ticket` |
| 8 | When slicing M2: a dashboard story's check on `/` measures `main`'s scroll against client height, each control's hit test and each panel's bottom edge, not `document.scrollHeight`. Commit the measuring script used for #22 and the demo run (now in a session scratchpad) under `docs/` or `dashboard/scripts/`, so any developer can run it. | F1 | Process lesson | Sean, in M2 epic planning |
| 9 | When slicing M2: check that the panels sharing a column add up in the mock before the stories split, and re-check the whole page whenever a mount line lands on `main`. | F2 | Process lesson | Sean, in M2 epic planning |
| 10 | Merge each story to `main` when it's done, and branch the next from `main`. No integration PR on the due date. | F3 | Process lesson | Whole squad |
| 11 | A high-risk gate in the epic's Notes is closed or explicitly waived, with a line in the plan, before its PR merges. | F4 | Process lesson | Whole squad |

## Acceptance verdict

**accepted-with-open-items.** This is the human decision (Sean, 2026-10-26), and it overrides the machine verdict.

- **Machine verdict: rejected.** The only reason is that ticket 1.17 (Refactor sweep) is still `planned`, which forces it.
- **Why the override:** 1.17 was deliberately deferred until after 1.18, so the submitted code is the code the demo run checked (epic Notes, 2026-10-26). Its scope is cleanup and test gaps, not a Done when criterion.
- **Criteria, declared (the epic's Done when 1–6):** all met. The evidence is `docs/m1-demo.md`'s six passing checks, run on a fresh clone of `90138d1`, which has the epic's final product code, plus the offline pass on the demo laptop. The behavior check in this retrospective is that run.
- **Open items carried:**
  - ticket 1.17 (action item 1);
  - F11, the persist loss (item 2);
  - F12, the unbounded publish (item 3);
  - F9 and F10, spec reconciliation (items 4 and 5);
  - F13, triaged in 1.17.
- **Blocking findings:** none stands unresolved. The `/` layout bug, the one finding that blocked the demo, was fixed in #22 and re-measured in the run.

The epic stays open in the ticket tree until 1.17 is done. Closing it is `bmad-ticket`'s job, with Sean confirming.

## Open questions

- **Item 2 or 1.17?** Does F12 (the unbounded publish) go into 1.17 or into item 2's new robustness story? Story 9 called its timing "unverified", so the fix's size isn't known.
- **Re-checking `/` on Windows.** Should the squad re-check `/` on a Windows machine with Bahnschrift? M1's demo doesn't need it. M2's pitch may run elsewhere, and the counts table's slack is about 20 px (`deferred-work.md`).
- **Retrospective scope limits.** Process lessons come from the plans, because the teammates' build sessions for 1.2 to 1.16 were not available here. The code review covered the seams between tickets (49 files), not the whole 17,600-line diff. Inside each ticket, the per-story reviews in the plans' Review Triage Logs are the record.
