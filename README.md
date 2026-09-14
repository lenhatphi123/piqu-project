# Product Inventory UI

Ứng dụng web SPA (React 19 + TypeScript + Vite 7 + Tailwind CSS 4) quản lý **hồ sơ
kho hàng**: danh sách sản phẩm, tìm kiếm, thêm / sửa / xóa, tải ảnh sản phẩm,
giá VND và USD.

Dữ liệu được lưu trên **Firebase** (Firestore cho metadata sản phẩm, Firebase
Storage cho ảnh). Server Express (`server/index.ts`) cung cấp API CRUD
(`/api/products`) đọc/ghi Firestore qua Firebase Admin SDK, và phục vụ file
tĩnh của client khi chạy production.

> Tính năng quét / nhận dạng sản phẩm bằng hình ảnh đã được loại bỏ. App mở ra là
> vào thẳng màn hình kho hàng.

---

## 1. Yêu cầu môi trường

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | >= 20 (khuyến nghị 22 LTS) | Đã kiểm thử trên v22.16.0 |
| pnpm | 10.4.1 | Bắt buộc dùng pnpm — dự án có `pnpm-lock.yaml` và một patch trong `patches/` |

Kiểm tra:

```bash
node -v
pnpm -v
```

Nếu chưa có pnpm, cài bằng Corepack (đi kèm Node):

```bash
corepack enable
corepack prepare pnpm@10.4.1 --activate
```

---

## 2. Cài đặt

```bash
pnpm install
```

> **Quan trọng — bước bắt buộc trên máy mới.**
> pnpm 10 chặn script cài đặt của dependency theo mặc định, nên bạn sẽ thấy
> cảnh báo `Ignored build scripts: @tailwindcss/oxide, esbuild`. Đây là hai gói
> binary native mà Vite và lệnh build cần. Chạy thêm:
>
> ```bash
> pnpm rebuild @tailwindcss/oxide esbuild
> ```
>
> (hoặc `pnpm approve-builds` rồi chọn cả hai). Bỏ qua bước này thì `pnpm dev`
> và `pnpm build` sẽ lỗi thiếu binary.

---

## 3. Chạy ở chế độ development

```bash
pnpm dev
```

Mở http://localhost:3000/

- `pnpm dev` chạy **đồng thời 2 tiến trình** (qua `concurrently`):
  - `web` — Vite dev server, cổng mặc định **3000** (tự nhảy cổng kế tiếp nếu bận).
  - `api` — Express API server (`server/index.ts` qua `tsx watch`), cổng **3002**.
    Vite tự proxy mọi request `/api/*` sang server này (xem `vite.config.ts`).
- Có sẵn hot reload (HMR) cho client; API server tự restart khi sửa code nhờ
  `tsx watch`.
- Cờ `--host` đã bật sẵn nên máy khác trong cùng mạng LAN cũng truy cập được
  qua địa chỉ `Network` mà terminal in ra.
- Chỉ muốn chạy riêng API: `pnpm dev:api`.

---

## 4. Build và chạy production

```bash
pnpm build   # build client -> dist/public, bundle server -> dist/index.js
pnpm start   # chạy server Express phục vụ dist/public
```

Mở http://localhost:3000/ (đổi cổng bằng biến môi trường `PORT`).

Xem thử bản build bằng Vite preview (không cần server Express):

```bash
pnpm preview
```

---

## 5. Các lệnh khác

| Lệnh | Tác dụng |
|---|---|
| `pnpm dev` | Chạy dev server kèm HMR (Vite cổng 3000 + API cổng 3002) |
| `pnpm dev:api` | Chỉ chạy API server (`tsx watch`), không chạy Vite |
| `pnpm build` | Build production ra thư mục `dist/` |
| `pnpm start` | Chạy server production từ `dist/` (SPA + API cùng cổng) |
| `pnpm preview` | Xem thử bản build bằng Vite |
| `pnpm check` | Kiểm tra kiểu TypeScript (`tsc --noEmit`) |
| `pnpm format` | Format toàn bộ code bằng Prettier |

---

## 6. Ảnh sản phẩm

Trong form **Thêm / Chỉnh sửa sản phẩm** có ô **Ảnh đại diện**:

- Bấm **Chọn ảnh** để mở hộp thoại chọn tệp, hoặc **kéo thả** ảnh thẳng vào ô đó.
- Định dạng nhận: JPG, PNG, WEBP, GIF, AVIF · dung lượng tối đa **2MB**.
- Sai định dạng hoặc quá nặng sẽ hiện thông báo lỗi ngay tại ô ảnh.
- Sau khi chọn có nút **Đổi ảnh** và **Xóa ảnh**. Sản phẩm chưa có ảnh sẽ hiện ô
  giữ chỗ kẻ sọc thay vì ảnh vỡ.

