import { Room, Client } from "colyseus";
import type { Delayed } from "@colyseus/timer";
import { GameState, PlayerState } from "./schema/GameState.js";

const SEEKER_SLOTS = 2;
const ROOM_CAPACITY = 6; // 2 Seeker + 4 Hider — vision.md mục 3

const MIN_PLAYERS_TO_START = 2;
// Cho phép override bằng env khi test (smoke test không muốn chờ lâu mỗi lần) —
// production vẫn giữ mặc định.
const LOBBY_GRACE_MS = Number(process.env.LOBBY_GRACE_MS) || 5000;
const PREP_DURATION_SECONDS = Number(process.env.PREP_DURATION_SECONDS) || 30; // thời gian Hider giấu mình/vẽ
const MATCH_DURATION_SECONDS = 180; // vision.md mục 3

const MAX_SHOOT_RANGE = 30; // mét
const SHOOT_ANGLE_TOLERANCE = (25 * Math.PI) / 180; // 25 độ, đổi ra radian

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const VALID_POSES = ["idle", "crouch", "lean", "lay", "freeze"] as const;

const MAX_STROKES_PER_PLAYER = 2000; // giới hạn bộ nhớ — cũ nhất bị bỏ khi vượt

type MoveMessage = { x: number; y: number; z: number; rotY: number };
type PaintStrokeMessage = { u: number; v: number; color: string; radius: number };
type PoseMessage = { pose: string };
type ShootMessage = { targetSessionId?: string };

/**
 * GIAI ĐOẠN 3 — Multiplayer Combat & Match Rules (vision.md mục 3):
 *   - Lobby chờ đủ người (đầy phòng = bắt đầu ngay, hoặc sau LOBBY_GRACE_MS
 *     nếu đã có tối thiểu MIN_PLAYERS_TO_START người).
 *   - **Pha chuẩn bị (preparing)**: Hider di chuyển/tạo dáng/vẽ tự do bình
 *     thường; Seeker bị chặn di chuyển (move) + không bắn được (shoot đã
 *     chặn ngoài phase "playing" từ trước) — mô phỏng "seeker nhắm mắt chờ"
 *     kiểu trốn tìm thật. Hết PREP_DURATION_SECONDS mới chuyển "playing".
 *   - Đếm ngược trận, điều kiện thắng/thua.
 *   - Súng: server validate hình học đơn giản (không chạy physics simulation
 *     — xem stack.md mục 3), không reload.
 *   - Anti-cheat Freeze: chặn "move" khi pose === "freeze".
 *
 * GIỚI HẠN ĐÃ BIẾT (chấp nhận cho MVP, không phải lỗi):
 *   - Chỉ rotY được đồng bộ (không có pitch) nên validate góc bắn chỉ xét
 *     mặt phẳng ngang — không thể phân biệt "bắn lên/xuống" chính xác.
 *     Hardening thêm (nếu cần) là việc của giai đoạn polish sau MVP.
 */
export class GameRoom extends Room<{ state: GameState }> {
  maxClients = ROOM_CAPACITY;

  private lobbyTimer?: Delayed;
  private matchTimer?: Delayed;

  /** Lịch sử nét vẽ mỗi player — KHÔNG qua Schema (xem comment ở GameState.ts).
   * Dùng để gửi 1 lần cho người mới vào phòng (catch-up), không phải state
   * đồng bộ liên tục như players map. */
  private paintHistory: Record<string, PaintStrokeMessage[]> = {};

