# Ghi chú: Map đỡ đơn điệu (bổ sung cho asset-brief)

Vấn đề: 3 khu màu cố định + sàn trống dễ học vẹt (chỉ 1 map duy nhất theo vision.md, không đổi gió được) và bố cục quá phẳng (Seeker quét hết bằng cách quay tại chỗ, không cần di chuyển).

## Hướng sửa (vẫn trong "1 map", không phá vision.md)

1. **Tăng số khu màu: 3 → 5-7**, cùng theme xưởng nghệ thuật:
   - Vải bố/canvas, tường gạch, khung sắt giàn giáo, thùng sơn loang...
   - Nhiều màu hơn = khó nhớ vị trí camo theo kiểu học vẹt.

2. **Phá hình khối phẳng** — thay box vuông bằng vật cản lổn nhổn:
   - Chồng thùng gỗ, giá vẽ, chậu cây cao thấp khác nhau.
   - Vừa che tầm nhìn (Seeker phải đi vòng, không chỉ quay tại chỗ).
   - Vừa cho Hider góc tựa/núp khớp pose đã có (nghiêng vào giá vẽ, ngồi sau thùng).

3. **Thêm độ cao**: gác lửng/bậc thang nhỏ — Seeker phải nhìn lên/xuống, không chỉ ngang.

4. **Vùng sáng/tối khác nhau**: vài góc tối hơn (đèn spotlight lệch) — chỗ tối dễ trốn hơn, thêm chiều sâu chiến thuật mà không cần thêm cơ chế mới trong code.

## Không cần làm ngay

Đây là gợi ý polish — bản gốc 3 khu + sàn vẫn chạy được đúng pipeline hút màu đã có. Có thể làm map tối giản trước để test ghép asset, rồi mở rộng theo các ý trên sau khi xác nhận pipeline chạy ổn.
