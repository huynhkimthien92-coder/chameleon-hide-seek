# Hướng dẫn Deploy — Vercel (client) + Render (server)

> Cả 2 đều làm hoàn toàn qua trình duyệt — không cần máy tính, không cần thẻ, không cần CLI.

## Chuẩn bị (làm 1 lần)

1. Push code lên 1 repo **GitHub** (tải zip mới nhất từ chat, đẩy lên repo của bạn nếu chưa làm).
2. Tài khoản **[Render](https://render.com)** — đăng nhập bằng GitHub cho tiện (đã làm).
3. Tài khoản **[Vercel](https://vercel.com)** — đăng nhập bằng GitHub.

---

## Phần 1 — Deploy server lên Render (Web Service)

Bạn đang ở đúng bước này. Trên màn hình "Create a new Service":

1. Bấm **"New Web Service"** (mục giữa — "Dynamic web app... API servers").
2. Chọn **"Build and deploy from a Git repository"** → chọn repo GitHub của bạn → **Connect**.
3. Điền cấu hình:
   - **Name**: tên bất kỳ, vd `chameleon-hideseek-server`.
   - **Root Directory**: `server` (⚠️ quan trọng — repo có cả `client/` và `server/`, phải chỉ đúng thư mục).
   - **Runtime**: `Node`.
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`.
4. Bấm **"Environment Variables"** (hoặc "Advanced"), thêm:
   - `CLIENT_ORIGIN` = tạm để `*` (sẽ sửa lại đúng URL ở Phần 3, vì chưa có URL Vercel lúc này).
5. Bấm **"Create Web Service"**. Chờ build (~2-5 phút theo log hiện ra trực tiếp trên màn hình).
6. Xong, Render cho ra URL dạng `https://chameleon-hideseek-server.onrender.com`. **Lưu URL này lại.**
7. Kiểm tra: mở `https://chameleon-hideseek-server.onrender.com/health` trên trình duyệt, phải thấy `{"status":"ok"}`.

---

## Phần 2 — Deploy client lên Vercel

1. Vào [vercel.com/new](https://vercel.com/new) → **Import** repo GitHub của bạn.
2. **Root Directory**: bấm "Edit" → chọn `client`.
3. **Environment Variables**, thêm:
   - `VITE_COLYSEUS_URL` = `wss://chameleon-hideseek-server.onrender.com` (đổi `https://` → `wss://`, dùng đúng URL Render ở Phần 1).
4. Bấm **Deploy**. Chờ ~1-2 phút, ra URL dạng `https://your-app.vercel.app`.

---

## Phần 3 — Nối lại CORS (bắt buộc)

Quay lại Render dashboard → app server vừa tạo → tab **"Environment"**:

1. Sửa `CLIENT_ORIGIN` từ `*` thành đúng URL Vercel: `https://your-app.vercel.app` (không có `/` ở cuối).
2. Bấm **Save Changes** — Render tự deploy lại với giá trị mới (vài chục giây).

---

## Phần 4 — Test thật

1. Mở `https://your-app.vercel.app` trên 2-3 tab/máy khác nhau.
2. Click vào canvas từng tab, di chuyển — phải thấy nhau real-time.
3. **Lưu ý tier free của Render**: server tự "ngủ" sau ~15 phút không ai kết nối, và cần ~30-60s để "thức" lại khi có người vào đầu tiên sau đó. Đang có người chơi (giữ kết nối WebSocket) thì server không ngủ giữa trận — chỉ ảnh hưởng lúc thật sự không ai chơi trong thời gian dài.
4. Lỗi thường gặp:
   - `CORS error` ở Console (F12) → `CLIENT_ORIGIN` ở Render chưa đúng URL Vercel, xem lại Phần 3.
   - `WebSocket connection failed` → `VITE_COLYSEUS_URL` ở Vercel phải là `wss://` (không phải `https://`).
   - Trang load lâu lần đầu (~30-60s) → bình thường, server đang "thức" sau khi ngủ — không phải lỗi.

## Sau này code đổi thì sao?

Cả Render và Vercel đều **tự deploy lại mỗi khi bạn push code lên GitHub** (đã connect rồi) — không cần làm gì thêm, chỉ cần đợi vài phút sau khi push.
