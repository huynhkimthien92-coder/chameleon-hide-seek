# Chameleon Hide & Seek (Web 3D)

Game 3D multiplayer trên trình duyệt — Hider dùng màu sắc/tư thế để ẩn mình, Seeker dùng quan sát + đạn giới hạn để tìm.
Tài liệu thiết kế đầy đủ ở [`/docs`](./docs): [vision](./docs/vision.md) · [design system](./docs/design.md) · [tech stack](./docs/stack.md) · [implementation plan](./docs/implementation.md).

## Asset thật (Giai đoạn 0)

✅ **Mannequin — đã ghép vào code, đang dùng thật** (`public/models/mannequin.glb`, 10.5KB sau Draco):
- Nguồn: Meshy AI → 1 trong nhiều kết quả được tách ra, giảm poly (~80k → 2.9k tam giác bằng `gltf-transform simplify`), tách 4 vùng head/torso/arms/legs theo toạ độ không gian (không có rig/UV nên dùng heuristic hình học, không phải Blender).
- Đã chuẩn hoá: cao đúng 1.8 unit, chân tại Y=0 — khớp `CapsuleCollider` trong `Player.tsx`.
- `Mannequin.tsx` giờ load GLTF thật qua `useGLTF` (drei), mỗi player vẫn tạo Material riêng (không dùng chung) để giữ đúng nguyên tắc chống lỗi đổi màu chéo.
- Toàn bộ quy trình xử lý (tách cụm, giảm poly, gán vùng, chuẩn hoá tỉ lệ, nén Draco) làm bằng script Node + `@gltf-transform`, không cần Blender.

⏳ **Map "Art Studio"**: vẫn đang dùng texture canvas tự sinh (Giai đoạn 2), chưa có asset thật. Map KHÔNG bắt buộc cần Blender — chỉ cần ảnh texture thật gửi qua là áp được, không cần model 3D.

✅ **Map variety (code-only, theo `docs/map-variety-notes.md`) — đã làm:**
- Tăng từ 3 → **6 khu màu** (thêm Vải/Canvas, Gạch, Thùng sơn loang).
- Vật cản phá hình khối phẳng (`MapProps.tsx`): chồng thùng gỗ, giá vẽ, chậu cây cao thấp khác nhau — vừa che tầm nhìn vừa làm điểm tựa cho pose "lean"/"crouch".
- Bậc thang + platform nhỏ — thêm độ cao, Seeker phải nhìn lên/xuống.
- Đèn phụ lệch góc tạo vùng sáng/tối khác nhau (chiến thuật ẩn nấp, không cần thêm cơ chế code).
- Verify layout bằng sơ đồ top-down (phát hiện và sửa 1 lỗi vị trí: bậc thang ban đầu đặt đè lên khu Bê tông).

✅ **Texture ảnh thật cho 6/6 khu (Giai đoạn 0) — đã ghép xong:**
- Gỗ, Bê tông, Cây cảnh, Gạch, Vải/Canvas, Thùng sơn loang — tất cả dùng ảnh thật (`public/textures/`). Chỉ còn Sàn vẫn procedural (chưa có ảnh riêng cho sàn).
- 3 ảnh gốc có watermark/icon (gỗ, bê tông, thùng sơn) — đã xử lý bằng cách **cắt bỏ hẳn vùng có watermark/icon** (không che/blur — thử blur trước nhưng bị lộ, xem lịch sử chat), giữ phần ảnh sạch.
- Ảnh thùng sơn loang vốn là ảnh góc xiên (không top-down) — đã crop vùng phẳng nhất, né nền/vật thể xung quanh.
- Pipeline hút màu (`colorSampling.ts`) hỗ trợ cả texture procedural và ảnh thật qua `getSampleableCanvas` (tự vẽ ảnh ra canvas ẩn khi cần) — không cần đổi `useInteraction.ts`.
- Thêm `<Suspense>` bọc scene trong `App.tsx` — bắt buộc cho `useTexture`/`useGLTF`.

