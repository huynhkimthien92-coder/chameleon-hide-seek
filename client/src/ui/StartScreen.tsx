import { Play } from "lucide-react";

/**
 * Màn hình "Click to Play" — load tức thì vì KHÔNG import gì từ Three/Rapier/
 * Colyseus (toàn bộ nằm trong Game.tsx, chỉ tải khi bấm nút này). Đây là thứ
 * người chơi thấy đầu tiên, nên phải nhẹ và nhanh nhất có thể.
 */
export function StartScreen({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="fixed inset-0 bg-base flex items-center justify-center font-body">
      <div className="text-center px-6">
        <h1 className="font-display font-extrabold text-4xl md:text-5xl text-ink mb-3">
          🦎 Chameleon <span className="text-accent">Hide</span> &{" "}
          <span className="text-primary">Seek</span>
        </h1>
        <p className="text-ink/60 mb-8 max-w-md mx-auto">
          Hider hút màu từ môi trường, vẽ tự do lên người để ẩn mình. Seeker
          quan sát kỹ rồi bắn — chỉ 5 viên đạn, không reload.
        </p>
        <button
          onClick={onPlay}
          className="inline-flex items-center gap-2 bg-accent text-white font-display font-bold
                     text-lg px-8 py-4 rounded-pill shadow-hard-accent transition
                     active:translate-y-[2px] active:shadow-none"
        >
          <Play size={22} fill="white" />
          Chơi ngay
        </button>
        <p className="text-ink/40 text-xs mt-6">WASD di chuyển · Chuột nhìn quanh · Click để tương tác</p>
      </div>
    </div>
  );
}
