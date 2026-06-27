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

  // --- Test 2: paintStroke broadcast — A vẽ, B phải nhận được qua message
  // (không phải qua Schema nữa), A KHÔNG được nhận lại nét của chính mình.
  let bReceivedStroke = null;
  let aReceivedOwnStroke = false;
  roomB.onMessage("paintStroke", (data) => {
    bReceivedStroke = data;
  });
  roomA.onMessage("paintStroke", () => {
    aReceivedOwnStroke = true;
  });

  roomA.send("paintStroke", { u: 0.5, v: 0.5, color: "#ff0000", radius: 0.06 });
  await new Promise((r) => setTimeout(r, 300));

  const paintOk =
    bReceivedStroke?.sessionId === roomA.sessionId &&
        bReceivedStroke?.color === "#ff0000" &&
    !aReceivedOwnStroke;
  log("TEST", `B nhận stroke từ A = ${JSON.stringify(bReceivedStroke)}, A tự nhận lại nét mình = ${aReceivedOwnStroke}`);

  // --- Test 3: input rác phải bị server từ chối (không broadcast gì cả) ---
  let garbageBroadcastCount = 0;
  roomB.onMessage("paintStroke", () => {
    garbageBroadcastCount++;
  });
  roomA.send("paintStroke", { u: 0.5, v: 0.5, color: "javascript:alert(1)", radius: 0.06 });
  roomA.send("paintStroke", { u: 99, v: 0.5, color: "#000000", radius: 0.06 }); // u ngoài [0,1]
  roomA.send("paintStroke", { u: 0.5, v: 0.5, color: "#000000", radius: 99 }); // radius ngoài giới hạn
  await new Promise((r) => setTimeout(r, 200));
  const validateOk = garbageBroadcastCount === 0;
  log("TEST", `số broadcast nhận được từ 3 input rác = ${garbageBroadcastCount} (phải = 0)`);

  // --- Test 3b: catch-up — client mới vào phải nhận lại nét đã vẽ trước đó ---
  const clientC = new Client(SERVER_URL);
  const roomC = await clientC.joinOrCreate("game");
  let cHistory = null;
  roomC.onMessage("paintHistoryBatch", (history) => {
    cHistory = history;
  });
  await new Promise((r) => setTimeout(r, 300));
  const catchUpOk = cHistory?.[roomA.sessionId]?.some((s) => s.color === "#ff0000");
  log("TEST", `C nhận paintHistoryBatch chứa nét của A = ${!!catchUpOk}`);
  roomC.leave();

  // --- Test 4: pose ---
  roomA.send("pose", { pose: "crouch" });
  await new Promise((r) => setTimeout(r, 300));
  const poseOk = roomB.state.players.get(roomA.sessionId)?.pose === "crouch";
  log("TEST", `A.pose (qua B) = ${roomB.state.players.get(roomA.sessionId)?.pose}`);

  console.log("\n=== KẾT QUẢ SMOKE TEST ===");
  console.log((moveOk ? "✅" : "❌") + " Đồng bộ vị trí (Giai đoạn 1)");
  console.log((paintOk ? "✅" : "❌") + " Vẽ tự do: broadcast đúng, không tự nhận lại nét mình (Giai đoạn UV-paint)");
  console.log((validateOk ? "✅" : "❌") + " Server từ chối input rác (không broadcast gì)");
  console.log((catchUpOk ? "✅" : "❌") + " Client mới vào nhận lại lịch sử nét vẽ (catch-up)");
  console.log((poseOk ? "✅" : "❌") + " Đồng bộ pose (Giai đoạn 2)");

  const ok = moveOk && paintOk && validateOk && catchUpOk && poseOk;

  roomA.leave();
  roomB.leave();
  process.exit(ok ? 0 : 1);
}

run().catch((err) => {
  console.error("Lỗi smoke test:", err);
  process.exit(1);
});
