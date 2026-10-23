---
review: versions-and-reality-check (update run 2)
target: ../architecture-smart-traffic-light.md
inputs:
  - ../architecture-smart-traffic-light.md
  - ../.memlog.md (entries after "Update run 2", plus the post-gate esp-mqtt decision it relies on)
  - ../../spec-smart-traffic-light/{milestones,hardware,risks}.md (hotspot and mirroring context)
date: 2026-10-22
lens: >-
  Every committed decision was web-researched or reality-checked, not asserted from training data:
  current versions, each named technology still exists and fits, and (greenfield) the live defaults
  of any starter it leans on.
scope: >-
  What update run 2 newly commits to (AD-11 SOF check, AD-15 hotspot broker auth + ACL, AD-19 purge
  and mysqldump rule), plus the esp-mqtt claim in amended AD-5 that no reviewer has checked yet. The
  Stack table was verified earlier today and is not redone.
---

# Versions and reality-check review: update run 2

## Verdict

**Mostly sound, with one wrong safety rationale and three cross-version or implementation traps.** Every option name the update relies on exists and does what the spine says, in both Mosquitto 2.0.22 and 2.1.2, on Windows and Linux. The `mysqldump --ignore-table` syntax is right, and MQTT.js 5.16.1 and esp-mqtt both take a username and password. The memlog's Mosquitto entry (password_file and acl_file deprecated in 2.1.0, removal in 3.0, ACL `user` = username) checks out against the primary sources. The problems are in what the spine *infers* from those facts:

- **High:** AD-5 says esp-mqtt "runs in its own task, so a broker outage never stalls signal timing." That's wrong for publishing. `esp_mqtt_client_publish` sends QoS 0 in the *calling* task and "might block for several seconds" (10 s network timeout). This claim was added after the first versions gate, so it was never checked (V2-01).
- **Medium:** "These options work on Mosquitto 2.0 and 2.1" is true of the config options, but not of the password file. 2.1's `mosquitto_passwd` writes argon2id hashes by default, and 64-byte salts for every hash type. A 2.0.x broker accepts only `$6$`/`$7$` with a 12-byte salt, so it drops every user that 2.1's tool wrote (V2-02).
- **Medium:** AD-11's SOF check is the right approach, but only if the parser walks segments. A naive byte scan reads an EXIF thumbnail's SOF first. I reproduced this: a 640×480 JPEG carrying a 48×36 thumbnail scans as 48×36 and passes the 64 px cap (V2-03).
- **Medium:** `--ignore-table=stl.breach_crop` drops the table's `CREATE TABLE` as well as its rows. MySQL has no `--ignore-table-data`. A restored dump then lacks `breach_crop`, while dbmate's `schema_migrations` says it exists, and every breach insert rolls back (V2-04).

Counts: **critical 0 · high 1 · medium 3 · low 6 · info 9.**

### How I checked

- **Mosquitto:** man pages (`mosquitto.conf.5.xml`, `mosquitto_passwd.1.xml`), `ChangeLog.txt` and broker source at tags **v2.1.2** and **v2.0.22**, via `gh api`. Source files read: `src/security_default.c`, `libcommon/password_common.c`, `libcommon/file_common.c`, `src/context.c`, `src/handle_publish.c`, `src/handle_subscribe.c`, `src/plugin_basic_auth.c`, `src/conf.c`, `vcpkg.json`, `installer/mosquitto64.nsi` and `README-windows.txt`. Tag list: v2.1.2 is newest, and there is no 3.0.
- **Distro packages:** the Launchpad API for Ubuntu and the mosquitto-dev PPA, `dnf repoquery` on Fedora 44, and the Fedora `mosquitto.spec`.
- **MQTT.js:** the `mqtt@5.16.1` tarball from npm (README, `build/lib/handlers/connack.js`, `ack.js`, `client.d.ts`).
- **esp-mqtt:** `include/mqtt_client.h` at the commit ESP-IDF v5.5.6 pins (0e9ec171) and at master. Also the ESP-IDF v6.0.3 migration guide, the Arduino-ESP32 releases, and the central directories of `esp32-libs-3.3.12.zip` and `esp32-libs-4.0.0-RC1.zip`, read with HTTP range requests.
- **JPEG:** ITU-T T.81 (w3.org PDF, B.1.1.2, Table B.1, B.2.2), Pillow's `JpegImagePlugin.py` and image-size's `jpg.ts`. Plus an **empirical test**: Pillow 12.3 generated baseline, progressive and EXIF-thumbnail JPEGs, and a naive scanner and a segment walker read them under Node 24.18.0.
- **Other:** the MySQL 9.7 `mysqldump` reference page (both halves), the Node 24 timers docs, an empirical Node `Buffer` base64 test, the zod 4.6.7 typings, the Microsoft Learn Windows Firewall rules page, and web searches for MariaDB `--ignore-table-data` and the state of Linux Miracast.

