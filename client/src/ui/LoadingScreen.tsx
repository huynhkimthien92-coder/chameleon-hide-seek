/**
 * Hiện trong lúc chunk `Game` (chứa Rapier WASM ~3.1MB) đang được tải qua
 * dynamic import() — xem App.tsx. Tự nó phải nhẹ (không 3D) vì nằm trong
 * bundle chính, hiện ra khi Suspense đang chờ lazy() resolve.
 */
export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-base flex items-center justify-center font-body">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-accent/25 border-t-accent animate-spin" />
        <p className="font-display font-bold text-ink/70">Đang tải thế giới game…</p>
      </div>
    </div>
  );
}
