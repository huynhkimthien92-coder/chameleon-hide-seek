# Vision & Scope: "Chameleon Hide & Seek" (Web 3D)

## 1. Mục tiêu dự án
Tạo ra một trò chơi 3D Multiplayer trên trình duyệt, nơi người chơi sử dụng màu sắc và tư thế để ẩn mình vào môi trường "Art Studio".

## 2. Gameplay Cốt lõi
- **Phe Trốn (Hiders):**
    - Sử dụng công cụ "Color Picker" để hút màu từ các bề mặt môi trường (texture ảnh thật — xem mục 4).
    - Tô màu lên model mannequin của bản thân (theo từng bộ phận, UV-map riêng).
    - Chọn từ 5-7 tư thế (Pose) khác nhau.
    - Cơ chế "Freeze": Bất động hoàn toàn để hòa nhập vào bối cảnh.
- **Phe Tìm (Seekers):**
    - Sử dụng súng đồ chơi với số lượng đạn giới hạn (5 viên), không reload trong trận.
    - Phải quan sát sự bất thường trong màu sắc/bóng đổ để tìm Hiders.
    - Bắn trúng Hider = Hider bị loại. Bắn trượt = Mất đạn.

## 3. Match Rules (Luật trận)
- **Tỉ lệ phe:** 2 Seeker vs 4 Hider mỗi trận (phòng 6 người, đối xứng theo cấu hình này — không random tỉ lệ ở MVP).
- **Thời lượng trận:** đếm ngược cố định (đề xuất 3 phút / 180s — có thể chỉnh sau khi playtest).
- **Điều kiện thắng/thua:**
    - Seeker thắng nếu loại được toàn bộ 4 Hider trước khi hết giờ.
    - Hider thắng (phe sống sót) nếu còn ít nhất 1 Hider sống khi hết giờ.
    - Hết đạn không có nghĩa Seeker bị loại khỏi trận — Seeker hết 5 viên vẫn di chuyển/quan sát được, chỉ không bắn được nữa cho tới hết trận.
- **Hider bị loại:** chuyển sang chế độ **Spectate** (xem các Hider còn sống chơi tiếp), không rời phòng giữa trận.
- **Lưu ý anti-cheat (Freeze):** hiện cơ chế "Freeze" chỉ dựa vào tự giác người chơi — không có gì ngăn việc di chuyển trong lúc "đóng băng". Ở v1 nên bổ sung kiểm tra phía server: khi pose flag = "freeze", server từ chối mọi update position/rotation delta khác 0 từ client đó (chi tiết kỹ thuật xem stack.md).

## 4. Môi trường (Map)
- **Bối cảnh:** "Art Studio" - Một xưởng nghệ thuật với các khu vực màu sắc rõ rệt (Gỗ, Bê tông, Cây cảnh).
- **Vật liệu:** các bề mặt dùng **texture ảnh thật** (không phải solid-color) để Color Picker đọc đúng màu thực tế tại từng điểm va — texture cần đủ độ phân giải và đa dạng màu trong mỗi khu vực để tạo độ khó hợp lý cho Seeker khi quan sát.
- **Ánh sáng:** Sử dụng Baked Lighting cho môi trường và Real-time Shadows cho người chơi để tạo độ sâu và thử thách khi ẩn nấp.

## 5. Phạm vi MVP (Cắt giảm)
- Không tùy chỉnh nhân vật phức tạp (chỉ dùng mannequin).
- Không phá hủy môi trường.
- 1 bản đồ duy nhất để tối ưu hóa trải nghiệm.
- Asset 3D (mannequin + map) tự sản xuất riêng, không dùng asset có sẵn — xem implementation.md để biết ảnh hưởng đến timeline.
