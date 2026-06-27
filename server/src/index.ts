import "dotenv/config";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import cors from "cors";
import { GameRoom } from "./rooms/GameRoom.js";

const PORT = Number(process.env.PORT) || 2567;

// CORS: cho phép domain Vercel của client kết nối (xem stack.md mục 8).
// Khi deploy thật, set CLIENT_ORIGIN=https://your-app.vercel.app trên Fly.io.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "*";

const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    app.use(cors({ origin: CLIENT_ORIGIN }));
    app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });
  },
});

gameServer.define("game", GameRoom);

gameServer.listen(PORT).then(() => {
  console.log(`[server] Colyseus đang chạy tại ws://localhost:${PORT}`);
  console.log(`[server] CORS cho phép origin: ${CLIENT_ORIGIN}`);
});
