# Manga & Image Translator - Chrome Extension

Tiện ích mở rộng Chrome (Manifest V3) giúp dịch chữ trực tiếp trên hình ảnh sử dụng trí tuệ nhân tạo **Gemini AI** từ Google AI Studio. Tiện ích được tối ưu hóa đặc biệt để nhận diện bố cục (OCR), dịch thuật và vẽ đè bản dịch lên các trang truyện tranh (Manga/Comic).

---

## ✨ Tính Năng Nổi Bật

* **Dịch ảnh linh hoạt**: Di chuột qua ảnh và nhấp vào nút hover **"Dịch AI"** ở góc ảnh, hoặc nhấp chuột phải và chọn **"Dịch ảnh này bằng AI (Gemini)"**.
* **Dịch hàng loạt (Batch Mode)**: Kích hoạt chế độ chọn nhiều ảnh để dịch đồng loạt cả chương truyện chỉ với một lần bấm chuột.
* **Tùy chỉnh Font chữ Thời gian thực**: 
  * Điều chỉnh cỡ chữ (phóng to/thu nhỏ từ `0.6x` đến `1.8x`) và thay đổi kiểu chữ (Font Family) tùy thích ngay trên giao diện cài đặt.
  * Các thay đổi được **áp dụng ngay lập tức** lên toàn bộ ảnh đã dịch trên trang web mà không cần dịch lại.
* **Tự động vừa khít bong bóng**: Thuật toán mô phỏng thông minh tự động giảm kích thước chữ để vừa vặn hoàn hảo bên trong bong bóng thoại, chống tràn chữ.
* **Xem chữ gốc nhanh**: Chỉ cần di chuột vào bong bóng dịch, nó sẽ tự động mờ đi để bạn đọc chữ gốc bên dưới ảnh.
* **Giao diện hiện đại (Dark Mode)**: Popup thiết lập thiết kế theo phong cách Glassmorphism huyền ảo, gọn gàng và dễ sử dụng.

---

## 🛠️ Hướng Dẫn Cài Đặt

1. Tải toàn bộ mã nguồn của dự án này về máy tính của bạn.
2. Mở trình duyệt Google Chrome và truy cập đường dẫn: `chrome://extensions/`
3. Kích hoạt tùy chọn **Developer mode (Chế độ nhà phát triển)** ở góc trên cùng bên phải.
4. Bấm nút **Load unpacked (Tải tiện ích đã giải nén)** ở góc trên cùng bên trái.
5. Chọn thư mục chứa mã nguồn của tiện ích này (`d:\Andrew\Manga-translator`).

---

## ⚙️ Hướng Dẫn Cấu Hình

### Bước 1: Lấy Gemini API Key miễn phí
* Truy cập trang [Google AI Studio](https://aistudio.google.com/) và đăng nhập bằng tài khoản Google.
* Nhấp vào nút **Create API Key** và tạo một mã khóa API mới.

### Bước 2: Nhập cấu hình vào tiện ích
* Nhấp vào biểu tượng Extension của bạn trên thanh công cụ Chrome (biểu tượng hình bong bóng thoại neon).
* Dán **API Key** của bạn vào ô nhập.
* Chọn mô hình khuyên dùng: **Gemini 3.1 Flash Lite (500 lượt/ngày 🔥)** để thoải mái dịch truyện mà không lo giới hạn 20 lượt/ngày của các model Flash khác.
* Bấm **Lưu Cài Đặt**.

> 💡 **Mẹo nhỏ nếu gặp lỗi "User location is not supported"**:
> Hãy bật các ứng dụng VPN hoặc **Cloudflare WARP 1.1.1.1** để chuyển vùng IP sang các khu vực được hỗ trợ đầy đủ như Singapore, Nhật Bản hoặc Hoa Kỳ.

---

## 🔒 Bảo Mật Thông Tin

Do đây là ứng dụng chạy hoàn toàn dưới Client-side (ở trình duyệt của người dùng), mã khóa API **Gemini API Key** của bạn sẽ được lưu trữ cục bộ và bảo mật tuyệt đối bên trong thiết bị của bạn thông qua API `chrome.storage.local`. Không có bất kỳ máy chủ bên thứ ba nào thu thập khóa của bạn.
