/**
 * E2E test luồng paint 3D (sau tích hợp ADR-001) — chạy trên server THẬT:
 * 1. A gửi nét 3D hợp lệ -> B nhận đúng shape {x,y,z,color,radius}, A không nhận lại
 * 2. Nét KHÔNG hợp lệ (ngoài biên ±2 / radius quá to / NaN) -> server chặn, B không nhận
 * 3. Client C vào SAU -> nhận paintHistoryBatch chứa nét 3D của A (catch-up)
 *
 * Chạy: node client/paint3d-e2e.mjs (server phải đang chạy ở :2567)
 */
import { Client } from "@colyseus/sdk";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SERVER_URL = "ws://localhost:2567";
let fails = 0;
const check = (c, m) => {
  console.log(`${c ? "PASS" : "FAIL"}: ${m}`);
  if (!c) fails++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Spawn server làm child của chính test — sống/chết cùng nhau, không cần
 *  background process riêng (bị sandbox/CI reap giữa các lệnh). */
async function spawnServer() {
  const serverDir = join(dirname(fileURLToPath(import.meta.url)), "../server");
  const proc = spawn("npx", ["tsx", "src/index.ts"], { cwd: serverDir, stdio: "pipe" });
  proc.stdout.on("data", () => {});
  proc.stderr.on("data", () => {});
  // chờ cổng mở thật (poll HTTP), tối đa 30s
  for (let i = 0; i < 60; i++) {
    try {
      await fetch("http://127.0.0.1:2567/");
      console.log(`cổng HTTP mở sau ~${(i + 1) * 0.5}s`);
      // Cổng HTTP mở TRƯỚC khi matchmaking route sẵn sàng (đã gặp thật:
      // join ngay lúc này -> MatchMakeError 1006) — chờ thêm cho chắc.
      await wait(2500);
      return proc;
    } catch {
      await wait(500);
    }
  }
  proc.kill();
  throw new Error("server không mở cổng sau 30s");
}

async function run() {
  const serverProc = await spawnServer();
  try {
    const clientA = new Client(SERVER_URL);
    const clientB = new Client(SERVER_URL);

  const roomA = await clientA.joinOrCreate("game");
  const roomB = await clientB.joinOrCreate("game");
  console.log(`A=${roomA.sessionId} B=${roomB.sessionId}`);

  const bReceived = [];
  const aReceived = [];
  roomB.onMessage("paintStroke", (d) => bReceived.push(d));
  roomA.onMessage("paintStroke", (d) => aReceived.push(d));
  // handler rỗng cho các message khác để SDK không cảnh báo
  roomA.onMessage("*", () => {});
  roomB.onMessage("*", () => {});

  await wait(300);

  // --- Test 1: nét 3D hợp lệ ---
  const stroke = { x: 0.12, y: -0.4, z: 0.83, color: "#3fa96b", radius: 0.1 };
  roomA.send("paintStroke", stroke);
  await wait(400);

  check(bReceived.length === 1, `B nhận đúng 1 nét (thực tế ${bReceived.length})`);
  const r = bReceived[0] ?? {};
  check(
    r.sessionId === roomA.sessionId &&
      Math.abs(r.x - stroke.x) < 1e-9 &&
      Math.abs(r.y - stroke.y) < 1e-9 &&
      Math.abs(r.z - stroke.z) < 1e-9 &&
      r.color === stroke.color &&
      Math.abs(r.radius - stroke.radius) < 1e-9,
    `shape 3D đúng nguyên vẹn: ${JSON.stringify(r)}`
  );
  check(aReceived.length === 0, "A KHÔNG nhận lại nét của chính mình (except: client)");

  // --- Test 2: server chặn nét không hợp lệ ---
  roomA.send("paintStroke", { x: 99, y: 0, z: 0, color: "#ff0000", radius: 0.1 }); // ngoài biên ±2
  roomA.send("paintStroke", { x: 0, y: 0, z: 0, color: "#ff0000", radius: 3 }); // radius quá to
  roomA.send("paintStroke", { x: NaN, y: 0, z: 0, color: "#ff0000", radius: 0.1 }); // NaN
  roomA.send("paintStroke", { x: 0, y: 0, z: 0, color: "red", radius: 0.1 }); // màu sai format
  await wait(400);
  check(
    bReceived.length === 1,
    `server chặn cả 4 nét không hợp lệ — B vẫn chỉ có 1 nét (thực tế ${bReceived.length})`
  );

  // --- Test 3: client vào sau nhận history 3D ---
  const clientC = new Client(SERVER_URL);
  let historyGot = null;
  const roomC = await clientC.joinOrCreate("game");
  roomC.onMessage("paintHistoryBatch", (h) => (historyGot = h));
  roomC.onMessage("*", () => {});
  await wait(500);

  const aStrokes = historyGot?.[roomA.sessionId] ?? [];
  check(
    aStrokes.length === 1 && Math.abs(aStrokes[0].x - stroke.x) < 1e-9 && aStrokes[0].color === stroke.color,
    `C (vào sau) nhận history 3D của A: ${JSON.stringify(aStrokes)}`
  );

  roomA.leave();
  roomB.leave();
  roomC.leave();
  console.log(fails === 0 ? "\n=== TẤT CẢ E2E PASS ===" : `\n=== ${fails} E2E FAIL ===`);
  } finally {
    serverProc.kill("SIGKILL");
  }
  process.exit(fails === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error("E2E lỗi:", e);
  process.exit(1);
});
