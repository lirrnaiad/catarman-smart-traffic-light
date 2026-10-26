---
id: 1
type: story
title: "Telemetry and overrides survive transient broker and database failures"
parent: none
covers: [CAP-2, CAP-5]
after: []
assignee: ""
refined: false
hitl: false
risk: medium
---

# Telemetry and overrides survive transient broker and database failures

## Description

M1 loses data or misreports state when the broker or MySQL fails for a moment:
- a count, breach or state change that fails to store is dropped for good;
- an override sent as the broker drops can hang the request, then apply late;
- a failed subscribe goes unnoticed;
- two override notices can read wrong.

This story makes the backend and the override panel recover from those moments without losing records or misleading the operator.

## Acceptance Criteria

1. **A count or breach that fails to store is not lost**
   **Given** the backend running and MySQL refusing writes for a few seconds
   **When** the vision role publishes counts and a breach in that window
   **Then** once MySQL accepts writes again, each is stored exactly once, and `/traffic/` and `/breaches/` show them
2. **A state change that fails to store is not lost**
   **Given** MySQL refusing writes for a few seconds
   **When** the controller reports a level or override change in that window
   **Then** `/log/states/` lists that change once MySQL recovers
3. **An override send has a bound**
   **Given** the controller online
   **When** the broker drops after an override is sent and before the broker confirms it
   **Then** the request answers within a few seconds with the controller-offline notice
   **And** the controller does not apply that command when the broker returns
4. **Telemetry resumes after a failed subscribe**
   **Given** the broker has lost the backend's session
   **When** the backend reconnects and its subscribe fails
   **Then** it subscribes again without a restart, and the dashboard's panels go live again
5. **A release made while the stream was down isn't reported as a link loss**
   **Given** an active corridor and the dashboard's stream down
   **When** an operator releases it from another tab, and the stream returns
   **Then** the panel shows no "ended — link loss or fault" notice
6. **An offline refusal always reads as offline**
   **Given** the controller offline and the database failing the refusal's log write
   **When** an operator presses an override
   **Then** the panel shows "Rejected · Controller offline", not an internal error
7. **Tests cover each condition**
   **Given** the test suite
   **When** it runs
   **Then** a test that fails before the fix and passes after covers each of criteria 1–6

## Boundaries

- Must not change: the override lifecycle and its 5 s timeout (AD-7); the MQTT contract (topics, QoS and retain); exactly-once storage of a redelivered count or breach (AD-5); the dashboard's layout on `/`.

## References

- source — _bmad-output/initiative-catarman-smart-traffic-light/deferred-work.md, the entries from stories 9, 12 and 15, and the subscribe, "ended" notice and offline-code entries from the 1.17 sweep
- retrospective — _bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-m1-midterm-prototype-retrospective.md, findings F11, F12 and F13, action items 2 and 3
- spine — _bmad-output/initiative-catarman-smart-traffic-light/architecture-smart-traffic-light/architecture-smart-traffic-light.md, AD-5 and AD-7
- kpi — _bmad-output/initiative-catarman-smart-traffic-light/spec-smart-traffic-light/kpis.md, Offline telemetry retention

## Notes

- Decision: filed at M1's closure, to be planned with M2 (user, 2026-10-26).
- Decision: SSE backpressure and the single live context stay out of this story. They were accepted for M1 and are revisited in M2 planning (deferred-work.md).
- Open question: whether a QoS 1 message is acknowledged only after it's stored, or a failed insert is retried before acknowledgement. Answered as part of this story's work.
- Assumption: the criteria above are a draft for review. The story is `refined: false` until they're approved.
