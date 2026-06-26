import { Client, getStateCallbacks } from "@colyseus/sdk";

const SERVER_URL = "ws://localhost:2567";

function log(label, ...args) {
  console.log(`[${label}]`, ...args);
}

async function run() {
  const clientA = new Client(SERVER_URL);
  const clientB = new Client(SERVER_URL);

  const roomA = await clientA.joinOrCreate("game");
  log("A", "joined as", roomA.sessionId);

  const roomB = await clientB.joinOrCreate("game");
  log("B", "joined as", roomB.sessionId);

  const $b = getStateCallbacks(roomB);
  let bSawA = false;

  $b(roomB.state).players.onAdd((player, sessionId) => {
    if (sessionId !== roomA.sessionId) return;
    log("B", `thấy player A (${sessionId}) team=${player.team} x=${player.x}`);
    $b(player).onChange(() => {
      log("B", `player A cập nhật -> x=${player.x.toFixed(2)} z=${player.z.toFixed(2)}`);
      bSawA = true;
    });
  });

  // chờ state ban đầu đồng bộ
  await new Promise((r) => setTimeout(r, 300));

  log("A", "team được gán:", roomA.state.players.get(roomA.sessionId)?.team);
  log("B", "team được gán:", roomB.state.players.get(roomB.sessionId)?.team);

  // Client A gửi move
  roomA.send("move", { x: 3.5, y: 1, z: -2, rotY: 1.57 });

  await new Promise((r) => setTimeout(r, 400));

  const playerAFromB = roomB.state.players.get(roomA.sessionId);
  const moveOk =
    bSawA &&
    playerAFromB &&
    Math.abs(playerAFromB.x - 3.5) < 0.001 &&
    Math.abs(playerAFromB.z - (-2)) < 0.001;

  // --- Test 2: paint (tô màu) — A tô đầu màu đỏ, B phải thấy đúng màu,
  // và màu của B (player B tự nhìn chính mình) KHÔNG được bị ảnh hưởng
  // (đây chính là lỗi "đổi màu chéo" mà stack.md mục 4 cảnh báo).
  roomA.send("paint", { part: "head", color: "#ff0000" });
  await new Promise((r) => setTimeout(r, 300));

  const aHeadFromB = roomB.state.players.get(roomA.sessionId)?.colorHead;
  const bHeadFromB = roomB.state.players.get(roomB.sessionId)?.colorHead;
  const paintOk = aHeadFromB === "#ff0000" && bHeadFromB === "#ffffff";
  log("TEST", `A.colorHead (qua B) = ${aHeadFromB}, B.colorHead (qua B) = ${bHeadFromB}`);

  // --- Test 3: input rác phải bị server từ chối (validate) ---
  roomA.send("paint", { part: "head", color: "javascript:alert(1)" });
  roomA.send("paint", { part: "not_a_real_part", color: "#000000" });
  await new Promise((r) => setTimeout(r, 200));
  const headAfterGarbage = roomB.state.players.get(roomA.sessionId)?.colorHead;
  const validateOk = headAfterGarbage === "#ff0000"; // không đổi vì input rác bị từ chối
  log("TEST", `colorHead sau khi gửi input rác = ${headAfterGarbage} (phải vẫn là #ff0000)`);

  // --- Test 4: pose ---
  roomA.send("pose", { pose: "crouch" });
  await new Promise((r) => setTimeout(r, 300));
  const poseOk = roomB.state.players.get(roomA.sessionId)?.pose === "crouch";
  log("TEST", `A.pose (qua B) = ${roomB.state.players.get(roomA.sessionId)?.pose}`);

  console.log("\n=== KẾT QUẢ SMOKE TEST ===");
  console.log((moveOk ? "✅" : "❌") + " Đồng bộ vị trí (Giai đoạn 1)");
  console.log((paintOk ? "✅" : "❌") + " Tô màu đúng player, không lộ chéo (Giai đoạn 2)");
  console.log((validateOk ? "✅" : "❌") + " Server từ chối input rác (Giai đoạn 2)");
  console.log((poseOk ? "✅" : "❌") + " Đồng bộ pose (Giai đoạn 2)");

  const ok = moveOk && paintOk && validateOk && poseOk;

  roomA.leave();
  roomB.leave();
  process.exit(ok ? 0 : 1);
}

run().catch((err) => {
  console.error("Lỗi smoke test:", err);
  process.exit(1);
});
