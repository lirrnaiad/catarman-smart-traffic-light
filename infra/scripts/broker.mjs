// npm run broker: starts the native Mosquitto from infra/mosquitto/mosquitto.conf
// with the repo root as the working directory (AD-15). Stop any Mosquitto OS
// service first; it holds port 1883.

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const config = "infra/mosquitto/mosquitto.conf";
const candidates = ["mosquitto", "C:\\Program Files\\mosquitto\\mosquitto.exe"];
const signals = ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"];

// The persistence directory is gitignored, so a fresh clone lacks it.
mkdirSync(fileURLToPath(new URL("../mosquitto/data/", import.meta.url)), {
  recursive: true,
});

function start(index) {
  const command = candidates[index];
  const child = spawn(command, ["-c", config], {
    cwd: root,
    stdio: "inherit",
  });

  // Keep running until the broker exits, so its exit code becomes ours. On
  // Windows the console already delivers Ctrl+C to the broker, and child.kill()
  // would terminate it before it saves its persistence file.
  const forward = (signal) => {
    if (process.platform === "win32") {
      return;
    }
    if (child.exitCode === null && child.signalCode === null) {
      // Mosquitto reloads its config on SIGHUP; a closed terminal must stop it.
      child.kill(signal === "SIGHUP" ? "SIGTERM" : signal);
    }
  };

  child.once("spawn", () => {
    console.info(`[broker] ${command} -c ${config} (pid ${child.pid})`);
    for (const signal of signals) {
      process.on(signal, forward);
    }
  });

  child.once("error", (error) => {
    if (error.code === "ENOENT" && index + 1 < candidates.length) {
      start(index + 1);
      return;
    }
    if (error.code === "ENOENT") {
      console.error(
        "[broker] Mosquitto not found on the PATH or in C:\\Program Files\\mosquitto. Install it per docs/setup.md.",
      );
    } else {
      console.error(`[broker] could not start ${command}: ${error.message}`);
    }
    process.exit(1);
  });

  child.once("exit", (code, signal) => {
    for (const name of signals) {
      process.off(name, forward);
    }
    if (signal) {
      console.info(`[broker] mosquitto stopped by ${signal}`);
    }
    process.exit(code ?? 1);
  });
}

start(0);
