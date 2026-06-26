# Implementation Plan

> **Lưu ý:** Timeline đã điều chỉnh so với bản gốc (4 tuần) vì 2 quyết định ảnh hưởng lớn đến độ phức tạp: asset 3D tự sản xuất riêng (cần thời gian làm art) và cơ chế hút màu dùng texture ảnh thật (phức tạp hơn solid-color). Tổng thời lượng ước tính: **~7 tuần**.

## Giai đoạn 0: Art Production & Asset Pipeline (Tuần 1-2)
- Model map "Art Studio" trong Blender với các khu vực màu rõ rệt (Gỗ, Bê tông, Cây cảnh), bake lighting.
- Model mannequin, UV-map riêng từng bộ phận (đầu, thân, tay, chân) để tô màu độc lập.
- Export GLTF/GLB kèm Draco compression; thiết lập pipeline nén texture KTX2 ngay từ đầu (không để tới cuối dự án).

## Giai đoạn 1: Hạ tầng 3D + Khung Multiplayer (Tuần 3)
- Setup dự án Vite + R3F, import asset từ Giai đoạn 0.
- Cài đặt ánh sáng (Environment Map baked + Directional Light cho real-time shadows).
- Triển khai di chuyển nhân vật: First person (Seeker), Third person (Hider), character controller qua `@react-three/rapier`.
- **Song song:** dựng khung Colyseus server (room, join/leave, sync vị trí cơ bản) sớm — networking là phần rủi ro lịch trình cao nhất, nên tích hợp từ đầu thay vì để dồn vào cuối.
- **Checkpoint:** 2 client kết nối cùng room, thấy nhau di chuyển real-time.

## Giai đoạn 2: Cơ chế Chameleon (Tuần 4)
- Raycaster Picker: đọc UV → pixel màu qua offscreen canvas (theo stack.md mục 4), xử lý vấn đề CORS nếu texture không same-origin.
- Áp dụng màu vào Material đã `clone()` riêng cho từng player (tránh lỗi material dùng chung).
- Pose System: animation Idle / Crouch / Lean / Lay down qua GLTF animation clips + `useAnimations` (drei).
- **Checkpoint playtest:** tô màu + đổi pose hoạt động đúng, xác nhận không có lỗi đổi màu chéo giữa các player.

## Giai đoạn 3: Multiplayer Combat & Match Rules (Tuần 5)
- Đồng bộ state đầy đủ: position, rotation, color từng bộ phận, pose ID, theo cấu hình **2 Seeker / 4 Hider** (vision.md mục 3).
- Súng: raycast hitscan từ Seeker (client) → server validate bằng check hình học đơn giản (không full physics, theo stack.md mục 3).
- Áp dụng luật trận: 5 đạn/Seeker không reload, điều kiện thắng/thua, Hider bị loại → chế độ Spectate.
- Đếm ngược thời gian trận (mặc định 180s) + xử lý kết thúc trận / hiển thị kết quả.
- **Checkpoint playtest:** chơi networked đủ 2 phe (2v4), xác nhận điều kiện thắng/thua và anti-cheat Freeze hoạt động đúng.

## Giai đoạn 4: UI & Audio (Tuần 6)
- Áp dụng Tailwind CSS theo Design System đã cập nhật: Color Picker UI, Pose Selector, HUD, Victory/Defeat overlay.
- Hiệu ứng âm thanh qua Howler.js (pop khi tô màu, tiếng súng đồ chơi).
- Zustand cho state UI/HUD phía client.

## Giai đoạn 5: Tối ưu & Playtest cuối (Tuần 7)
- LOD cho môi trường; xác nhận nén texture/GLTF đã đúng chuẩn (đã setup từ Giai đoạn 0, không phải làm lại).
- Kiểm tra accessibility: contrast màu, icon đi kèm màu để phân biệt phe (colorblind-safe).
- Playtest tổng thể, tinh chỉnh độ khó hút màu — vì dùng texture thật, có thể cần chỉnh độ phân giải/contrast giữa các khu vực màu để cân bằng độ khó cho Seeker.

## Việc còn cần chốt trước khi bắt đầu
- Thời lượng trận chính xác (mặc định đề xuất 180s, cần playtest để tinh chỉnh).

## Lưu ý triển khai hosting (Tuần 3)
- Hosting đã chốt: Client trên Vercel, Colyseus server trên Fly.io (chi tiết xem stack.md mục 8).
- Nên deploy thử bản khung Colyseus lên Fly.io ngay từ Giai đoạn 1 (không chỉ chạy local) để phát hiện sớm vấn đề CORS/WSS/region — tránh việc tới Giai đoạn 3 mới phát hiện lỗi deploy thì đã trễ.