## Giai đoạn 5 (Tối ưu) — đang làm

✅ **Tách vendor chunk** (`vite.config.ts`): bundle giờ chia thành `vendor-three` (~122KB), `vendor-network` (~107KB), `vendor-physics` (Rapier WASM, ~3.1MB), code app (~242KB) — thay vì 1 file gộp ~3.6MB.

**Lưu ý quan trọng — đừng hiểu nhầm:** việc này **không giảm tổng dung lượng tải** (vẫn ~1.2MB gzip, vì Rapier WASM tự nó đã to, không nén/cắt bớt được mà vẫn giữ tính năng). Lợi ích thật là **cache tốt hơn**: vendor ít đổi giữa các lần deploy, nên người chơi quay lại không phải tải lại phần đó — chỉ tải lại phần code app (242KB) đổi thường xuyên. Muốn giảm tải ban đầu thật (trì hoãn tải Rapier tới khi vào trận) thì cần thêm màn hình "Loading/Click to Play" + `dynamic import()`, chưa làm vì game hiện vào thẳng map ngay, chưa có lobby screen để trì hoãn.

## Vẽ tự do (UV-paint) — thay cho chia ô đầu/thân/tay/chân

Theo yêu cầu: bỏ hẳn việc chọn 1-trong-4 ô cố định rồi "Áp dụng" — giờ người chơi **tự chọn vị trí bằng cách nhắm trực tiếp lên người mình** (third-person), giữ chuột trái để vẽ liên tục như cọ vẽ thật, nhiều màu khác nhau tại nhiều vị trí tuỳ ý trên cùng 1 phần cơ thể.

**Vì sao trước đây chia ô**: mannequin gốc lúc đó chưa có UV map (chỉ có toạ độ điểm, không có toạ độ texture) — không có cách nào biết "điểm nhắm trúng ứng với pixel nào". Đã giải quyết bằng cách tạo lại UV cho mannequin (xem `docs/asset-brief.md` mục đã cập nhật).

**Đã làm:**
- **Mannequin có UV thật**: spherical projection cho đầu, cylindrical 2-nửa trái/phải cho thân/tay/chân (`split_parts_with_uv.mjs`, script không nằm trong repo — chạy 1 lần để sinh `mannequin.glb`). Verify bằng checker pattern phủ lên hình 3D — mịn (10x10) bị nhiễu nhẹ do mesh gốc có chi tiết nhỏ, nhưng ở độ thô phù hợp việc vẽ (3x3) thì đều đặn, dùng được.
- **Canvas vẽ riêng từng phần/từng player** (`paintRegistry.ts`): mỗi player có 4 canvas (đầu/thân/tay/chân), vẽ chấm màu (`paintDab`) tại đúng toạ độ UV nhắm trúng — sống ngoài React vì network handler cần vẽ lên canvas của BẤT KỲ player nào, không chỉ player đang render.
- **Camera third-person giờ orbit đủ pitch** (lên/xuống) — trước đó khoá cứng nhìn ngực, không thể nhắm lên đầu/xuống chân chính mình. Đây là điều kiện cần phải sửa trước khi làm được tính năng này.
- **Đồng bộ qua stroke, không qua Schema**: mỗi nét vẽ là 1 message `paintStroke` {part, u, v, color, radius}, server validate rồi broadcast cho người khác (trừ người vẽ — họ đã vẽ optimistic cục bộ). Lịch sử nét vẽ lưu plain object phía server (không qua Colyseus Schema vì danh sách có thể dài) — gửi 1 lần cho người mới vào phòng để "đuổi kịp" hiện trạng (catch-up).
- Verify bằng smoke test mở rộng: broadcast đúng người, người vẽ không tự nhận lại nét mình, input rác (toạ độ ngoài [0,1], màu giả, part giả) bị từ chối hoàn toàn (0 broadcast), client mới vào nhận đúng lịch sử — **5/5 PASS** phần này (13/13 cộng dồn cả file).

