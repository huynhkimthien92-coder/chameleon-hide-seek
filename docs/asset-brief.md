# Asset Brief — Giai đoạn 0 (Blender)

> Tài liệu này nói chính xác cần **tạo ra cái gì** để khi export xong, code hiện có (Giai đoạn 1-4) ghép vào được ngay, không phải sửa lại logic. Đi cùng `vision.md`, `design.md`, `stack.md`.

## 1. Mannequin

**Yêu cầu bắt buộc:**
- Tách thành **ít nhất 4 phần riêng** (Đầu / Thân / Tay / Chân) — mỗi phần là 1 object hoặc 1 material slot riêng trong Blender.
- **CẦN UV map đẹp** (đã đổi từ "không cần" — xem cập nhật bên dưới) — cơ chế tô màu giờ là **vẽ tự do** (paint trực tiếp lên người ở bất kỳ vị trí, không chia ô cố định), cần UV để biết điểm nhắm trúng tương ứng pixel nào trên canvas vẽ. Nếu làm trong Blender, UV unwrap chuẩn (Smart UV Project hoặc seam thủ công) sẽ cho kết quả đẹp hơn nhiều so với cách mình tự tính UV bằng công thức xấp xỉ (cylindrical/spherical) cho asset hiện tại — asset hiện tại UV còn méo nhẹ ở vài chỗ (nách, bẹn) vì là tính tay, không phải unwrap thật.

**Về tư thế (pose) — 2 lựa chọn, chọn theo trình độ Blender của bạn:**

| Cách | Cần gì | Độ khó |
|---|---|---|
| A. Rig + animation clip | Armature, weight paint, bake 5 animation clip (Idle/Crouch/Lean/Lay/Freeze=Idle) | Cao — cần biết rigging |
| B. 4-5 file mesh tĩnh riêng (`mannequin_idle.glb`, `mannequin_crouch.glb`...) | Chỉ cần model + pose tay từng tư thế, không cần rig | Thấp — khuyên dùng nếu chưa quen rig |

Cách B đơn giản hơn nhiều, code vẫn ghép được bình thường (chỉ là chuyển mesh thay vì chạy animation clip).

## 2. Map "Art Studio"

- 3 khu vực màu rõ rệt: **Gỗ, Bê tông, Cây cảnh** + sàn — mỗi khu vực phải dùng **texture ảnh thật có biến thiên màu** (không phải 1 màu phẳng), vì cơ chế hút màu đọc pixel thật từ ảnh. Texture quá đều màu = cơ chế camo vô nghĩa.
- **Nguồn texture nhanh** (đỡ phải tự chụp/vẽ): [ambientCG](https://ambientcg.com) hoặc [Polyhaven](https://polyhaven.com) — texture CC0 (dùng tự do, không lo bản quyền), có sẵn category "wood", "concrete", "leaves".
- **Baked Lighting**: cách đơn giản nhất — dùng Cycles, bake pass "Combined" thẳng vào texture màu nền (không cần tách lightmap UV riêng cho MVP). Search "Blender bake combined to texture" để có tutorial đúng.
- Bố cục nên có vài vật cản/góc khuất để Seeker-Hider chơi có chiều sâu (vision.md không ép chi tiết, tự do sáng tạo phần này).

## 3. Checklist export (để ghép vào code không bị lỗi)

- Format: **`.glb`** (nhúng cả texture vào 1 file, gọn).
- Bật **Draco compression** khi export (Blender glTF exporter có sẵn checkbox).
- Giới hạn poly tạm: mannequin ~2-5k tam giác, map ~10-20k — đủ nhẹ cho web, không cần quá chi tiết.
- Texture: tối đa 1024-2048px/ảnh — phần nén KTX2 làm sau (xem mục 4), không cần tự làm.
- **Đặt tên object rõ ràng** để map đúng vào code, ví dụ:
  - Mannequin: `head`, `torso`, `arm_left`, `arm_right`, `leg_left`, `leg_right`
  - Map: `zone_wood`, `zone_concrete`, `zone_plant`, `floor`

## 4. Việc Claude vẫn giúp được sau khi có file thô

Không cần tự làm hết — chỉ cần đưa file `.glb` xuất từ Blender, các việc sau sẽ được hỗ trợ:
- Chạy `gltf-transform` (CLI, không cần Blender) để nén KTX2 cho texture nếu chưa kịp tối ưu.
- Thay placeholder trong code: `ArtStudioScene.tsx`, `Mannequin.tsx` → load GLTF thật, giữ nguyên toàn bộ logic hút màu/pose/combat đã chạy được (Giai đoạn 1-4).
- Chuyển cơ chế hút màu từ "đọc canvas tự sinh" sang "đọc pixel từ texture ảnh thật" — code đã viết sẵn đúng pipeline này (stack.md mục 4), chỉ cần đổi nguồn texture.
- Chạy lại 2 bộ smoke test đã có (`smoke-test.mjs`, `smoke-test-stage3.mjs`) để đảm bảo không có gì hỏng sau khi ghép asset thật.