Ảnh được đọc bằng `FileReader` thành data URL (base64) ở client rồi gửi kèm
trong payload JSON lên API (`POST`/`PUT` `/api/products`) như cũ. Ở phía
server, `server/db.ts` phát hiện `image` là data URL thì **tự động upload lên
Firebase Storage** và chỉ lưu **URL công khai** của ảnh vào Firestore (không
lưu base64 trực tiếp — Firestore giới hạn 1MB/document). Khi sửa ảnh hoặc xóa
sản phẩm, ảnh cũ trên Storage cũng được dọn theo.

---

## 7. Dữ liệu (Firebase: Firestore + Storage)

Toàn bộ sản phẩm được lưu trên **Firestore** (collection `products`), ảnh lưu
trên **Firebase Storage** (`server/firebase.ts`, `server/db.ts`). Server dùng
**Firebase Admin SDK** để đọc/ghi — không còn phụ thuộc file JSON hay
filesystem cục bộ, nên **chạy tốt trên Vercel** (trước đây filesystem `/tmp`
trên Vercel không bền vững giữa các lần cold start, dữ liệu hay bị mất).

- **API CRUD** (`server/routes.ts` + `server/db.ts`):

  | Method | Endpoint | Tác dụng |
  |---|---|---|
  | `GET` | `/api/products` | Lấy danh sách toàn bộ sản phẩm |
  | `GET` | `/api/products/:id` | Lấy 1 sản phẩm |
  | `POST` | `/api/products` | Tạo sản phẩm mới |
  | `PUT` | `/api/products/:id` | Cập nhật sản phẩm |
  | `DELETE` | `/api/products/:id` | Xóa sản phẩm |

- Mỗi sản phẩm có cấu trúc:

  ```ts
  type Product = {
    id: string;
    name: string;
    code: string;          // Mã sản phẩm (NO)
    image: string;         // URL ảnh trên Firebase Storage, rỗng nếu chưa có ảnh
    priceVnd: string;      // Giá bán
    originalPrice: string; // Giá mua (giá gốc nhập vào)
    category: string;      // Một trong PRODUCT_CATEGORIES (shared/const.ts)
    size: string;
    updated: string;       // ISO datetime, tự cập nhật mỗi lần sửa
    createdAt: string;     // ISO datetime
  };
  ```

- **Loại sản phẩm** là danh mục cố định khai báo tại `shared/const.ts`
  (`PRODUCT_CATEGORIES`): Áo, Quần, Váy, Bikini, Nón, Trang sức. Server từ chối
  giá trị lạ và tự đặt về loại đầu tiên (Áo) nếu payload gửi lên không khớp.

- **`id` của sản phẩm** giờ là document ID do Firestore tự sinh (chuỗi ngẫu
  nhiên), không còn dạng `p-xxxxx` như bản JSON cũ.
- **Sao lưu / khôi phục**: dùng công cụ export/import của Firestore (Firebase
  Console > Firestore > ⋮ > Export/Import, hoặc `gcloud firestore export`),
  hoặc bật Point-in-time recovery trong Firebase Console.
- Đây là nguồn dữ liệu **duy nhất** của ứng dụng. Sửa dữ liệu qua UI (thêm/sửa/
  xóa sản phẩm) hoặc trực tiếp trong Firebase Console (Firestore Data tab).

---

## 8. Biến môi trường

**App chạy được UI ngay mà không cần `.env`, nhưng API sản phẩm (`/api/products`)
bắt buộc phải cấu hình Firebase** — không có nó thì mọi request tới
`/api/products` sẽ trả lỗi 500.

```bash
cp .env.example .env
```

