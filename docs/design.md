# Design System: Toy Box Playful

## 1. Visual Identity
- **Vibe:** Vui nhộn, thân thiện, cảm giác như các khối nhựa đồ chơi cao cấp.
- **Anatomy:**
    - Bo góc (Border Radius): 20px cho Panel, **999px** (full pill, không phụ thuộc chiều cao nút) cho Button.
    - Shadow: Hard offset shadow `0px 5px 0px`, màu shadow là **bản tối hơn của chính màu component** (xem token ở mục 2) — không dùng đen/xám trung tính, để giữ đúng hiệu ứng nhựa đồ chơi nhiều màu.

## 2. Color Palette (Semantic)
| Token | Hex | Dùng cho |
|---|---|---|
| Base (Background) | `#F1F2F6` | Xám nhựa sạch |
| Primary (Seeker/Action) | `#FF4757` | Đỏ san hô |
| Primary Shadow | `#C23548` | Shadow cho component Primary |
| Accent (Hider/Success) | `#2ED573` | Xanh lá Emerald |
| Accent Shadow | `#23A057` | Shadow cho component Accent |
| Surface | `#FFFFFF` | Trắng tinh khiết cho Card/Panel |
| Surface Shadow | `#D8DAE0` | Shadow cho Panel/Card trắng |
| Text | `#2F3542` | Xám tối |
| Text on Primary/Accent | `#FFFFFF` | Chữ trên nút Primary/Accent |

**Accessibility — quan trọng:** Primary (đỏ) và Accent (xanh lá) là cặp màu khó phân biệt nhất với người mù màu đỏ-xanh (~8% nam giới) — và vì cơ chế lõi của Seeker là "phát hiện bất thường về màu", người chơi colorblind sẽ bị thiệt thòi kép cả ở UI và gameplay. Quy định: **mọi nơi dùng màu để phân biệt phe** (HUD, scoreboard, danh sách người chơi, ranh giới team) **phải đi kèm icon/shape riêng**, không chỉ dựa vào màu:
- Seeker: icon crosshair/kính lúp.
- Hider: icon lá cây/dấu chân.

## 3. Typography
- **Headers:** `Quicksand`, sans-serif (Font bo tròn, 700-800 weight).
- **Body:** `Montserrat`, sans-serif (400-500 weight).

## 4. UI Components (Mockup Logic)

### Action Buttons
- Hiệu ứng `active:translate-y-[2px]` và `active:shadow-none` để mô phỏng việc nhấn nút nhựa.
- Chữ trên nút Primary/Accent: trắng (`#FFFFFF`), trên nút Surface: xám tối (`#2F3542`).

### HUD
- Thanh hiển thị số đạn (Ammo) và thời gian còn lại, thiết kế tối giản, nằm ở các góc màn hình.

### Color Picker (mới)
- **Cursor:** vòng tròn viền trắng 2px theo con trỏ, fill = màu đang hover trên bề mặt môi trường (preview trước khi chọn).
- **Swatch hiện tại:** hình tròn cố định ở góc dưới-trái màn hình, viền Accent khi đã hút màu thành công, kèm icon eyedropper nhỏ.
- **Nút "Áp dụng":** pill button style Accent, chỉ active khi đã có màu được hút.

### Pose Selector (mới)
- Dãy nút icon hình tròn nằm ngang ở đáy màn hình (Idle / Crouch / Lean / Lay down...).
- Pose đang chọn: viền Accent 3px, hơi nhô lên (trạng thái ngược với "pressed").

### Victory / Defeat Overlay (mới)
- Card Surface bo góc 20px, căn giữa màn hình.
- Overlay nền mờ tint theo phe thắng: tint Primary nếu Seeker thắng, tint Accent nếu Hider thắng.
- Headline dùng `Quicksand` 800 weight.

### Accessibility
- Giữ trạng thái focus rõ ràng cho mọi control điều khiển bằng bàn phím (menu settings, lobby).
- Tôn trọng `prefers-reduced-motion` — tắt hiệu ứng pop/elastic nếu người dùng yêu cầu giảm hiệu ứng động.