## Findings

| ID | Sev | Finding |
| --- | --- | --- |
| V2-01 | High | esp-mqtt `publish` runs in the caller's task and can block for ~10 s, so AD-5's "never stalls signal timing" rationale is false as written |
| V2-02 | Medium | Password files aren't portable from 2.1 to 2.0: 2.1's `mosquitto_passwd` writes argon2id and 64-byte salts, and a 2.0.x broker drops those users |
| V2-03 | Medium | The SOF check must walk segments by length and stop at SOS. A naive scan reads an EXIF thumbnail and lets an oversized crop through (reproduced) |
| V2-04 | Medium | `--ignore-table` omits the table's DDL too. A restore lacks `breach_crop` while `schema_migrations` says it's applied, and breach inserts fail |
| V2-05 | Low | ACL prose doesn't map to the syntax: `topic` lines before the first `user` line apply only to anonymous clients. Denials are silent |
| V2-06 | Low | Nothing in the broker enforces "username = clientId". `use_username_as_clientid true` does, in both 2.0 and 2.1 |
| V2-07 | Low | MQTT.js stops reconnecting after a refused CONNACK (`reconnectOnConnackError` defaults to false), so a bad password leaves the backend permanently offline |
| V2-08 | Low | "Mosquitto 2.1.2 … the distro package on Linux" is wrong for Ubuntu: 24.04 ships 2.0.18 and 26.04 ships 2.0.22 |
| V2-09 | Low | On Windows, hotspot mode needs an inbound firewall rule for 1883. The installer adds none, and a dismissed prompt creates *block* rules |
| V2-10 | Low | The screen-mirroring fallback (AD-15) is effectively Windows-only. Linux Miracast senders are still experimental |
| V2-11 | Info | Linux: a committed `acl` checked out 0644 triggers 2.1's "world readable … future versions will refuse" warning, and symlinked auth files are refused |
| V2-12 | Info | Will messages are ACL-checked when they are sent, and a denied will is dropped silently |
| V2-13 | Info | Deprecation claim confirmed. 2.1 has no runtime notice for these options, and a bad passwd or ACL line on reload makes 2.1 quit |
| V2-14 | Info | esp-mqtt credentials confirmed. Default keepalive is 120 s (set 5). Arduino-ESP32 3.3.12 and 4.0.0-RC1 both bundle it (IDF 6 moved it to a managed component) |
| V2-15 | Info | MQTT.js 5.16.1 `username`/`password` confirmed. An ACL-denied subscribe errors in the callback and is dropped from auto-resubscribe |
| V2-16 | Info | `mysqldump` is not deprecated in 9.7. Use `--result-file` on Windows (PowerShell `>` writes UTF-16), plus `--single-transaction` |
| V2-17 | Info | `Buffer.from(s, 'base64')` silently skips invalid characters. Validate with `z.base64()` (zod 4.6.7) |
| V2-18 | Info | A 24 h `setInterval` (86,400,000 ms) is within Node's 2,147,483,647 ms limit |
| V2-19 | Info | Sending credentials to the 127.0.0.1 broker (no `password_file`, `allow_anonymous true`) is accepted, so "empty = anonymous" is optional |

---

### V2-01: esp-mqtt publishing can block the calling task [High]

