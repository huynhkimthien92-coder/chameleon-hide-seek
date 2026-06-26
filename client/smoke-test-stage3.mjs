import { Client, getStateCallbacks } from "@colyseus/sdk";

const SERVER_URL = "ws://localhost:2567";

function log(label, ...args) {
  console.log(`[${label}]`, ...args);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  // 3 client: A,B vào trước -> Seeker (SEEKER_SLOTS=2). C vào sau -> Hider.
  const clientA = new Client(SERVER_URL);
  const clientB = new Client(SERVER_URL);
  const clientC = new Client(SERVER_URL);

  const roomA = await clientA.joinOrCreate("game");
  const roomB = await clientB.joinOrCreate("game");
  const roomC = await clientC.joinOrCreate("game");
  log("JOIN", `A=${roomA.sessionId} B=${roomB.sessionId} C=${roomC.sessionId}`);

  const $a = getStateCallbacks(roomA);
  let phaseHistory = [];
  $a(roomA.state).listen("phase", (v) => {
    phaseHistory.push(v);
    log("PHASE", v);
  }, true);

  await wait(300);
  const teamA = roomA.state.players.get(roomA.sessionId)?.team;
  const teamB = roomB.state.players.get(roomB.sessionId)?.team;
  const teamC = roomC.state.players.get(roomC.sessionId)?.team;
  log("TEAM", `A=${teamA} B=${teamB} C=${teamC}`);
  const teamOk = teamA === "seeker" && teamB === "seeker" && teamC === "hider";

  // --- Chờ lobby tự start (LOBBY_GRACE_MS đã set thấp khi chạy test, xem README) ---
  await wait(1500);
  const startedOk = roomA.state.phase === "playing" && roomA.state.matchSecondsLeft > 0;
  log("TEST", `phase=${roomA.state.phase} matchSecondsLeft=${roomA.state.matchSecondsLeft}`);

  // --- Đặt vị trí: A đứng tại gốc nhìn về +Z (rotY=0), C đứng ngay trước mặt A ---
  roomA.send("move", { x: 0, y: 1, z: 0, rotY: 0 });
  roomC.send("move", { x: 0, y: 1, z: 5, rotY: 0 }); // ngay phía trước A theo +Z
  await wait(300);

  // --- Test anti-cheat Freeze: C đóng băng rồi thử di chuyển ---
  roomC.send("pose", { pose: "freeze" });
  await wait(150);
  roomC.send("move", { x: 99, y: 1, z: 99, rotY: 0 }); // phải bị server từ chối
  await wait(300);
  const cPosAfterFreeze = roomA.state.players.get(roomC.sessionId);
  const freezeOk = cPosAfterFreeze.x === 0 && cPosAfterFreeze.z === 5;
  log("TEST", `vị trí C sau khi cố di chuyển lúc freeze = (${cPosAfterFreeze.x}, ${cPosAfterFreeze.z}) — phải vẫn (0,5)`);

  // Hết freeze để có thể bắn trúng bình thường ở bước sau
  roomC.send("pose", { pose: "idle" });
  await wait(200);

  // --- Test input rác cho súng: target không tồn tại, ammo không đổi (vẫn 5) ---
  roomA.send("shoot", { targetSessionId: "khong-ton-tai" });
  await wait(200);
  const ammoAfterGarbageShot = roomA.state.players.get(roomA.sessionId)?.ammo;
  log("TEST", `ammo A sau khi bắn vào target rác = ${ammoAfterGarbageShot} (vẫn tốn đạn vì coi là bắn trượt)`);
  // Bắn trượt vẫn tốn đạn theo luật (vision.md) — chỉ không gây elimination.
  const missConsumesAmmoOk = ammoAfterGarbageShot === 4;
  const cStillAliveOk = roomA.state.players.get(roomC.sessionId)?.eliminated === false;

  // --- Test bắn trúng thật: A bắn C (đang ở ngay trước mặt, đúng góc) ---
  roomA.send("shoot", { targetSessionId: roomC.sessionId });
  await wait(300);
  const cEliminated = roomA.state.players.get(roomC.sessionId)?.eliminated;
  const ammoAfterHit = roomA.state.players.get(roomA.sessionId)?.ammo;
  log("TEST", `C.eliminated = ${cEliminated}, ammo A = ${ammoAfterHit}`);

  // --- Test win condition: C là Hider duy nhất, đã bị loại -> Seeker thắng ngay ---
  await wait(300);
  const matchEndedOk = roomA.state.phase === "ended" && roomA.state.winner === "seeker";
  log("TEST", `phase=${roomA.state.phase} winner=${roomA.state.winner}`);

  // --- Test: bắn sau khi trận đã kết thúc phải bị từ chối (không trừ thêm đạn) ---
  roomA.send("shoot", { targetSessionId: roomC.sessionId });
  await wait(200);
  const ammoAfterMatchEnd = roomA.state.players.get(roomA.sessionId)?.ammo;
  const rejectShootAfterEndOk = ammoAfterMatchEnd === ammoAfterHit;
  log("TEST", `ammo A sau khi bắn lúc trận đã kết thúc = ${ammoAfterMatchEnd} (phải không đổi)`);

  console.log("\n=== KẾT QUẢ SMOKE TEST GIAI ĐOẠN 3 ===");
  console.log((teamOk ? "✅" : "❌") + " Gán team đúng (2 Seeker / 1 Hider trong test này)");
  console.log((startedOk ? "✅" : "❌") + " Lobby tự start trận sau grace period");
  console.log((freezeOk ? "✅" : "❌") + " Anti-cheat Freeze chặn di chuyển");
  console.log((missConsumesAmmoOk ? "✅" : "❌") + " Bắn trượt (target rác) vẫn tốn đạn, không lỗi");
  console.log((cStillAliveOk ? "✅" : "❌") + " Bắn trượt không làm ai bị loại");
  console.log((cEliminated ? "✅" : "❌") + " Bắn trúng -> Hider bị loại");
  console.log((matchEndedOk ? "✅" : "❌") + " Win condition: hết Hider -> Seeker thắng, phase=ended");
  console.log((rejectShootAfterEndOk ? "✅" : "❌") + " Từ chối bắn sau khi trận đã kết thúc");

  const ok =
    teamOk &&
    startedOk &&
    freezeOk &&
    missConsumesAmmoOk &&
    cStillAliveOk &&
    cEliminated &&
    matchEndedOk &&
    rejectShootAfterEndOk;

  roomA.leave();
  roomB.leave();
  roomC.leave();
  process.exit(ok ? 0 : 1);
}

run().catch((err) => {
  console.error("Lỗi smoke test:", err);
  process.exit(1);
});
