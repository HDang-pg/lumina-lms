# Lumina LMS — compact LMS for Teacher / Student

Một LMS full-stack thu gọn dùng **Next.js App Router + PostgreSQL + Prisma + JWT/Bcrypt**. Next.js được dùng cho UI và server routes; PostgreSQL phù hợp với mô hình quan hệ của khóa học, đề thi, attempt và gradebook. Kiến trúc auth dùng cookie JWT HttpOnly + route middleware; server kiểm tra quyền trước khi trả dữ liệu nhạy cảm.

## Tính năng đã có

### Học sinh
- Đăng nhập JWT, vùng dashboard riêng.
- Có thể xem/ẩn mật khẩu khi đăng nhập; không hiển thị tài khoản demo trên màn hình đăng nhập.
- Chỉ thấy khóa học và bài kiểm tra mà giáo viên đã cấp quyền.
- Có chat với giáo viên và trung tâm thông báo.
- Khóa học, bài học, video embed hoặc video local qua endpoint bảo vệ.
- Tải tài liệu đính kèm khi đã ghi danh.
- Đánh dấu hoàn thành bài học, theo dõi tiến độ.
- Hỏi đáp dưới bài học.
- Bài kiểm tra có giờ mở/đóng, đồng hồ đếm ngược, auto-submit khi hết thời gian.
- Trộn thứ tự câu hỏi và đáp án theo `variantSeed` riêng cho attempt.
- Tự động chấm trắc nghiệm; tự luận chuyển sang hàng chờ giáo viên chấm.
- Sổ điểm và bảng tiến độ / streak / huy hiệu.

### Giáo viên
- Dashboard quản lý.
- Tạo tài khoản học sinh; chỉnh tên, nickname, tuổi, lớp, email, mật khẩu và cấp/thu hồi quyền xem khóa học.
- Tự chỉnh hồ sơ giáo viên (avatar, tên, nickname, thông tin và mật khẩu).
- Chat trực tiếp giáo viên ↔ học sinh trong phạm vi lớp học được cấp quyền.
- Trung tâm thông báo với trạng thái đã đọc/chưa đọc.
- Tạo khóa học, thêm bài học embed hoặc upload video local.
- Bật/tắt tải video theo bài; bật chính sách tải cho toàn khóa ở lúc tạo.
- Upload PDF/tài liệu đính kèm.
- Ngân hàng câu hỏi theo chuyên đề + 4 mức độ: Nhận biết / Thông hiểu / Vận dụng / Vận dụng cao.
- Tạo đề, đặt mở/đóng, thời lượng, trọng số, trộn mã đề.
- Chấm tự luận theo từng câu và ghi phản hồi.
- Thống kê số học sinh, lượt nộp, điểm trung bình, tiến độ.

## Tài khoản demo
- Giáo viên: `teacher@lumina.local` / `Demo@12345`
- Học sinh: `student@lumina.local` / `Demo@12345`

## Chạy local

Cần Node 22+ và PostgreSQL. Sao chép `.env.example` thành `.env`.

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Mở `http://localhost:3000`.

Hoặc dùng Docker Compose:

```bash
docker compose up --build
```


## Truy cập bằng điện thoại trong cùng Wi-Fi

Docker Compose đã bind cổng web ra toàn bộ card mạng và Next.js chạy ở `0.0.0.0:3000`. Trên Windows, lấy IPv4 của máy bằng `ipconfig`, ví dụ `192.168.1.10`, rồi trên điện thoại cùng Wi-Fi mở `http://192.168.1.10:3000`.

Nếu Windows Firewall chặn kết nối, mở PowerShell với quyền Administrator và chạy:

```powershell
New-NetFirewallRule -DisplayName "Lumina LMS 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

Không dùng `localhost:3000` trên điện thoại vì `localhost` trên điện thoại trỏ về chính điện thoại.

## Triển khai 100+ học sinh đồng thời

MVP hiện tại dùng PostgreSQL với index cho các truy vấn thường xuyên (`teacherId`, `courseId`, `studentId`, `examId`, thời gian mở/đóng). Video local có HTTP Range để tua/stream theo chunk thay vì nạp toàn file vào RAM.

Để production cho 100+ người thi cùng lúc, nên:

1. Dùng PostgreSQL managed (Neon/Supabase/RDS/Cloud SQL) và connection pooling.
2. Đưa video/PDF sang object storage + CDN (Cloudflare R2/S3/MinIO), không lưu file local trên instance web.
3. Đặt reverse proxy/WAF + rate limit cho login và API nộp bài.
4. Dùng Redis cho cache/session rate-limit nếu traffic tăng cao.
5. Với video nhiều độ phân giải, dùng FFmpeg/transcoding pipeline tạo HLS/DASH + CDN. Bản MVP này bảo vệ URL video local bằng endpoint server; quality adaptive nhiều bitrate cần triển khai media pipeline riêng. Video embed từ YouTube/provider có thể tự cung cấp lựa chọn chất lượng theo provider.
6. Chạy ít nhất 2 web instances sau load balancer và để DB / object storage bên ngoài instance.

## Bảo mật đã cài

- Password hash bằng Bcrypt.
- JWT nằm trong cookie `HttpOnly`, `SameSite=Lax`, `Secure` ở production.
- Middleware chặn `/teacher`, `/student`, `/dashboard` và API theo role.
- API tiếp tục kiểm tra quyền ở server, không tin route/UI phía client.
- CSRF double-submit token cho các request ghi dữ liệu như nộp bài, chấm điểm, tạo nội dung; login dùng cookie SameSite và không thực hiện side-effect ngoài tạo session.
- React mặc định escape HTML; input server-side validate bằng Zod.
- Đề thi chưa mở không trả question/options xuống browser.
- Nộp bài tự chấm lại bằng đáp án trong DB ở server.
- Header `nosniff`, `Referrer-Policy`, `X-Frame-Options`.

## Cấu trúc chính

```text
src/app/                         UI + Route Handlers
src/components/                  UI components
src/lib/auth.ts                  JWT session
src/lib/guards.ts                server-side role guards
src/middleware.ts                route protection
prisma/schema.prisma             DB model + indexes
prisma/seed.ts                   demo data
storage/                         local development storage
```

## Lưu ý production

`STORAGE_LOCAL=1` chỉ phù hợp demo/dev. Trên host dạng serverless hoặc nhiều instance, filesystem local không phải storage bền vững. Chuyển `api/upload` và các endpoint media sang S3/R2 presigned upload/download trước khi phát hành thực tế.

## Cập nhật Lumina LMS v4

Sau khi thay source code, giữ nguyên các Docker volume hiện tại. Chỉ cần đồng bộ schema và chạy bộ sửa dữ liệu tương thích:

```powershell
docker compose build
docker compose up -d
docker compose exec web npx prisma db push
docker compose exec web npm run db:repair
```

`db:repair` không reset tài khoản hay xóa database. Nó chỉ bổ sung các kiểu câu hỏi demo mới nếu còn thiếu, gỡ video Rickroll khỏi bài demo, cập nhật môn của đề cũ đang để trống và liên kết hai câu demo mới vào bài kiểm tra mẫu.

