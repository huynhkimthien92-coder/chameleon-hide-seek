# Tech Stack: The "Hide & Seek" Engine

## 1. Frontend Framework
- **React + Vite:** Tối ưu tốc độ build và quản lý State UI.

## 2. 3D & Physics
- **Three.js + React Three Fiber (R3F):** Engine render chính.
- **Drei:** Thư viện hỗ trợ helper cho R3F (với `ContactShadows`, `Environment`, `useAnimations`).
- **Rapier.js** (qua wrapper `@react-three/rapier`): **chỉ** dùng cho character controller — va chạm người chơi với môi trường (tường, sàn, vật cản). **Không** dùng cho đạn bắn.
- **Súng/đạn:** dùng `THREE.Raycaster` hitscan thuần (bắn tức thì, không mô phỏng đường bay vật lý) — nhẹ hơn nhiều so với projectile vật lý, phù hợp vì cơ chế là "bắn trúng/trượt" ngay lập tức.

## 3. Multiplayer (Networking)
- **Colyseus.js:** Framework chuyên biệt cho game multiplayer.
    - Quản lý Room, State Synchronization (vị trí, màu sắc từng bộ phận, pose ID).
    - **Server-side hit validation:** server giữ vị trí/rotation/pose mới nhất của từng player; khi nhận raycast bắn từ Seeker, server check lại bằng hình học đơn giản (capsule/AABB) — đủ chống cheat cơ bản cho MVP, **không** cần chạy full physics simulation (Rapier) ở server.
    - **Anti-cheat Freeze:** khi pose flag = "freeze", server từ chối mọi update position/rotation delta khác 0 từ client đó (theo Match Rules ở vision.md).
    - **Schema state:** đóng gói màu từng bộ phận mannequin dưới dạng compact (vd: 1 giá trị hex/int32 mỗi part) để giảm payload đồng bộ.

## 4. Color Picking Pipeline
*(Vì môi trường dùng texture ảnh thật, không phải solid-color — xem vision.md mục 4)*
- Đọc màu tại điểm raycast trúng: dùng offscreen `<canvas>` để lấy `ImageData` tại tọa độ UV của điểm va trên texture nguồn.
- **Lưu ý CORS:** nếu texture được host trên domain/CDN khác, canvas sẽ bị "tainted" và không đọc được pixel — texture phải same-origin hoặc server đó set CORS header cho phép đọc.
- **Material instancing:** mỗi player phải `clone()` Material riêng trước khi gán màu — tránh lỗi đổi màu của 1 người làm đổi màu của tất cả người chơi dùng chung material gốc.

## 5. Asset Pipeline
*(Vì asset tự sản xuất riêng, không dùng asset có sẵn — xem implementation.md để biết ảnh hưởng timeline)*
- **Blender:** công cụ chính để model + bake lighting cho map "Art Studio" và mannequin (UV-map riêng từng bộ phận để tô màu độc lập).
- **Nén asset:** Draco compression cho GLTF/GLB, KTX2/Basis cho texture — thiết lập từ giai đoạn đầu dự án, không để tới cuối mới tối ưu.

## 6. Audio & Client State
- **Howler.js:** SFX (pop khi tô màu, tiếng súng đồ chơi).
- **Zustand:** state phía client (HUD, ammo, timer hiển thị), tách biệt khỏi Colyseus room state.

## 7. Styling & Assets
- **Tailwind CSS:** Xây dựng UI nhanh chóng dựa trên Design System.
- **GLTF/GLB:** Định dạng model 3D cho mannequin và môi trường (nén Draco/KTX2 theo mục 5).

## 8. Hosting
- **Client (Vite build):** Vercel, deploy trực tiếp từ GitHub repo (auto-deploy mỗi push, có preview URL theo branch/PR).
- **Colyseus server:** **Render (Web Service)** — vì cần một process Node.js chạy liên tục giữ state room trong memory, không phù hợp với mô hình serverless của Vercel. (Đã đổi từ Fly.io vì Fly.io bắt buộc thẻ tín dụng dù dùng free tier, Render không yêu cầu — xem `docs/deployment-guide.md` để biết lịch sử quyết định.)
    - Deploy qua web dashboard của Render, không cần CLI: connect GitHub repo, Root Directory = `server`, Build Command = `npm install && npm run build`, Start Command = `npm start`.
    - Render tự inject biến `PORT` — code đã đọc `process.env.PORT` sẵn, không cần chỉnh.
    - Free tier: server tự ngủ sau ~15 phút không có kết nối, "thức" lại ~30-60s khi có người vào — đánh đổi chấp nhận được cho quy mô chơi thử với bạn bè (không phải server public 24/7).
    - Deploy tự động mỗi khi push code lên GitHub (đã connect).
- **CORS & WebSocket:** server Render phải khai báo CORS (`CLIENT_ORIGIN`) cho phép domain Vercel của client kết nối; client dùng `wss://` (vì Render serve qua HTTPS) để kết nối tới Colyseus. Nếu dùng preview deployment của Vercel (domain đổi mỗi PR), cần whitelist theo pattern domain hoặc tạm dùng domain cố định khi test multiplayer.