  onCreate() {
    this.setState(new GameState());

    this.lobbyTimer = this.clock.setTimeout(() => this.tryStartMatch(), LOBBY_GRACE_MS);

    this.onMessage("move", (client, message: MoveMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Anti-cheat Freeze (vision.md mục 3): từ chối mọi update vị trí khi
      // đang đóng băng — đơn giản nhất là không áp dụng gì cả.
      if (player.pose === "freeze") return;

      // Hider đã bị loại -> chế độ Spectate, không còn di chuyển được trong thế giới game.
      if (player.eliminated) return;

      // Pha chuẩn bị: Seeker bị chặn di chuyển — "nhắm mắt chờ" để Hider
      // giấu mình/vẽ tự do mà không bị Seeker lợi dụng đi dò trước.
      if (this.state.phase === "preparing" && player.team === "seeker") return;

      player.x = message.x;
      player.y = message.y;
      player.z = message.z;
      player.rotY = message.rotY;
    });

    this.onMessage("paintStroke", (client, message: PaintStrokeMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Validate chặt — đây là input người dùng gửi lên, không tin tưởng mù quáng.
      if (!HEX_COLOR_RE.test(message?.color)) return;
      if (typeof message?.u !== "number" || message.u < 0 || message.u > 1) return;
      if (typeof message?.v !== "number" || message.v < 0 || message.v > 1) return;
      if (typeof message?.radius !== "number" || message.radius <= 0 || message.radius > 0.5) return;

      const stroke: PaintStrokeMessage = {
        u: message.u,
        v: message.v,
        color: message.color,
        radius: message.radius,
      };

      const history = (this.paintHistory[client.sessionId] ??= []);
      history.push(stroke);
      if (history.length > MAX_STROKES_PER_PLAYER) history.shift();

      // Không gửi lại cho chính người vẽ — họ đã tự vẽ optimistic ở client rồi.
      this.broadcast("paintStroke", { sessionId: client.sessionId, ...stroke }, { except: client });
    });

    this.onMessage("pose", (client, message: PoseMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (!VALID_POSES.includes(message.pose as any)) return;
      player.pose = message.pose as PlayerState["pose"];
    });

    this.onMessage("shoot", (client, message: ShootMessage) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter) return;
      if (this.state.phase !== "playing") return;
      if (shooter.team !== "seeker") return; // chỉ Seeker được bắn
      if (shooter.ammo <= 0) return; // hết đạn, không reload (vision.md mục 3)

      shooter.ammo -= 1; // luôn tốn đạn dù trúng hay trượt

      const targetSessionId =
        typeof message?.targetSessionId === "string" ? message.targetSessionId : undefined;
      const target = targetSessionId ? this.state.players.get(targetSessionId) : undefined;

      if (target && this.isValidShot(shooter, target)) {
        target.eliminated = true;
        console.log(`[GameRoom] ${client.sessionId} bắn trúng ${targetSessionId}`);
        this.checkWinCondition();
      }
      // Không có target hợp lệ -> coi như bắn trượt, chỉ mất đạn (đã trừ ở trên).
    });
  }

  /** Kiểm tra hình học đơn giản — KHÔNG chạy physics simulation (stack.md mục 3). */
  private isValidShot(shooter: PlayerState, target: PlayerState): boolean {
    if (target.team !== "hider") return false; // không bắn được đồng minh
    if (target.eliminated) return false;

    const dx = target.x - shooter.x;
    const dy = target.y - shooter.y;
    const dz = target.z - shooter.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > MAX_SHOOT_RANGE) return false;

    const angleToTarget = Math.atan2(dx, dz);
    let angleDiff = Math.abs(angleToTarget - shooter.rotY);
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
    if (angleDiff > SHOOT_ANGLE_TOLERANCE) return false;

    return true;
  }

  private tryStartMatch() {
    if (this.state.phase !== "lobby") return;
    if (this.state.players.size < MIN_PLAYERS_TO_START) return;

    this.state.phase = "preparing";
    this.state.prepSecondsLeft = PREP_DURATION_SECONDS;
    this.lobbyTimer?.clear();
    this.matchTimer = this.clock.setInterval(() => this.tick(), 1000);
    console.log(`[GameRoom] Bắt đầu pha chuẩn bị — ${this.state.players.size} người chơi`);
  }

  /** Chạy mỗi giây xuyên suốt cả pha "preparing" và "playing" (1 interval dùng chung). */
  private tick() {
    if (this.state.phase === "preparing") {
      this.state.prepSecondsLeft -= 1;
      if (this.state.prepSecondsLeft <= 0) {
        this.state.prepSecondsLeft = 0;
        this.state.phase = "playing";
        this.state.matchSecondsLeft = MATCH_DURATION_SECONDS;
        console.log("[GameRoom] Hết giờ chuẩn bị — Seeker được thả ra tìm");
      }
      return;
    }

    if (this.state.phase === "playing") {
      this.state.matchSecondsLeft -= 1;
      if (this.state.matchSecondsLeft <= 0) {
        this.state.matchSecondsLeft = 0;
        const hidersTotal = [...this.state.players.values()].filter(
          (p) => p.team === "hider"
        ).length;
        // Hết giờ mà còn Hider sống -> Hider thắng (vision.md mục 3).
        // Trường hợp suy biến (0 Hider từng vào phòng) -> xử coi như Seeker thắng.
        this.endMatch(hidersTotal > 0 ? "hider" : "seeker");
      }
    }
  }

  private checkWinCondition() {
    if (this.state.phase !== "playing") return;
    const hiders = [...this.state.players.values()].filter((p) => p.team === "hider");
    if (hiders.length > 0 && hiders.every((p) => p.eliminated)) {
      this.endMatch("seeker");
    }
  }

  private endMatch(winner: "seeker" | "hider") {
    if (this.state.phase === "ended") return;
    this.state.phase = "ended";
    this.state.winner = winner;
    this.matchTimer?.clear();
    console.log(`[GameRoom] Trận kết thúc — phe thắng: ${winner}`);
    // TODO (Giai đoạn 4): dọn room / cho rematch sau khi hiện Victory/Defeat 1 lúc.
  }

  onJoin(client: Client) {
    const player = new PlayerState();

    const seekerCount = [...this.state.players.values()].filter(
      (p) => p.team === "seeker"
    ).length;
    player.team = seekerCount < SEEKER_SLOTS ? "seeker" : "hider";

    this.state.players.set(client.sessionId, player);
    console.log(`[GameRoom] ${client.sessionId} joined as ${player.team}`);

    // Catch-up: gửi 1 lần toàn bộ nét vẽ đã có của MỌI người trong phòng,
    // để người mới vào thấy đúng hiện trạng camo của mọi người.
    if (Object.keys(this.paintHistory).length > 0) {
      client.send("paintHistoryBatch", this.paintHistory);
    }

    if (this.state.players.size === ROOM_CAPACITY) {
      this.tryStartMatch(); // phòng đầy -> bắt đầu ngay, không cần chờ lobby timer
    }
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    delete this.paintHistory[client.sessionId];
    console.log(`[GameRoom] ${client.sessionId} left`);
    this.checkWinCondition(); // người rời đi có thể làm thay đổi điều kiện thắng/thua
  }
}