| Biến | Dùng cho | Thiếu thì sao |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Toàn bộ credential Firebase Admin dán 1 dòng JSON (khuyên dùng khi deploy Vercel) | — |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Cách 2, tách 3 trường từ file service account (tiện khi chạy local) | — |
| `FIREBASE_STORAGE_BUCKET` | Tên bucket Firebase Storage lưu ảnh sản phẩm | Mặc định `<project_id>.appspot.com` |
| `VITE_FRONTEND_FORGE_API_KEY` / `VITE_FRONTEND_FORGE_API_URL` | Google Maps trong `client/src/components/Map.tsx` | Bản đồ không tải; phần còn lại vẫn chạy |
| `VITE_OAUTH_PORTAL_URL` / `VITE_APP_ID` | Tạo URL đăng nhập OAuth (`client/src/const.ts`) | Link đăng nhập không hợp lệ |
| `VITE_ANALYTICS_ENDPOINT` / `VITE_ANALYTICS_WEBSITE_ID` | Script Umami trong `client/index.html` | Lúc build có cảnh báo `is not defined in env variables` — vô hại |
| `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` | Storage proxy `/manus-storage` (chỉ dev server) | Route đó trả về lỗi 500 |
| `PORT` | Cổng của server production, và cổng API khi chạy `pnpm dev:api` riêng | Mặc định 3000 (production) / 3002 (dev API) |

Chỉ biến có tiền tố `VITE_` mới lộ ra phía client. Sửa `.env` xong phải khởi
động lại dev server (`FIREBASE_*` chỉ cần đặt 1 trong 2 cách ở trên, không cần
cả hai).

### Cách lấy Firebase Service Account key (bắt buộc)

