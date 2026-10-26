// node infra/scripts/check-live-layout.mjs [url]: opens `/` in headless Chrome at
// 1920x1080 and checks the layout rules a document-level check can't see (M1
// retrospective F1): `main` doesn't scroll, each override button's centre hits that
// button, no button overflows or overlaps another, the conflict-fault row is inside
// its panel, and no panel is clipped. Drive the state you want first (the simulator
// REPL, an override press), then run it. Exits 1 when a rule fails. No dependencies:
// Node 22+ and a local Chrome or Chromium; set CHROME to its path if it isn't found.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] ?? "http://127.0.0.1:4000/";
const candidates = [
  process.env.CHROME,
  "google-chrome",
  "chromium",
  "chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs in the page; returns the measurements and the failed rules. */
function probe() {
  const main = document.querySelector("main");
  const r = (e) => e.getBoundingClientRect();
  const mr = r(main);
  const ov = document
    .getElementById("override-panel-title")
    ?.closest("section");
  const buttons = ov ? [...ov.querySelectorAll("button")] : [];
  const failed = [];
  if (main.scrollHeight > main.clientHeight)
    failed.push(`main scrolls: ${main.scrollHeight} > ${main.clientHeight}`);
  if (document.documentElement.scrollHeight > window.innerHeight)
    failed.push("the page scrolls");
  for (const b of buttons) {
    const br = r(b);
    const hit = document
      .elementFromPoint(br.x + br.width / 2, br.y + br.height / 2)
      ?.closest("button");
    const name = b.textContent.replace(/\s+/g, " ").trim();
    if (hit !== b) failed.push(`centre of "${name}" hits another element`);
    if (b.scrollHeight > b.clientHeight + 1) failed.push(`"${name}" overflows`);
  }
  for (let i = 0; i < buttons.length; i++)
    for (let j = i + 1; j < buttons.length; j++) {
      const a = r(buttons[i]);
      const c = r(buttons[j]);
      if (
        a.left < c.right - 1 &&
        c.left < a.right - 1 &&
        a.top < c.bottom - 1 &&
        c.top < a.bottom - 1
      )
        failed.push(`override buttons ${i + 1} and ${j + 1} overlap`);
    }
  const key = [...document.querySelectorAll("span")].find(
    (s) => s.textContent.trim() === "Conflict fault",
  );
  const row = key?.closest('div[class*="mt-[8px]"]');
  if (row) {
    const panel = row.closest("section");
    if (r(row).bottom > Math.min(r(panel).bottom, mr.bottom) + 0.5)
      failed.push("the conflict-fault row is cut off");
  }
  for (const s of main.querySelectorAll("section"))
    if (r(s).bottom > mr.bottom + 0.5)
      failed.push(`"${s.querySelector("h2")?.textContent}" is clipped`);
  return {
    main: [main.scrollHeight, main.clientHeight],
    buttons: buttons.map((b) => Math.round(r(b).height)),
    failed,
  };
}

async function launch() {
  for (const command of candidates) {
    const port = 9400 + Math.floor(Math.random() * 400);
    const profile = mkdtempSync(join(tmpdir(), "stl-layout-"));
    const chrome = spawn(
      command,
      [
        "--headless=new",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        "--window-size=1920,1080",
        "--hide-scrollbars",
        "--no-first-run",
        "about:blank",
      ],
      { stdio: "ignore" },
    );
    const started = await new Promise((resolve) => {
      chrome.once("spawn", () => resolve(true));
      chrome.once("error", () => resolve(false));
    });
    if (!started) {
      rmSync(profile, { recursive: true, force: true });
      continue;
    }
    for (let i = 0; i < 50; i++) {
      await sleep(200);
      try {
        const list = await (
          await fetch(`http://127.0.0.1:${port}/json/list`)
        ).json();
        const target = list.find((t) => t.type === "page");
        if (target) return { chrome, profile, target };
      } catch {}
    }
    chrome.kill();
    rmSync(profile, { recursive: true, force: true });
  }
  throw new Error(`no Chrome found; tried ${candidates.join(", ")}`);
}

const { chrome, profile, target } = await launch();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  pending.get(msg.id)?.(msg);
  pending.delete(msg.id);
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++seq;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });

let failed = true;
try {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url });
  await sleep(3000);
  const res = await send("Runtime.evaluate", {
    expression: `(${probe.toString()})()`,
    returnByValue: true,
  });
  if (res.result.exceptionDetails)
    throw new Error(res.result.exceptionDetails.exception?.description);
  const m = res.result.result.value;
  console.info(
    `[layout] ${url} at 1920x1080: main ${m.main[0]}/${m.main[1]}, override buttons ${m.buttons.join(", ")} px`,
  );
  for (const f of m.failed) console.error(`[layout] FAIL: ${f}`);
  if (m.failed.length === 0) console.info("[layout] every rule passes");
  failed = m.failed.length > 0;
} finally {
  ws.close();
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
