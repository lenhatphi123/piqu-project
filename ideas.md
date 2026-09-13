# Định hướng thiết kế: Product Scan UI

## Ba phương án phong cách

| Theme Name | Very Brief Intro | Probability |
| --- | --- | --- |
| Receipt Atelier | Không gian quản lý sản phẩm lấy cảm hứng từ hoá đơn và nhãn kho hàng, tinh gọn nhưng có cảm giác vật liệu thật. | 0.07 |
| Scan Studio | Giao diện nhận dạng sản phẩm như một studio nhiếp ảnh nhỏ: nền mực than, bề mặt giấy ấm và điểm nhấn vàng cam. | 0.04 |
| Market Ledger | Sổ dữ liệu thương mại đương đại với các mô-đun rõ ràng, màu xanh bảo chứng và nhịp điệu kiểu biên nhận. | 0.09 |

## Phương án được chọn: Scan Studio

### Design Movement

**Editorial utility** kết hợp tinh thần của studio chụp sản phẩm và giao diện công cụ nghiệp vụ cao cấp. Thay vì một dashboard vô danh, không gian này gợi hình ảnh của bàn làm việc kiểm định sản phẩm — tĩnh, chính xác, sẵn sàng hành động.

### Core Principles

1. **Chụp ảnh là trọng tâm:** hành động scan luôn chiếm vị trí rõ nhất; các dữ liệu hỗ trợ được xếp lớp xung quanh.
2. **Thông tin có bằng chứng:** giá trị và trạng thái nhận dạng được trình bày như thẻ kiểm định, với nhãn, phân cấp và khoảng thở rõ ràng.
3. **Tương phản vật liệu:** bề mặt mực than mang tính công cụ, giấy ngà tạo vùng đọc dễ chịu, màu cam đất chỉ dùng cho thao tác quan trọng.
4. **Nhịp điệu biên tập:** cột không đối xứng, đường kẻ mảnh, khoảng trắng lớn và chữ serif tạo cảm giác biên soạn có chủ đích.

### Color Philosophy

Nền **mực than** tạo độ tập trung cho vùng camera; các khối **giấy ngà** làm nơi đọc dữ liệu lâu mà không lạnh như trắng tinh. **Cam gốm** là màu thương hiệu duy nhất cho tín hiệu đang hoạt động, nút chụp và điểm cần quyết định. **Xanh rêu** được giữ cho trạng thái tin cậy/đã xác nhận, gợi độ chắc chắn thay vì cảm giác cảnh báo.

### Layout Paradigm

Trên desktop, app là một **bàn làm việc theo dải dọc**: rail thương hiệu mảnh bên trái, vùng thao tác linh hoạt ở giữa, cột ngữ cảnh/dữ liệu ở phải. Trên mobile, các vùng này chuyển thành thanh trên, không gian scan toàn màn hình và thanh điều hướng đáy. Tránh bố cục trung tâm đồng nhất; từng màn hình phải có một trọng tâm hành động riêng.

### Signature Elements

1. **Khung ngắm góc mở** giống dấu định vị trong máy ảnh, lặp lại ở camera và thumbnail sản phẩm.
2. **Dòng kiểm định mảnh** với các chấm trạng thái và mã nhận dạng ở đầu thẻ dữ liệu.
3. **Con dấu Scan Studio** dạng biểu tượng bốn góc ngắm, xuất hiện ở logo, favicon và biểu thị trạng thái quét.

### Interaction Philosophy

Mọi thao tác đều có phản hồi trực quan ngắn, rõ: scan phát sáng nhẹ trong khung ngắm; dữ liệu được xác nhận bằng dấu check; thao tác xoá phải qua hộp xác nhận. Mọi màn hình con đều có lối quay lại hiển nhiên.

### Animation

Các phần tử xuất hiện theo cascade 40–70ms bằng opacity và dịch chuyển 8px. Nút chụp nén còn 97% khi nhấn; vòng scan chuyển động tuần hoàn chậm trong lúc nhận dạng. Modal chỉnh sửa và xác nhận vào bằng opacity + scale 0.97 trong tối đa 220ms, dùng `cubic-bezier(0.23, 1, 0.32, 1)`. Tôn trọng `prefers-reduced-motion`.

### Typography System

**DM Sans** dùng cho thao tác, dữ liệu và nhãn để tối ưu khả năng đọc; **DM Serif Display** dùng cho tên sản phẩm, tiêu đề trang và giá bằng chữ để tạo nhịp biên tập. Tiêu đề có tracking hơi chặt; metadata sử dụng chữ hoa, cỡ nhỏ và tracking rộng. Không dùng Inter.

### Brand Essence

**Scan Studio biến một lần chụp sản phẩm thành hồ sơ giá rõ ràng, dành cho người cần kiểm chứng và quản lý hàng hoá nhanh hơn.**

Tính cách thương hiệu: **chính xác, điềm tĩnh, có chất liệu**.

### Brand Voice

Giọng văn ngắn, dứt khoát, dựa trên bằng chứng; tránh lời chào chung chung. CTA nói rõ hành động và kết quả.

> “Đưa sản phẩm vào khung ngắm.”

> “Đã tìm thấy một hồ sơ phù hợp.”

### Wordmark & Logo

Logo là biểu tượng bốn góc khung ngắm gãy khúc, ôm một chấm tròn cam ở tâm — gợi việc khóa nét và xác thực. Wordmark “Scan Studio” dùng sans đậm, chữ `a` mở, không sử dụng phông mặc định.

### Signature Brand Color

**Cam Gốm — `#E85D35`**: một sắc cam đất giàu vật liệu, được dành cho các thời điểm hành động và kết quả có giá trị.

## Style Decisions

- Con dấu bốn góc và wordmark **Scan Studio** là mỏ neo nhận diện trên mọi màn hình chính; không hạ thành một dòng nhãn phụ.
- Ngôn ngữ giao diện ưu tiên tiếng Việt ngắn, có tính vận hành và dựa trên bằng chứng; tiếng Anh chỉ dùng cho mã hoặc đơn vị không thể thay thế.
- Mỗi hàng trong kho sản phẩm phải mang ngôn ngữ “sổ hồ sơ từ ảnh quét”: thumbnail có góc định vị, mã hồ sơ, dấu đã đối chiếu và nhịp đường kiểm định mảnh.
