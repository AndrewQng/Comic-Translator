# Bối Cảnh Dự Án (CONTEXT) - Manga & Image Translator

Tài liệu này tóm tắt toàn bộ bối cảnh phát triển, cấu trúc thư mục, các công nghệ sử dụng và tính năng đã triển khai của dự án tiện ích mở rộng Chrome **Manga & Image Translator**.

---

## 1. Tổng Quan Dự Án
* **Tên dự án**: Manga & Image Translator
* **Mục tiêu**: Tạo ra một Chrome Extension giúp dịch chữ trực tiếp trên hình ảnh (đặc biệt tối ưu cho bong bóng thoại truyện tranh - manga) bằng trí tuệ nhân tạo Gemini AI, sau đó vẽ lớp phủ (overlay) bong bóng thoại mới đè khít lên vị trí chữ gốc để người đọc dễ dàng theo dõi.
* **Ngôn ngữ đích mặc định**: Tiếng Việt (Vietnamese) cùng khả năng tùy biến đa ngôn ngữ khác.

---

## 2. Cấu Trúc Dự Án
```text
Manga-translator/
├── .gitignore                   # Loại bỏ tệp tin rác và tệp .env khỏi Git
├── manifest.json                # Tệp cấu hình Extension (Manifest V3)
├── background.js                # Background Service Worker quản lý API call & tải dữ liệu ảnh
├── content.js                   # Script chèn vào trang xử lý vẽ giao diện và tính toán cỡ chữ
├── content.css                  # Định dạng CSS cho bong bóng thoại dịch và loading toast
├── icon.png                     # Logo chính thức của Extension (482 KB)
├── CONTEXT.md                   # Tài liệu bối cảnh phát triển dự án (Tệp này)
├── README.md                    # Hướng dẫn cài đặt và trải nghiệm nhanh
└── popup/                       # Thư mục giao diện cấu hình của Extension
    ├── popup.html               # Giao diện cài đặt Dark Mode (Glassmorphism)
    ├── popup.css                # Style cho giao diện cấu hình và thanh trượt font chữ
    └── popup.js                 # Logic lưu cài đặt và đồng bộ font chữ thời gian thực
```

---

## 3. Công Nghệ & APIs Sử Dụng
1. **Core**: HTML5, CSS3, JavaScript (ES6+).
2. **Chrome Extension APIs (Manifest V3)**:
   * `storage`: Lưu trữ khóa API, ngôn ngữ đích, mô hình được chọn và tùy chỉnh font chữ.
   * `contextMenus`: Tạo tùy chọn dịch ảnh trên menu chuột phải.
   * `activeTab` & `scripting`: Tương tác an toàn với tab trình duyệt đang hoạt động.
3. **Mô hình Trí tuệ Nhân tạo (Gemini API)**:
   * Kết nối đến Google AI Studio thông qua cổng HTTP REST `/v1beta/models/...:generateContent` bằng phương pháp truyền payload ảnh dạng Base64 và System Prompt tùy biến để trả về tọa độ hộp chữ và bản dịch tương ứng dưới định dạng JSON sạch.

---

## 4. Các Tính Năng Đã Triển Khai
* **Nhận diện và dịch ảnh đơn lẻ**:
  * Nhấp chuột phải vào ảnh bất kỳ chọn **"Dịch ảnh này bằng AI (Gemini)"**.
  * Hoặc di chuột qua ảnh và nhấp vào nút hover **"Dịch AI"** xuất hiện ở góc trên bên phải của ảnh.
* **Dịch hàng loạt (Batch Translation)**:
  * Cho phép người dùng nhấp chọn nhiều trang truyện cùng lúc trên màn hình, sau đó bấm nút dịch để dịch toàn bộ trong hàng đợi tuần tự để tránh bị quá tải API.
* **Tùy chỉnh Font chữ Thời gian thực (Real-time Font Styling)**:
  * Người dùng có thể điều chỉnh **Cỡ chữ** (Tỉ lệ co giãn từ `0.6x` đến `1.8x`) và **Kiểu chữ** (như *Manga Comic*, *Segoe UI*, *Outfit*, *Arial*,...) trực tiếp trong Popup.
  * Mọi thay đổi về font chữ sẽ **đồng bộ và áp dụng ngay lập tức** lên các bong bóng thoại đang hiển thị trên trang web mà không cần dịch lại ảnh.
* **Tự động co giãn chữ (Font Autofit)**:
  * Tự động điều chỉnh kích thước chữ (từ lớn xuống nhỏ dần) dựa trên diện tích hộp thoại và độ dài văn bản để đảm bảo không bị tràn chữ ngoài bong bóng.
* **Ẩn chữ gốc thông minh**:
  * Khi di chuột vào bong bóng dịch, nó sẽ mờ đi `92%` (opacity: `0.08`) để người dùng đọc lại chữ gốc bên dưới ảnh một cách nhanh chóng.
* **Tích hợp các Mô hình Gemini mới nhất**:
  * Hỗ trợ đầy đủ các dòng model hiện đại: **Gemini 3.5 Flash**, **Gemini 3 Flash**, **Gemini 2.5 Flash**, **Gemini 3.1 Flash Lite**, v.v.
  * Đặc biệt khuyến nghị **Gemini 3.1 Flash Lite** nhờ hạn mức miễn phí lên tới **500 lượt dịch/ngày** (thay thế dòng Gemini 1.5 cũ đã bị Google khai tử).

---

## 5. Cơ Chế Bảo Mật & Lưu Trữ
* **Bảo mật API Key**: Tiện ích mở rộng chạy hoàn toàn ở phía client (Client-side). Không có API Key hoặc thông tin bảo mật nào được lưu cứng trong mã nguồn.
* **Lưu trữ**: API Key được lưu cục bộ trên thiết bị của người dùng thông qua `chrome.storage.local`. Điều này đảm bảo an toàn tuyệt đối, khóa API không bị rò rỉ lên máy chủ bên thứ ba và không cần tệp `.env` ở môi trường sản phẩm.