1. Vào [Firebase Console](https://console.firebase.google.com/) → chọn project
   của bạn (project ID xem trong Project Settings, ví dụ trong ảnh cấu hình
   web bạn có là `piqu-32b4d`).
2. Vào **⚙️ Project Settings** → tab **Service accounts**.
3. Bấm **Generate new private key** → xác nhận → một file `.json` sẽ được tải
   về máy (dạng tên `<project-id>-firebase-adminsdk-xxxxx.json`).
4. **Không commit file này lên git** (đã thêm vào `.gitignore`). Có 2 cách
   dùng nó:
   - **Cách A (khuyên dùng, đặc biệt khi deploy Vercel)**: mở file `.json`,
     copy toàn bộ nội dung, dán thành **1 dòng duy nhất** vào biến
     `FIREBASE_SERVICE_ACCOUNT` trong `.env` (hoặc trong Vercel > Project >
     Settings > Environment Variables).
   - **Cách B (local cho dễ đọc)**: mở file `.json`, copy 3 giá trị
     `project_id`, `client_email`, `private_key` vào 3 biến tương ứng
     `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
     Giữ nguyên các ký tự `\n` bên trong `private_key`.
5. Vào **Firebase Console → Storage** → bấm **Get started** nếu chưa bật
   Storage cho project (chọn chế độ production, chọn region gần bạn). Lấy tên
   bucket hiển thị (dạng `<project-id>.appspot.com` hoặc
   `<project-id>.firebasestorage.app`) điền vào `FIREBASE_STORAGE_BUCKET` nếu
   khác mặc định.
6. Vào **Firebase Console → Firestore Database** → bấm **Create database**
   nếu chưa có (chọn chế độ **Production**, chọn region). Không cần tạo sẵn
   collection `products` — server sẽ tự tạo khi có sản phẩm đầu tiên.

> Lưu ý: config trong ảnh bạn gửi (`apiKey`, `authDomain`, `appId`...) là
> **Firebase Web SDK config** — dùng khi gọi Firebase thẳng từ trình duyệt.
> Vì app này gọi Firebase từ server (Express), ta dùng **Admin SDK** với
> service account key ở trên thay vì config đó.

---

## 9. Cấu trúc thư mục

```
client/                  Ứng dụng React (đây là Vite root)
  index.html             Trang HTML gốc
  src/
    main.tsx             Điểm khởi động
    App.tsx              Router (wouter) + Theme + ErrorBoundary
    pages/               Home.tsx (màn kho hàng), NotFound.tsx
                         inventory-enhancements.css
    components/          ErrorBoundary.tsx, Map.tsx*, ManusDialog.tsx*
    components/ui/       Bộ component shadcn/ui (Radix)
    contexts/  hooks/
    lib/                 utils.ts, api.ts (client gọi API CRUD)
    index.css            Theme Tailwind 4 + biến màu
  public/                File tĩnh
server/
  index.ts               Express: mount API + phục vụ file tĩnh (production)
  routes.ts              Route CRUD /api/products
  firebase.ts            Khởi tạo Firebase Admin SDK (Firestore + Storage)
  db.ts                  Đọc/ghi Firestore, upload/xóa ảnh trên Storage
shared/const.ts          Hằng số dùng chung client + server
dist/                    Kết quả build (không commit)
patches/                 Patch cho wouter@3.7.1 (pnpm tự áp dụng)
vite.config.ts           Cấu hình Vite, alias, plugin, proxy /api
```

Alias import (khai báo trong `vite.config.ts` và `tsconfig.json`):

| Alias | Trỏ tới |
|---|---|
| `@/` | `client/src/` |
| `@shared/` | `shared/` |
| `@assets/` | `attached_assets/` |

---

## 10. Xử lý sự cố

**`Cannot find module '@tailwindcss/oxide-...'` hoặc lỗi esbuild khi chạy**
Chưa chạy bước rebuild ở mục 2:
```bash
pnpm rebuild @tailwindcss/oxide esbuild
```

**`'NODE_ENV' is not recognized as an internal or external command` (Windows)**
Lỗi này xảy ra với script `start` kiểu Unix. Dự án đã sửa bằng `cross-env`, nên
chỉ cần cài lại dependency (`pnpm install`) là hết.

**`EADDRINUSE: address already in use :::3000`**
Cổng 3000 đang bị chiếm. Dùng cổng khác hoặc tắt tiến trình cũ:
```bash
pnpm dev --port 5173              # dev
PORT=4000 pnpm start              # production (macOS/Linux)
$env:PORT=4000; pnpm start        # production (PowerShell)
```

**Cảnh báo `%VITE_ANALYTICS_ENDPOINT% is not defined` lúc build**
Vô hại — chỉ do chưa cấu hình analytics. Bỏ qua hoặc điền biến trong `.env`.

**Bản đồ không hiển thị**
Thiếu `VITE_FRONTEND_FORGE_API_KEY`. Xem mục 8. Lưu ý `Map.tsx` và `ManusDialog.tsx`
(đánh dấu `*` ở trên) hiện **không được import ở đâu** — giữ lại để dùng sau.

**`EADDRINUSE: address already in use :::3002` khi chạy `pnpm dev`**
Cổng API (mặc định 3002) đang bị chiếm — thường do lần chạy `pnpm dev` trước
chưa tắt hẳn tiến trình `tsx watch`. Tắt tiến trình đang giữ cổng rồi chạy lại,
hoặc đổi cổng: `API_PORT=3010 PORT=3010 pnpm dev` (nhớ sửa cả `dev:api` và
biến `API_PORT` mà Vite proxy dùng cho khớp).

**Gọi `/api/products` báo lỗi 404 hoặc không có dữ liệu**
Kiểm tra tiến trình `api` trong log `pnpm dev` có khởi động thành công không
(nó in ra `Server running on http://localhost:3002/`). Nếu chỉ chạy `vite`
riêng (không qua `pnpm dev`) thì sẽ không có backend để proxy tới.

**Gọi `/api/products` báo lỗi 500 "Lỗi máy chủ"**
Xem log server trong terminal — nếu thấy `Thiếu cấu hình Firebase`, nghĩa là
chưa đặt `FIREBASE_SERVICE_ACCOUNT` (hoặc bộ 3 biến `FIREBASE_PROJECT_ID` /
`FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`) trong `.env`. Xem mục 8.

**Lỗi `Could not load the default credentials` hoặc `invalid_grant`**
`FIREBASE_PRIVATE_KEY` bị sai định dạng — thường do dán thiếu `\n` hoặc thiếu
dấu ngoặc kép khi copy từ file JSON. Dùng cách A (`FIREBASE_SERVICE_ACCOUNT`
dán nguyên file JSON 1 dòng) để tránh lỗi này.

**Upload ảnh báo lỗi quyền (403) hoặc ảnh không hiển thị**
Kiểm tra đã bật **Firebase Storage** cho project chưa (Firebase Console >
Storage > Get started), và `FIREBASE_STORAGE_BUCKET` (nếu có đặt) khớp đúng
tên bucket hiển thị trong Console.

**Cài đặt lỗi lung tung**
Cài lại từ đầu:
```bash
rm -rf node_modules
pnpm install
pnpm rebuild @tailwindcss/oxide esbuild
```

---

## 11. Trạng thái đã kiểm thử

Trên Windows 10 / Node v22.16.0 / pnpm 10.4.1:

- `pnpm install` + `pnpm rebuild` — OK
- `pnpm check` — không có lỗi TypeScript
- Server khởi động và trả lỗi 500 gọn gàng (không crash tiến trình) khi thiếu
  cấu hình Firebase — đã kiểm thử bằng cách gọi `/api/products` mà không đặt
  biến môi trường `FIREBASE_*`
- **Chưa kiểm thử với credential Firebase thật** (Firestore/Storage) — cần bạn
  điền `.env` theo mục 8 rồi tự kiểm thử luồng thêm/sửa/xóa sản phẩm kèm ảnh