⚠️ **Hạn chế đã biết**: UV tính bằng công thức xấp xỉ (không phải unwrap thật từ Blender) nên có méo nhẹ ở vài vùng giao nhau (nách, bẹn) — đủ dùng cho việc vẽ chấm màu, nhưng nếu cần chính xác cao hơn thì cần Blender unwrap thật.

## Camera/Mobile/Input — đã sửa & còn cần làm

✅ **Bug "picker không sáng lên" ở third-person** — đã sửa, xem mục bug fix bên dưới (đo khoảng cách từ nhân vật, không phải camera) + đã sửa thêm camera orbit pitch ở trên.

⏳ **Mobile/cảm ứng**: đã xác nhận với người dùng là **mục tiêu cuối có cần** — chưa làm, sẽ làm sau (joystick ảo + vuốt nhìn quanh + nút chạm bắn/vẽ). Ưu tiên vẽ tự do trước theo yêu cầu.

## Bug đã sửa từ test thật trên bản deploy

✅ **"Chuột chỉ xoay tầm nhìn, không dùng để tô được"** — đúng, đây là hạn chế thật của cách điều khiển kiểu FPS (aim = xoay camera), rất khó tinh chỉnh vị trí vẽ chính xác vì mỗi lần chỉnh là cả màn hình xoay theo. Đã sửa bằng **con trỏ vẽ tự do (reticle)**: lúc giữ chuột trái để vẽ, **camera đứng yên hẳn**, chuột di chuyển 1 con trỏ tự do trong khung hình (giống app vẽ thật: Photoshop, MS Paint...) — thả chuột thì quay lại điều khiển camera như cũ. Crosshair hiện di chuyển theo đúng con trỏ này lúc đang vẽ.

✅ **Crosshair không phân biệt "nhắm vào người mình" với "nhắm vào người khác"** — khi có nhiều người chơi đứng gần (đều trắng, chưa sơn gì), không có cách nào biết đang nhắm đúng ai để vẽ. Đã thêm chỉ báo riêng: nhắm đúng người mình hiện icon cọ vẽ + viền màu đang cầm (hoặc viền nét đứt nếu chưa cầm màu), nhắm vào người khác/môi trường thì không hiện. Đây là nghi vấn chính cho việc "giữ chuột vẽ mà không thấy vết sơn" — rất có thể đang nhắm nhầm sang người chơi khác.

✅ **Nhân vật lơ lửng cách sàn ~0.9 unit** (đúng nửa chiều cao) — phát hiện khi tính lại từ tham số `CapsuleCollider` thật: mannequin được đặt ngay tại TÂM capsule thay vì ĐÁY capsule. Vì player khác cũng lơ lửng y vậy nên không lệch tương đối giữa người chơi, dễ bị bỏ sót — nhưng ảnh hưởng tới điểm camera nhắm tới (chỗ "chest lookAt" tính sai vị trí ngực thật), góp phần làm khó nhắm chính xác lên người để vẽ. Đã sửa offset cho cả player local và remote, đồng thời chỉnh lại độ cao camera (lookAt/eye) khớp vị trí mới.

✅ **Sàn không ổn định (player giật/lún/đứng không vững)** — nguyên nhân: sàn dùng collider `trimesh` (lưới tam giác), kiểu này không ổn định khi có vật thể động (player) tiếp xúc liên tục — đã đổi sang box mỏng + `cuboid` (giống mọi khối màu khác trong scene, vốn luôn ổn định).