- **Claim (AD-5, carried into AD-18):** "The ESP32 uses esp-mqtt, the client in the Arduino-ESP32 core, which runs in its own task, so a broker outage never stalls signal timing (AD-18)." This came from a user decision recorded after the first versions gate, and that gate was never re-run.
- **Verified (`esp-mqtt/include/mqtt_client.h`, both at the ESP-IDF v5.5.6 pinned commit and at master):** `esp_mqtt_client_publish`:
  > "This API might block for several seconds, either due to network timeout (10s) or if publishing payloads longer than internal buffer"
  >
  > "QoS 0 messages are sent immediately in the calling task, not via the outbox."

  The subscribe APIs are "protected by internal mutex, so it might block if a longer data receive operation is in progress". Only `esp_mqtt_client_enqueue(…, store=true)` hands the send to the MQTT task: "Thus, it could be used as a non blocking version of esp_mqtt_client_publish()". The receive loop and reconnects do run in the MQTT task, so the claim holds for *connection handling* only.
- **Why High:** AD-18 is the safety invariant ("losing the broker … never stops signaling"). Every controller state change publishes `controller/state`, and the 2 s republish does too. If the signal-timing code calls `esp_mqtt_client_publish` directly, a half-open Wi-Fi link (hotspot phone moved, laptop asleep) can freeze a green or an all-red for up to 10 s. The spine's stated reason would lead Squad A to believe that can't happen.
- **Fix (AD-5 and AD-18, one rule):** "The signal-timing task never calls an esp-mqtt API. It publishes with `esp_mqtt_client_enqueue(…, store = true)` or hands payloads to a separate comms task through a FreeRTOS queue. Only that task or the MQTT event handler calls `publish` or `subscribe`." Keep the rest of the line. Add it to the Deferred "Firmware internals" bullet as a constraint, not a choice.

### V2-02: Password files are not portable from 2.1 to 2.0 [Medium]

- **Claim (AD-15, Stack row):** "These options work on Mosquitto 2.0 and 2.1." "2.0.x accepted; the repo config uses only options common to both." "`infra/mosquitto/passwd` is generated with `mosquitto_passwd`."
- **Verified:**
  - `mosquitto_passwd` 2.1.2 man page: `-H` "Can be one of argon2id, sha512-pbkdf2, or sha512. **Defaults to argon2id**." In 2.0.22 it is "sha512-pbkdf2 or sha512. Defaults to sha512-pbkdf2."
  - ChangeLog 2.1.0: "Password salts are now 64 bytes long." In `libcommon/password_common.c` (v2.1.2), both the sha512-pbkdf2 and sha512 creators set `salt_len = HASH_LEN` (64). A build without argon2 falls back to sha512-pbkdf2 (`default:` case, `#ifdef WITH_ARGON2`).
  - 2.0.22 `src/security_default.c` `unpwd__decode_passwords`: it accepts only hash type `"6"` or `"7"`, and only `salt_len == 12`. Otherwise it logs "Unable to decode password salt for user %s, removing entry". An `$argon2id$` line hits "Invalid password hash type … removing entry".
  - The 2.1.2 broker reads both 12- and 64-byte salts (`salt_len != 12 && salt_len != HASH_LEN`), so the compatibility runs one way only.
  - Builds differ too. The Windows installer is built with argon2 (`vcpkg.json` lists `argon2`), and so is the Docker image. Fedora's `mosquitto-2.1.2-2.fc44` binary has no `libargon2.so` dependency (`dnf repoquery --requires`), so a Windows-generated argon2id file may not verify on that Fedora broker (`pw__verify_argon2id` returns `MOSQ_ERR_NOT_SUPPORTED` without `WITH_ARGON2`).
