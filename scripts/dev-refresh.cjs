/**
 * Windows-first: free the dev port (stops stuck `node` from old Next runs), wipe `.next`, start `next dev`.
 * Fixes EADDRINUSE, HTTP 500 from corrupted webpack cache, zombie dev servers on the dev port, and missing
 * chunk errors like `Cannot find module './5611.js'` (stale or half-synced `.next` — e.g. OneDrive).
 *
 * Production: always run `npm run build` before `npm start`. Do not use `next start` on a `.next`
 * produced only by `next dev`. For a clean prod run locally: `npm run start:fresh`.
 *
 * Stability notes:
 * - Do not use `next/dynamic(() => import("@/components/navbar"))` for the public shell — Webpack Fast Refresh
 *   on Windows can throw `__webpack_modules__[moduleId] is not a function`.
 * - If it still happens: `npm run dev:turbo` (Turbopack) or run `npm run dev` again after this script clears `.next`.
 */
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

/** This repo always uses port 3001 for `npm run dev` / dev-refresh (do not change without updating docs). */
const port = "3001";

function sleepSync(ms) {
  if (ms <= 0) return;
  if (process.platform === "win32") {
    try {
      execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, { stdio: "ignore" });
      return;
    } catch {
      /* fall through */
    }
  }
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* fallback */
  }
}

/** Last segment of TCP local address is the port (works for 0.0.0.0:N and [::]:N). */
function localAddressPort(localAddr) {
  if (!localAddr || typeof localAddr !== "string") return null;
  const m = localAddr.match(/:(\d+)$/);
  return m ? m[1] : null;
}

function collectListeningPidsForPort(netstatOutput, targetPort) {
  const want = String(targetPort);
  const pids = new Set();
  for (const line of netstatOutput.split(/\r?\n/)) {
    if (!/\bLISTENING\b/i.test(line)) continue;
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5) continue;
    const local = cols[1];
    const pid = cols[cols.length - 1];
    if (localAddressPort(local) !== want) continue;
    if (!/^\d+$/.test(pid) || pid === "0") continue;
    pids.add(pid);
  }
  return pids;
}

function freePortWin(p) {
  let out;
  try {
    out = execSync("netstat -ano", { encoding: "utf8", maxBuffer: 1024 * 1024 });
  } catch {
    return;
  }
  const pids = collectListeningPidsForPort(out, p);
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`Stopped process ${pid} listening on port ${p}`);
    } catch {
      /* ignore */
    }
  }
}

function freePortUnix(p) {
  try {
    execSync(`lsof -ti:${p} | xargs kill -9`, { stdio: "ignore" });
    console.log(`Freed port ${p} (unix)`);
  } catch {
    /* ignore */
  }
}

function removeNextDir() {
  const nextDir = path.join(root, ".next");
  try {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log("Removed .next cache");
  } catch (e) {
    console.warn("Could not fully remove .next (retry once):", e.message || e);
    sleepSync(400);
    try {
      fs.rmSync(nextDir, { recursive: true, force: true });
      console.log("Removed .next cache (retry OK)");
    } catch {
      /* ignore */
    }
  }
}

function freePort() {
  if (process.platform === "win32") {
    freePortWin(port);
    sleepSync(350);
    freePortWin(port);
  } else {
    freePortUnix(port);
    sleepSync(200);
    freePortUnix(port);
  }
}

/** `node scripts/dev-refresh.cjs --free-only` — only free port + wipe .next (no `next dev`). */
if (process.argv.includes("--free-only")) {
  freePort();
  removeNextDir();
  process.exit(0);
}

freePort();
removeNextDir();

const useTurbo = process.argv.includes("--turbo");
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const devArgs = [nextCli, "dev", "-p", port, ...(useTurbo ? ["--turbo"] : [])];
const proc = spawn(process.execPath, devArgs, {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env }
});

proc.on("exit", (code) => process.exit(code ?? 0));