⚠️ **Chưa leo được bậc thang/vật cản thấp** — KHÔNG phải bug ngẫu nhiên, là hạn chế thật của character controller hiện tại (RigidBody động + velocity đơn giản, chưa có auto-step). Luôn bị chặn như đụng tường ở mọi vật cản có độ cao, mọi lúc. Cách sửa đúng: viết lại bằng `KinematicCharacterController` của Rapier (có `enableAutostep`/`enableSnapToGround` sẵn) — việc lớn hơn, chưa làm, cần xác nhận trước khi viết lại vì rủi ro lỗi tinh tế cao hơn (không test được trực tiếp trên browser thật trong môi trường code hiện tại).

✅ **Picker/ngắm bắn không hoạt động ở third-person** — nguyên nhân: code đo "trong tầm" bằng khoảng cách từ **camera** tới điểm chạm, nhưng Hider mặc định ở third-person (camera lùi sau nhân vật ~5 unit) — nên dù nhân vật đứng sát bề mặt, camera vẫn cách xa hơn tầm cho phép. Đã sửa: đo khoảng cách từ **vị trí nhân vật** (lưu vào store mỗi frame), không phải từ camera. Ảnh hưởng cả picker (Hider) và ngắm bắn (Seeker).

⚠️ **Chưa hỗ trợ điện thoại/cảm ứng** — KHÔNG phải bug, là tính năng chưa làm: toàn bộ input hiện tại (WASD, pointer-lock chuột, mousedown) chỉ hoạt động với bàn phím + chuột thật, chưa có joystick ảo/nút chạm nào. Cần xác nhận có thật cần hỗ trợ mobile không trước khi làm — đây là 1 lớp input mới, không phải chỉnh nhỏ.

## Trạng thái hiện tại

✅ **Giai đoạn 1 (Hạ tầng 3D + Khung Multiplayer) — đã xong & verify:**
- Client Vite + R3F render scene placeholder (sẽ thay bằng asset Blender ở Giai đoạn 0).
- Player di chuyển WASD + nhìn bằng chuột (pointer lock), capsule physics qua Rapier.
- Server Colyseus: room "game", gán team tự động (2 Seeker / 4 Hider theo `vision.md`), đồng bộ vị trí.

✅ **Giai đoạn 2 (Cơ chế Chameleon) — đã xong & verify:**
- Color Picking Pipeline thật: 4 bề mặt môi trường dùng texture sinh bằng canvas (đa dạng màu trong từng khu vực, không phải solid-color), raycast từ crosshair giữa màn hình đọc đúng pixel tại UV (`useColorPicker.ts`).
- Mannequin placeholder 4 phần (đầu/thân/tay/chân, `Mannequin.tsx`) — mỗi phần tô màu độc lập, material không bị dùng chung giữa player (xem comment trong file).
- Pose System: 5 pose (Đứng/Ngồi/Nghiêng/Nằm/Đóng băng) bằng transform hình học placeholder (chưa có animation clip thật — cần GLTF từ Giai đoạn 0).
- Đồng bộ màu + pose qua Colyseus (`paint`/`pose` message), server validate input (chặn part/color không hợp lệ).
- **Đã bỏ tô màu theo team lên mannequin trong thế giới game** (trước đó RemotePlayer tô đỏ/xanh theo team — đã sửa vì lộ ngay ai là Seeker/Hider, phá vỡ camouflage; phân biệt team giờ chỉ nên ở UI/HUD).
- Verify bằng smoke test mở rộng (`client/smoke-test.mjs`): tô màu đúng player không lộ chéo, server từ chối input rác, đồng bộ pose — **4/4 PASS**.