- **Impact:** if someone generates `passwd` on a 2.1 install and the venue laptop runs 2.0.x (Ubuntu's distro package, V2-08), the broker starts, drops every user, and refuses every client. With `allow_anonymous false`, nothing can connect. This surfaces only at week-5 integration.
- **Fix (AD-15 Credentials bullet):** "Generate `passwd` on the laptop that runs the broker, with the `mosquitto_passwd` from the same install. Never copy it between laptops; share the passwords, not the file. `broker.mjs --hotspot` regenerates it from a gitignored `infra/mosquitto/credentials.env` with `mosquitto_passwd -c -b`, so it always matches the local install." Narrow the Stack row to "the config options are common to both; the password file is not".

### V2-03: The SOF check must walk segments [Medium]

- **Claim (AD-11):** "the backend reads width and height from the JPEG's SOF header without decoding the image. A long side over 64 px, or no readable SOF header, counts as an oversized crop."
- **Verified:** the approach is correct. T.81 B.2.2 puts `Y` (lines) and `X` (samples per line) in the frame header, at offsets 3 and 5 after the 2-byte length. The traps:
  - **Which markers are SOF:** Table B.1 lists SOF0–3, SOF5–7, SOF9–11 and SOF13–15, that is `FFC0`–`FFCF` **except** `FFC4` (DHT), `FFC8` (JPG) and `FFCC` (DAC). Encoders in practice produce SOF0 (baseline: OpenCV `imencode`, Pillow default) or SOF2 (progressive). image-size, a popular npm parser, handles only C0/C1/C2.
  - **Standalone markers** with no length field: SOI `D8`, EOI `D9`, RST0–7 `D0`–`D7`, TEM `01`. B.1.1.2: "Any marker may optionally be preceded by any number of fill bytes" (`FF`).
  - **`Y = 0`** means the height comes later in a DNL segment (B.2.2). Treat it as unreadable.
  - **Embedded thumbnails:** EXIF APP1 (and JFXX APP0) can carry a complete JPEG, with its own SOF, *before* the main frame header.
- **Reproduced (Node 24.18.0, Pillow 12.3):**

  | File | Naive scan for first `FF Cx` | Segment walker |
  | --- | --- | --- |
  | 640×480 baseline + EXIF 48×36 thumbnail | **48×36** (passes the cap) | 640×480 (rejected) |
  | 200×120 progressive | 200×120 | 200×120 |
  | 64×40 baseline / 40×64 progressive | correct | correct |

  A naive scanner therefore stores a full-resolution crop, which is exactly the privacy failure AD-11 says it prevents.
- **Fix (AD-11 Pixel cap bullet):** "Parse by walking marker segments from offset 2:
  - skip `FF` fill bytes;
  - skip standalone markers (D0–D7, 01);
  - skip every other segment by its length, bounds-checked;
  - take the first SOFn (C0–C3, C5–C7, C9–CB, CD–CF);
  - stop with 'unreadable' at SOS (DA), EOI (D9), a truncated length, or `Y`/`X` = 0.

  Never scan for byte pairs. CAP-6's tests include an EXIF-thumbnail fixture." Optionally require SOF0 or SOF2 only, since a 64 px anonymized crop never needs another mode.

### V2-04: `--ignore-table` drops the DDL as well as the rows [Medium]

- **Claim (AD-19 Backups):** "a `mysqldump` either skips crops (`--ignore-table=stl.breach_crop`) or is deleted within 21 days."
- **Verified (MySQL 9.7 Reference Manual, mysqldump):** "`--ignore-table=db_name.tbl_name`: Do not dump the given table, which must be specified using both the database and table names. To ignore multiple tables, use this option multiple times." So the syntax is right. But "do not dump the given table" means no `CREATE TABLE` either. The 9.7 option table has no `--ignore-table-data`, which is a MariaDB-only option (MDEV-22037).
- **Impact:** the dump includes dbmate's `schema_migrations`, which records the initial migration (and with it `breach_crop`) as applied. Restoring it gives a database without `breach_crop`, and `dbmate up` won't recreate it. AD-11 writes `breach_event` and `breach_crop` in one transaction, so every breach that carries a crop then rolls back. That contradicts "a crop problem never loses the event".
- **Fix (AD-19 Backups):** "Back up with two files:
  - `mysqldump --single-transaction --ignore-table=stl.breach_crop --result-file=stl-data.sql stl`
  - `mysqldump --no-data --result-file=stl-crop-schema.sql stl breach_crop`

  Restore both. A dump without `--ignore-table` is deleted within 21 days." Optionally add `npm run db:backup` (a node script) that does exactly this on both OSes.

### V2-05: ACL prose vs ACL syntax; denials are silent [Low]

- **Claim (AD-15 ACL):** "every user may read `stl/#`. `stl-backend` writes only `controller/override/cmd` …"
- **Verified (mosquitto.conf(5), identical in 2.0.22 and 2.1.2):**
  > "The first set of topics are applied to anonymous clients, assuming allow_anonymous is true. User specific topic ACLs are added after a user line … The username referred to here is the same as in password_file. It is not the clientid."
  >
  > "Pattern ACLs apply to all users even if the 'user' keyword has previously been given."

  In 2.0.22 `security_default.c`, a pattern line without `%c`/`%u` matches as a plain topic for every client, and a user with no `user` block and no patterns is denied everything.
- **How denials show up:**
  - **Publish:** the broker logs at DEBUG only ("Denied PUBLISH …"), and for QoS 1 sends a normal 3.1.1 PUBACK with no reason code (`handle_publish.c` `process_bad_message`), so the publisher can't tell.
  - **Subscribe:** returns `0x80` in the SUBACK (`handle_subscribe.c`).
- **Fix:** put the literal file in AD-15 (or the Structural Seed) so S0 doesn't translate the prose:

  ```text
  # infra/mosquitto/acl - Mosquitto 2.0 and 2.1. pattern lines apply to every user
  pattern read stl/#
  user stl-backend
  topic write stl/+/controller/override/cmd
  user stl-controller
  topic write stl/+/controller/status
  topic write stl/+/controller/state
  topic write stl/+/controller/override/ack
  # same three lines under user stl-serial-bridge and user stl-sim-controller
  user stl-vision
  topic write stl/+/vision/#
  # same line under user stl-sim-vision
  ```

  Add a hotspot smoke step to `docs/setup.md`: `mosquitto_pub -u stl-vision … -t stl/int-01/controller/override/cmd` must *not* appear in a `mosquitto_sub -t 'stl/#' -v` run as `stl-backend`. Set `log_type all` in `hotspot.conf` while testing.

### V2-06: Nothing enforces "username = clientId" [Low]

- **Claim (AD-15):** "each link's MQTT username is its clientId (AD-5)". AD-5 says it prevents "clientId kick loops".
- **Verified:** ACLs key on the username only (V2-05). Any client with valid credentials can still connect with clientId `stl-backend` and take over that session. ChangeLog 2.1.0: "Send DISCONNECT with session-takeover return code … when a client connects with the same client id". mosquitto.conf(5), 2.0.22 and 2.1.2, `use_username_as_clientid`:
  > "replace the clientid that a client connected with its username. This allows authentication to be tied to the clientid, which means that it is possible to prevent one client disconnecting another by using the same clientid … This does not apply globally, but on a per-listener basis."
- **Fix:** add `use_username_as_clientid true` under `listener 1883` in `hotspot.conf`. It makes the convention a broker guarantee and doesn't change the backend's persistent session id (`stl-backend` either way).

### V2-07: MQTT.js gives up after a refused CONNACK [Low]

- **Verified (`mqtt@5.16.1`):** `handlers/connack.js` sets `reconnectSuppressed = true` on any non-zero return code, and only re-arms reconnect `if (options.reconnectOnConnackError)`. README: "It will _not_ (by default) enable retrying connections that are actively denied with a CONNACK error"; default `reconnectOnConnackError: false`.
- **Impact:** in hotspot mode, a wrong or stale `MQTT_PASSWORD` (CONNACK 4 or 5) leaves the backend running with `link.broker` `DISCONNECTED` until someone restarts it. AD-5 assumes the client keeps reconnecting.
- **Fix (backend core):** set `reconnectOnConnackError: true` with the existing `reconnectPeriod`, and log CONNACK refusals as `console.error('[mqtt] …')`. Alternatively, exit with a clear message on rc 4 or 5.

### V2-08: The Ubuntu distro package is 2.0.x, not 2.1.2 [Low]

- **Claim (Local setup):** "Mosquitto 2.1.2: … the distro package on Linux."
- **Verified (Launchpad API, published sources):** noble (24.04) has `2.0.18-1build3`, resolute (26.04) has `2.0.22-5build1`, and only the next development series have 2.1.2. Fedora 44 has 2.1.2-2 (confirmed earlier). The mosquitto-dev PPA publishes `2.1.2-0mosquitto1~noble1` for 24.04, and nothing for 26.04 yet.
- **Fix:** "Fedora 44: `mosquitto` (2.1.2). Ubuntu 24.04: `ppa:mosquitto-dev/mosquitto-ppa` (2.1.2) or the distro 2.0.18. Ubuntu 26.04: distro 2.0.22." This is accepted, but read V2-02 first.

### V2-09: Windows Firewall blocks the hotspot listener [Low]

- **Verified:** Microsoft Learn ("Windows Firewall rules", updated 2026-10-08): "Since there's a default *block* action in Windows Firewall, you must create inbound exception rules … If they respond *No* or cancel the prompt, block rules are created." The Mosquitto 2.1.2 installer script (`installer/mosquitto64.nsi`) adds a service option but no firewall rule. In M1 the broker listens only on 127.0.0.1, so the first prompt appears at hotspot time, possibly at the venue.
- **Fix (`docs/setup.md`, hotspot section):** in an admin PowerShell, run `New-NetFirewallRule -DisplayName "STL Mosquitto" -Direction Inbound -Program "C:\Program Files\mosquitto\mosquitto.exe" -Protocol TCP -LocalPort 1883 -RemoteAddress LocalSubnet -Profile Any`. On Linux, check `firewalld`/`ufw`. Add it to the week-5 integration checklist next to the Deferred "broker address on the hotspot".

### V2-10: The mirroring fallback is Windows-only in practice [Low]

- **Claim (AD-15):** "The venue TV gets the dashboard over HDMI or by screen mirroring from the laptop." The spec (`milestones.md`) names "Miracast, built into Windows".
- **Verified:** on Linux, the only Miracast sender is GNOME Network Displays. It is "an experimental implementation of Wi-Fi Display", version 0.99.0 on the AUR as of January 2026, it needs the desktop's screencast portal, and its development is slow.
- **Fix:** add a note to AD-15: "the mirroring fallback assumes a Windows demo laptop. On Linux, test GNOME Network Displays during the mid-November HDMI check, or carry a spare HDMI adapter." Test mirroring while the laptop is connected to the 2.4 GHz hotspot, because Miracast uses the same Wi-Fi radio.

### Info

- **V2-11:** On Linux, 2.1.2 opens auth files with `O_NOFOLLOW` (symlinks refused unless `MOSQUITTO_UNSAFE_ALLOW_SYMLINKS`). It warns "File %s has world readable permissions. Future versions will refuse to load this file" (`libcommon/file_common.c`; the refusal is still `#if 0`). A git checkout of `infra/mosquitto/acl` is 0644, and `mosquitto_passwd` creates 0600. Have `broker.mjs --hotspot` `chmod 600` the ACL on non-Windows systems to stay ahead of 3.0. The Windows branch does no permission check.
- **V2-12:** Will/LWT. `context__send_will` (2.1.2 and 2.0.22) runs `mosquitto_acl_check(…, MOSQ_ACL_WRITE)` when it publishes the will. If that check is denied, the will is silently not queued, and the CONNECT is not refused. AD-15's ACL grants each role's `…/status`, so the retained `online:false` LWTs pass. A wrong ACL would leave a dead link showing `ONLINE` until the STALE timers run out.
- **V2-13:** ChangeLog 2.1.0 confirms "The acl_file option is deprecated … will be removed in 3.0", and the same for password_file and per_listener_settings. `conf.c` prints no runtime deprecation notice for the two options (unlike per_listener_settings). 2.1.0 also says "acl_file and password_file will produce an error on invalid input when reloading the config, causing the broker to quit". In 2.1 the options are compiled into the broker (`broker_password_file__init`) and don't need the plugin DLL/.so. The newest tag is v2.1.2, and 3.0 is unreleased, so the Deferred note stands.
- **V2-14:** In esp-mqtt `esp_mqtt_client_config_t`, the credentials are `credentials.username`, `credentials.client_id` and `credentials.authentication.password`. Also relevant: `session.last_will`, `session.disable_clean_session` and `session.protocol_ver`. `session.keepalive` defaults to **120 s**, so firmware must set 5 (AD-5). Arduino-ESP32 3.3.12 (2026-09-18, stable) ships `include/mqtt/esp-mqtt/include/mqtt_client.h`. ESP-IDF 6.0 removed ESP-MQTT from core ("now a managed component: `espressif/mqtt`"), but Arduino-ESP32 4.0.0-RC1 (IDF 6.1, prerelease) still bundles it as `include/espressif__mqtt/include/mqtt_client.h`. So "the client in the Arduino-ESP32 core" holds for both. Set `protocol_ver = MQTT_PROTOCOL_V_3_1_1` explicitly rather than relying on menuconfig.
- **V2-15:** MQTT.js 5.16.1 `IClientOptions` has `username?: string` and `password?: Buffer | string`. An ACL-denied subscription returns SUBACK `0x80`, and `ack.js` passes `Error('Subscribe error: …')` to the callback and **removes the topic from `_resubscribeTopics`**. The backend should treat a subscribe-callback error as a startup failure.
- **V2-16:** The MySQL 9.7 page doesn't deprecate `mysqldump` itself. It also says: "A dump made using PowerShell on Windows with output redirection creates a file that has UTF-16 encoding … use the `--result-file` option", and `--single-transaction` gives a consistent InnoDB snapshot without blocking the running backend. On Windows, `mysqldump.exe` sits in `C:\Program Files\MySQL\MySQL Server 9.7\bin`, so name the full path in `docs/setup.md`.
- **V2-17:** On Node 24.18.0, `Buffer.from('/9j/4A!!AQ@@SkZJRg==', 'base64')` decodes to 10 bytes and silently skips `!` and `@`. zod 4.6.7 has `z.base64()` (`ZodBase64`). The `vision/breach` schema should use `z.base64().max(204800)`, so garbage is rejected by the schema rather than half-decoded. Separately, at ≤ 64 px an anonymized JPEG is a few KB, so the 204,800-character cap could shrink a lot. That's optional and would need an additive contract note.
- **V2-18:** Node 24 timers: "When `delay` is larger than `2147483647` … the `delay` will be set to `1`." A 24 h interval is 86,400,000 ms, so it's fine. Call `.unref()` only if the job must not keep tests alive; AD-16's `stop()` covers this.
- **V2-19:** 2.1.2 `plugin_basic_auth.c`: with no auth plugin or `password_file` configured and `allow_anonymous true`, `mosquitto_basic_auth` returns success whether or not a username is sent. So the backend can always send `username = clientId` and add `password` when it is set. The "empty means anonymous" branch is optional, though harmless. This was checked against 2.1.2 only.

## Confirmed without findings

| Claim | Evidence | Result |
| --- | --- | --- |
| `listener 1883` (all interfaces), `allow_anonymous false`, `password_file`, `acl_file` exist in 2.0 and 2.1 | mosquitto.conf(5) at v2.0.22 and v2.1.2 | confirmed |
| `allow_anonymous` defaults false when listeners are defined | 2.1.2 man: "Defaults to false, unless no listeners are defined …" | confirmed |
| password_file and acl_file deprecated in the 2.1 release notes, removal in 3.0 | ChangeLog 2.1.0 "Deprecations" | confirmed (V2-13) |
| ACL `user` = username, not clientId; `%c`/`%u` patterns | mosquitto.conf(5), both versions | confirmed (V2-05) |
| Options behave the same on Windows and Linux | built into the broker on both; Windows installer ships `mosquitto_passwd.exe`; only the file-permission and symlink checks are Linux-only | confirmed, apart from the passwd hash default (V2-02) and V2-11 |
| `mosquitto_passwd` usage (`-c` create, `-b` batch, `-D` delete, `-U` upgrade plain text) | `mosquitto_passwd.1.xml` v2.1.2 | confirmed |
| MQTT.js 5.x `username`/`password` | `client.d.ts`, README (5.16.1) | confirmed |
| esp-mqtt username/password in Arduino-ESP32 3.x | `mqtt_client.h` at IDF v5.5.6's pin; present in `esp32-libs-3.3.12.zip` | confirmed |
| SOF markers are the right place to read width and height | T.81 B.2.2, Table B.1 | confirmed (V2-03 on how to parse) |
| `mysqldump --ignore-table=db.table` syntax, repeat per table | MySQL 9.7 reference | confirmed (V2-04 on what it omits) |
| Stack row "Eclipse Mosquitto 2.1.2" is newest | tags list: v2.1.2 first, no 3.x | confirmed |

## Sources

- Mosquitto ChangeLog at v2.1.2: https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/ChangeLog.txt
- mosquitto.conf(5) v2.1.2: https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/man/mosquitto.conf.5.xml
- mosquitto.conf(5) v2.0.22: https://github.com/eclipse-mosquitto/mosquitto/blob/v2.0.22/man/mosquitto.conf.5.xml
- mosquitto_passwd(1) v2.1.2: https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/man/mosquitto_passwd.1.xml
- mosquitto_passwd(1) v2.0.22: https://github.com/eclipse-mosquitto/mosquitto/blob/v2.0.22/man/mosquitto_passwd.1.xml
- 2.0.22 password decoding (12-byte salt, types 6/7 only): https://github.com/eclipse-mosquitto/mosquitto/blob/v2.0.22/src/security_default.c#L841-L925
- 2.1.2 password hashing (argon2id default, 64-byte salt): https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/libcommon/password_common.c
- 2.1.2 will ACL check: https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/src/context.c#L216-L245
- 2.1.2 denied publish handling: https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/src/handle_publish.c#L35-L60
- 2.1.2 denied subscribe (0x80): https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/src/handle_subscribe.c#L194-L204
- 2.1.2 file permission and symlink checks: https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/libcommon/file_common.c#L160-L232
- 2.1.2 basic auth fallthrough: https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/src/plugin_basic_auth.c#L55-L112
- 2.1.2 Windows build deps and installer: https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/vcpkg.json, https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/installer/mosquitto64.nsi, https://github.com/eclipse-mosquitto/mosquitto/blob/v2.1.2/README-windows.txt
- Ubuntu mosquitto packages: https://launchpad.net/ubuntu/+source/mosquitto ; PPA: https://launchpad.net/~mosquitto-dev/+archive/ubuntu/mosquitto-ppa
- Fedora mosquitto spec: https://src.fedoraproject.org/rpms/mosquitto/blob/f44/f/mosquitto.spec
- MQTT.js 5.16.1: https://www.npmjs.com/package/mqtt/v/5.16.1 ; README: https://github.com/mqttjs/MQTT.js#readme ; connack handler: https://github.com/mqttjs/MQTT.js/blob/main/src/lib/handlers/connack.ts
- esp-mqtt header at the ESP-IDF v5.5.6 pin: https://github.com/espressif/esp-mqtt/blob/0e9ec171b448db2101ea537300976b7ffe595941/include/mqtt_client.h ; master: https://github.com/espressif/esp-mqtt/blob/master/include/mqtt_client.h
- ESP-IDF 6.0 migration (ESP-MQTT is a managed component): https://github.com/espressif/esp-idf/blob/v6.0.3/docs/en/migration-guides/release-6.x/6.0/protocols.rst
- Arduino-ESP32 releases: https://github.com/espressif/arduino-esp32/releases/tag/3.3.12 , https://github.com/espressif/arduino-esp32/releases/tag/4.0.0-RC1
- ITU-T T.81 (JPEG), B.1.1.2, Table B.1, B.2.2: https://www.w3.org/Graphics/JPEG/itu-t81.pdf
- Pillow JPEG marker table: https://github.com/python-pillow/Pillow/blob/main/src/PIL/JpegImagePlugin.py
- image-size JPEG parser (C0–C2 only): https://github.com/image-size/image-size/blob/main/lib/types/jpg.ts
- MySQL 9.7 mysqldump: https://dev.mysql.com/doc/refman/9.7/en/mysqldump.html
- MariaDB `--ignore-table-data` (MariaDB only): https://jira.mariadb.org/browse/MDEV-22037
- Node 24 timers: https://nodejs.org/docs/latest-v24.x/api/timers.html ; Buffer: https://nodejs.org/docs/latest-v24.x/api/buffer.html
- Windows Firewall rules: https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules
- GNOME Network Displays: https://aur.archlinux.org/packages/gnome-network-displays ; https://www.phoronix.com/news/Ubuntu-22.10-Miracast-GNOME
