MANNEQUIN: tách 4 phần (đầu/thân/tay/chân), CẦN UV map đẹp (cơ chế vẽ tự do lên người cần UV để biết điểm nhắm tương ứng pixel nào). Pose: rig+animation HOẶC đơn giản hơn — 5 mesh tĩnh riêng theo tư thế (idle/crouch/lean/lay/freeze).

MAP: 3 khu (gỗ/bê tông/cây cảnh) + sàn, dùng texture ẢNH THẬT có biến thiên màu (không phẳng màu — cơ chế hút màu cần pixel thật). Lấy free texture CC0 ở ambientCG/Polyhaven. Bake lighting bằng Cycles (Combined) vào texture.

EXPORT: .glb, bật Draco. Poly: mannequin ~2-5k, map ~10-20k tam giác. Texture ≤2048px. Tên object rõ: head/torso/arm_left/arm_right/leg_left/leg_right; zone_wood/zone_concrete/zone_plant/floor.