✅ **Giai đoạn 3 (Multiplayer Combat & Match Rules) — đã xong & verify:**
- Lobby tự bắt đầu trận: đầy phòng (6) → start ngay, hoặc sau `LOBBY_GRACE_MS` (mặc định 5s) nếu đã có ≥2 người.
- Súng hitscan: client raycast xác định target, **server validate lại** bằng hình học đơn giản (khoảng cách + góc theo `rotY`, không chạy physics simulation) — xem `isValidShot()` trong `GameRoom.ts`.
- Luật trận đầy đủ: 5 đạn/Seeker không reload (bắn trượt vẫn tốn đạn), đếm ngược 180s, điều kiện thắng/thua, Hider bị loại → Spectate thật (server chặn di chuyển, không chỉ ẩn ở client).
- **Anti-cheat Freeze hoạt động thật**: server từ chối mọi update vị trí khi `pose === "freeze"` (đã test: cố di chuyển lúc freeze bị từ chối hoàn toàn).
- Camera mặc định First person cho Seeker / Third person cho Hider khi server gán team (vẫn cho `V` đổi tay để tiện test — khoá cứng là quyết định của Giai đoạn 4 nếu cần).
- Victory/Defeat overlay theo đúng design.md (tint Primary nếu Seeker thắng, Accent nếu Hider thắng).
- Verify bằng smoke test riêng (`client/smoke-test-stage3.mjs`, 3 client giả lập): gán team, lobby start, freeze chặn di chuyển, bắn trượt/trúng, win condition, từ chối bắn sau khi trận kết thúc — **8/8 PASS**.
- **Bug tự phát hiện & sửa**: server chưa hề nạp file `.env` (chỉ đọc `process.env` trực tiếp) — `cp .env.example .env` trước đó không có tác dụng gì. Đã thêm `dotenv` và verify lại bằng cách set `PORT` thật trong `.env` rồi xác nhận server dùng đúng port đó.

⏳ **Chưa làm** (theo `docs/implementation.md`): asset 3D thật (Giai đoạn 0, cần Blender — ngoài phạm vi code), hosting thật (đã có hướng dẫn đầy đủ ở `docs/deployment-guide.md` — Render cho server, Vercel cho client — nhưng chưa deploy xong thật).

✅ **Giai đoạn 4 (UI & Audio) — đã xong & verify:**
- **Âm thanh**: chưa có asset âm thanh thật nên dùng synth toán học (sine sweep + noise burst, xem `audio/synthesize.ts`) thay cho file thật — giống cách Giai đoạn 2 dùng texture canvas thay GLTF. 8 hiệu ứng: pop khi tô màu, súng (bắn trúng có thêm ding), hết đạn, bị loại, thắng, thua, click UI.
  - Verify riêng phần toán học (không cần browser): không NaN/Infinity, không clip biên độ, header WAV đúng chuẩn — bắt được 1 bug thật (gunshot bị clip do cộng 2 sóng cùng lúc đạt đỉnh) và đã sửa, xem `audio-check.mjs` (script tạm, không nằm trong repo).
- **Icon thay cho chỉ dùng màu** (design.md mục accessibility — quan trọng vì cơ chế chính của game phụ thuộc màu sắc): team badge ở HUD và Victory/Defeat overlay dùng icon Crosshair (Seeker) / Leaf (Hider) đi kèm màu, không chỉ riêng màu. Pose Selector đổi thành nút icon hình tròn đúng spec design.md (trước đó là pill chữ).
- Color Picker swatch có icon eyedropper (Pipette) đúng design.md.
- Tôn trọng `prefers-reduced-motion` (tắt animation/transition nếu hệ điều hành yêu cầu).
- UI rẽ nhánh rõ theo team (đã làm từ Giai đoạn 3, giữ nguyên): Seeker thấy đạn + crosshair đổi màu khi ngắm trúng; Hider thấy Color Picker + Pose Selector.

## Cấu trúc repo

```
chameleon-hide-seek/
├── client/          # Vite + React + R3F + Tailwind v4 + Colyseus client
├── server/          # Colyseus server (TypeScript, ESM)
├── docs/            # 4 file kế hoạch (vision/design/stack/implementation)
```

## Chạy local

**Server** (terminal 1):
```bash
cd server
cp .env.example .env   # chỉnh CLIENT_ORIGIN nếu cần
npm install
npm run dev             # tsx watch — http://localhost:2567
```

