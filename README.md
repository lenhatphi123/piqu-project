# Product Inventory UI

Ứng dụng web SPA (React 19 + TypeScript + Vite 7 + Tailwind CSS 4) quản lý **hồ sơ
kho hàng**: danh sách sản phẩm, tìm kiếm, thêm / sửa / xóa, tải ảnh sản phẩm,
giá VND và USD.

Dữ liệu được lưu trong **file JSON** (`data/products.json`) đóng vai trò database.
Server Express (`server/index.ts`) cung cấp API CRUD (`/api/products`) đọc/ghi
file này, và phục vụ file tĩnh của client khi chạy production.

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

Ảnh được đọc bằng `FileReader` thành data URL (base64) rồi gửi kèm trong payload
JSON lên API (`POST`/`PUT` `/api/products`) và được lưu thẳng trong
`data/products.json` — **không mất khi tải lại trang**.

---

## 7. Dữ liệu (database dạng file JSON)

Toàn bộ sản phẩm được lưu tại **`data/products.json`**. File này đóng vai trò
database: server đọc/ghi trực tiếp vào đây cho mọi thao tác CRUD, không có
SQL/NoSQL nào khác.

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
    image: string;         // data URL base64, rỗng nếu chưa có ảnh
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

- Ghi file được xếp hàng tuần tự (trong `server/db.ts`) để tránh hai request ghi
  đè lên nhau, và ghi qua file `.tmp` rồi `rename` để tránh hỏng file khi ghi
  dở dang.
- **Sao lưu / khôi phục**: vì là 1 file JSON, chỉ cần copy `data/products.json`
  ra nơi khác là backup xong; muốn khôi phục thì copy đè lại.
- Đây là nguồn dữ liệu **duy nhất** của ứng dụng — không còn phụ thuộc file
  Excel hay công cụ import nào khác. Sửa dữ liệu qua UI (thêm/sửa/xóa sản
  phẩm) hoặc chỉnh trực tiếp file này khi server không chạy.

---

## 8. Biến môi trường

**App chạy được ngay mà không cần file `.env`.** Chỉ tạo `.env` khi bạn cần các
tính năng phụ thuộc dịch vụ ngoài:

```bash
cp .env.example .env
```

| Biến | Dùng cho | Thiếu thì sao |
|---|---|---|
| `VITE_FRONTEND_FORGE_API_KEY` / `VITE_FRONTEND_FORGE_API_URL` | Google Maps trong `client/src/components/Map.tsx` | Bản đồ không tải; phần còn lại vẫn chạy |
| `VITE_OAUTH_PORTAL_URL` / `VITE_APP_ID` | Tạo URL đăng nhập OAuth (`client/src/const.ts`) | Link đăng nhập không hợp lệ |
| `VITE_ANALYTICS_ENDPOINT` / `VITE_ANALYTICS_WEBSITE_ID` | Script Umami trong `client/index.html` | Lúc build có cảnh báo `is not defined in env variables` — vô hại |
| `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` | Storage proxy `/manus-storage` (chỉ dev server) | Route đó trả về lỗi 500 |
| `PORT` | Cổng của server production, và cổng API khi chạy `pnpm dev:api` riêng | Mặc định 3000 (production) / 3002 (dev API) |

Chỉ biến có tiền tố `VITE_` mới lộ ra phía client. Sửa `.env` xong phải khởi
động lại dev server.

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
  db.ts                  Đọc/ghi data/products.json
data/products.json        "Database" — toàn bộ dữ liệu sản phẩm (JSON)
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
- `pnpm dev` — cả `web` (Vite, HTTP 200) và `api` (Express, cổng 3002) chạy
  đồng thời; `GET/POST/PUT/DELETE /api/products` qua proxy Vite hoạt động đúng
- `pnpm build` — build thành công ra `dist/`
- `pnpm start` — server production chạy, phục vụ cả SPA (HTTP 200) và API
  (`GET /api/products` trả đúng dữ liệu) trên cùng 1 cổng
