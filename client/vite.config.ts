import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Tắt modulePreload — mặc định Vite tự chèn <link rel="modulepreload">
    // ngay trong index.html cho CẢ chunk được lazy-load (vendor-physics,
    // ~3.1MB Rapier WASM) — trình duyệt sẽ tải sớm bất kể code JS có
    // requestIdleCallback/dynamic import() trì hoãn hay không, vì preload
    // scanner xử lý tag này gần như ngay khi nhận HTML, trước khi JS chạy.
    // Đây chính là phần phá hỏng mục đích "trì hoãn tải Rapier" nếu để mặc định.
    modulePreload: false,

    // Tách vendor theo nhóm — giúp browser cache riêng phần ít đổi (three.js,
    // rapier...) khỏi phần code game đổi thường xuyên, và hết warning chunk
    // >500kb (chỉ là warning, không tách thì app vẫn chạy đúng — đây là tối
    // ưu cache/tải song song, không phải sửa lỗi).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (/[\\/](three|@react-three[\\/](fiber|drei))[\\/]/.test(id)) return "vendor-three";
            if (id.includes("@react-three/rapier") || id.includes("@dimforge")) return "vendor-physics";
            if (id.includes("@colyseus")) return "vendor-network";
          }
        },
      },
    },
  },
})