**Client** (terminal 2):
```bash
cd client
cp .env.example .env   # VITE_COLYSEUS_URL=ws://localhost:2567
npm install
npm run dev             # http://localhost:5173
```

Mở 2-3 tab trình duyệt để thấy nhiều player đồng bộ với nhau (cần ≥2 người để lobby tự bắt đầu trận sau `LOBBY_GRACE_MS`). Điều khiển:
- Click vào canvas: bắt đầu nhìn bằng chuột (pointer lock).
- `WASD`: di chuyển · `V`: đổi First/Third person.
- **Nếu là Hider**: nhìn vào bề mặt môi trường rồi **click** để hút màu (cầm sẵn) → nhắm vào **đúng vị trí trên người mình** muốn vẽ (third-person, chuột điều khiển cả lên/xuống) → **giữ chuột trái** để vẽ liên tục như cọ thật, tự do chọn vị trí, không bị ép vào 4 ô cố định. Toolbar dưới màn hình còn có dãy nút đổi pose (kể cả "Đóng băng").
- **Nếu là Seeker**: ngắm vào người chơi khác (crosshair chuyển xanh khi ngắm đúng 1 Hider còn sống trong tầm) rồi **click trái** để bắn — 5 viên, không reload.

**Smoke test nhanh (không cần mở browser)** — xác nhận server hoạt động đúng (vị trí, tô màu không lộ chéo, validate input, pose, combat, win condition, anti-cheat freeze):
```bash
cd server && npm run build && LOBBY_GRACE_MS=1000 node build/index.js &   # chạy server (grace thấp để test nhanh)
cd ../client
node smoke-test.mjs          # Giai đoạn 1+2: vị trí, tô màu, pose
node smoke-test-stage3.mjs   # Giai đoạn 3: team, lobby start, súng, win condition, freeze
```

## Deploy

| Phần | Hạ tầng | Ghi chú |
|---|---|---|
| `client/` | **Vercel** | Connect GitHub repo, root directory = `client`, build command mặc định (`npm run build`), set env `VITE_COLYSEUS_URL=wss://<app>.fly.dev` |
| `server/` | **Render (Web Service)** | Connect GitHub repo qua web dashboard, Root Directory=`server`, Build=`npm install && npm run build`, Start=`npm start` — không cần CLI/thẻ. Chi tiết đầy đủ: `docs/deployment-guide.md` |

Chi tiết lý do chọn 2 hạ tầng này và các lưu ý (CORS, WSS, region, tránh mất state room) — xem `docs/stack.md` mục 8.

## Lưu ý kỹ thuật quan trọng (đọc trước khi code tiếp)

- **Schema version**: server dùng `colyseus@0.17` + `@colyseus/schema@4` (API callback mới qua `getStateCallbacks()`, không còn gọi `.onAdd()`/`.onChange()` trực tiếp). Client dùng `@colyseus/sdk` (kế thừa `colyseus.js`, đã ngừng cập nhật ở bản 0.16) — đừng cài nhầm `colyseus.js` cho version server này, 2 package không tương thích wire protocol.
- **Tailwind v4**: không còn `tailwind.config.js` — token màu/radius/shadow khai báo trong `client/src/index.css` qua `@theme`.
- **Audio**: không dùng file asset (`.mp3`/`.wav`) — SFX sinh bằng toán học lúc runtime rồi encode WAV trong bộ nhớ (`audio/synthesize.ts` + `audio/wavEncoder.ts`), nạp vào Howler qua Blob URL. Khi cộng nhiều sóng lại (`mix()`), phải tự canh biên độ từng phần để tổng không vượt [-1,1] — quên việc này sẽ bị clip (đã gặp ở tiếng súng, xem comment trong `synthGunshot()`).
- **Placeholder asset**: mọi mesh màu hiện tại (`ArtStudioScene.tsx`, capsule trắng) là tạm — có comment đánh dấu chỗ cần thay bằng GLTF thật ở Giai đoạn 0.
