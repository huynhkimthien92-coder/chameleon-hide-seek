import { Client, getStateCallbacks, type Room } from "@colyseus/sdk";
import { useGameStore } from "../store/useGameStore";
import type { Pose } from "../scene/poseTransform";
import type { Stroke } from "../scene/paintRegistry";
import { paintDab, replayStrokes } from "../scene/paintRegistry";

const SERVER_URL = import.meta.env.VITE_COLYSEUS_URL ?? "ws://localhost:2567";

let client: Client | null = null;
let room: Room | null = null;

/** Throttle gửi vị trí lên server — không cần gửi mỗi frame. */
let lastSentAt = 0;
const SEND_INTERVAL_MS = 50; // ~20 lần/giây, đủ cho MVP

export async function connectToGame() {
  const store = useGameStore.getState();
  store.setConnectionStatus("connecting");

  try {
    client = new Client(SERVER_URL);
    room = await client.joinOrCreate("game");

    store.setSessionId(room.sessionId);
    store.setConnectionStatus("connected");

    const $ = getStateCallbacks(room);

    // --- Match info top-level (vision.md mục 3) ---
    $(room.state).listen("phase", (value: any) => useGameStore.getState().setPhase(value), true);
    $(room.state).listen(
      "prepSecondsLeft",
      (value: any) => useGameStore.getState().setPrepSecondsLeft(value),
      true
    );
    $(room.state).listen(
      "matchSecondsLeft",
      (value: any) => useGameStore.getState().setMatchSecondsLeft(value),
      true
    );
    $(room.state).listen("winner", (value: any) => useGameStore.getState().setWinner(value), true);

    $(room.state).players.onAdd((player: any, sessionId: string) => {
      const isLocal = sessionId === room?.sessionId;
      useGameStore.getState().setPlayerCount(room?.state.players.size ?? 0);

      if (isLocal) {
        // State authoritative của CHÍNH player này — team/ammo/eliminated do
        // server quyết định, client không tự suy ra.
        const syncSelf = () => {
          const s = useGameStore.getState();
          s.setTeam(player.team);
          s.setAmmo(player.ammo);
          s.setEliminated(player.eliminated);
        };
        syncSelf();
        $(player).onChange(syncSelf);
        return;
      }

      const sync = () =>
        useGameStore.getState().upsertRemotePlayer({
          id: sessionId,
          x: player.x,
          y: player.y,
          z: player.z,
          rotY: player.rotY,
          team: player.team,
          pose: player.pose,
          eliminated: player.eliminated,
        });

      sync();
      $(player).onChange(sync);
    });

    $(room.state).players.onRemove((_player: any, sessionId: string) => {
      useGameStore.getState().removeRemotePlayer(sessionId);
      useGameStore.getState().setPlayerCount(room?.state.players.size ?? 0);
    });

    // Người khác vẽ -> vẽ lại lên đúng canvas của họ (xem paintRegistry.ts).
    // Không nhận lại nét của chính mình (server đã loại trừ — `except: client`).
    room.onMessage("paintStroke", (data: any) => {
      paintDab(data.sessionId, data.u, data.v, data.color, data.radius);
    });

    // Catch-up lúc mới vào phòng: vẽ lại toàn bộ nét đã có của mọi người.
    room.onMessage("paintHistoryBatch", (history: Record<string, Stroke[]>) => {
      for (const [sessionId, strokes] of Object.entries(history)) {
        replayStrokes(sessionId, strokes);
      }
    });

    room.onLeave(() => {
      useGameStore.getState().setConnectionStatus("idle");
    });
  } catch (err) {
    console.error("[colyseus] Kết nối thất bại:", err);
    store.setConnectionStatus("error");
  }
}

/** Gọi mỗi frame từ Player controller — tự throttle bên trong. */
export function sendLocalTransform(x: number, y: number, z: number, rotY: number) {
  if (!room) return;
  const now = performance.now();
  if (now - lastSentAt < SEND_INTERVAL_MS) return;
  lastSentAt = now;
  room.send("move", { x, y, z, rotY });
}

/** Gửi 1 nét vẽ (chấm cọ) — gọi liên tục lúc kéo chuột vẽ, đã throttle ở phía gọi (useInteraction.ts). */
export function sendPaintStroke(u: number, v: number, color: string, radius: number) {
  room?.send("paintStroke", { u, v, color, radius });
}

/** Gửi 1 lần khi người chơi đổi pose. */
export function sendPose(pose: Pose) {
  room?.send("pose", { pose });
}

/** Seeker bắn — targetSessionId là kết quả raycast phía client, server tự validate lại. */
export function sendShoot(targetSessionId: string | null) {
  room?.send("shoot", { targetSessionId: targetSessionId ?? undefined });
}

export function disconnectFromGame() {
  room?.leave();
  room = null;
  client = null;
}
