# Lộ trình dự án: Snake Level Generator 🐍

Lộ trình này phác thảo kế hoạch phát triển cho công cụ Snake Level Generator, được chia thành 5 giai đoạn. Giai đoạn 1 & 2 tập trung vào khả năng chỉnh sửa và tạo level cơ bản. Giai đoạn 3 tập trung vào refactor logic server để đảm bảo tạo level thông minh. Giai đoạn 4 & 5 giới thiệu các tính năng nâng cao và tích hợp hệ sinh thái.

## Giai đoạn 1: Trình chỉnh sửa vùng thông minh (Panel 1) ✅

**Trọng tâm:** Xây dựng Grid Editor để xác định khu vực chơi.

- **Hệ thống lưới**: Lưới tương tác nơi người dùng có thể vẽ/xóa ô.
- **Import ảnh & Trace tự động**: Tải lên ảnh mask và tự động chuyển đổi thành ô lưới.
- **Công cụ vẽ**: Bút, Hình chữ nhật, Xóa.
- **Layer**: Lớp ảnh nền tham chiếu vs Lớp Grid dữ liệu.

## Giai đoạn 2: Tạo & Logic nâng cao (Panel 2) ✅

**Trọng tâm:** Tạo tham số với các yếu tố gameplay phức tạp và validate dữ liệu.

- **Tham số tạo**: Số lượng mũi tên, Độ dài (Min-Max), Góc cua (Min-Max).
- **Hệ thống chướng ngại vật**: Tường, Tường phá, Hố, Rắn đóng băng, Rắn ổ khóa.
- **Cấu hình cảnh**: Bảng màu rắn, Màu nền, Kích thước lưới.
- **Validation**: Xem lại dữ liệu sau khi tạo (Review Mode).

## Giai đoạn 3: Refactor Server & Logic Tạo Thông Minh (Hiện tại) 🚧

**Trọng tâm:** Viết lại Backend để đảm bảo thuật toán tạo level lấp đầy lưới thông minh và chính xác.

- **Input JSON Grid**: Server nhận trực tiếp cấu trúc lưới (True/False) từ Client thay vì chỉ dùng Shape định sẵn.
- **Thuật toán Lấp đầy (Full Coverage)**:
  - Đảm bảo rắn được tạo ra sẽ lấp kín toàn bộ các ô được đánh dấu `True` trên lưới.
  - Tôn trọng các giới hạn: Số lượng rắn, Độ dài Min/Max, Số góc cua.
- **Xử lý Chướng ngại vật**:
  - Nhận danh sách chướng ngại vật từ Client (đã đặt trước) và trừ các ô này ra khỏi không gian trống trước khi tạo rắn.
- **Hệ thống Log & Warning Thông minh**:
  - Nếu không thể lấp đầy (do không đủ không gian, không thỏa mãn ràng buộc độ dài...), Server sẽ trả về danh sách cảnh báo chi tiết (vd: "Còn 5 ô trống chưa được lấp").
  - Trả về file JSON ngay lập tức để Client hiển thị lại kết quả (kể cả khi chưa hoàn hảo).
- **Refactor Codebase**:
  - Loại bỏ logic thừa (Emoji shape cũ không cần thiết).
  - Tối ưu hóa cấu trúc JSON trả về chuẩn Game Engine.

## Giai đoạn 3.5: 11 Thuật toán Phân Phối Nâng Cao (Mới) 🚧

**Trọng tâm:** Cung cấp nhiều chiến thuật lấp đầy lưới (Fill Strategies) để Designer kiểm soát được "cảm giác" của màn chơi.

1.  **SMART_DYNAMIC** (Hiện tại): Cân bằng động, tối ưu độ phủ.
2.  **RANDOM_ADAPTIVE**: Ngẫu nhiên nhưng tự thích nghi với không gian.
3.  **MAX_CLUMP / MIN_FRAGMENT**: Chiến thuật tham lam (Greedy) ưu tiên vùng lớn hoặc vùng nhỏ.
4.  **BALANCED_AVG**: Chia đều độ dài một cách toán học.
5.  **DIRECTIONAL SCAN**: Quét ngang (Horizontal) hoặc dọc (Vertical) để tạo luồng đọc map.
6.  **GEOMETRIC**: Ưu tiên Viền (Perimeter), Tâm (Center) hoặc Đối xứng (Symmetrical).
7.  **COMPACT_CLUSTER**: Lấp đầy theo cụm (Cluster) để tránh lỗ hổng nhỏ.

**Mục tiêu chất lượng:**

- Coverage > 90% cho các thuật toán Fill.
- Hạn chế tối đa "ô chết" (1-2 ô rời rạc không thể đi vào).

## Giai đoạn 4: Trải nghiệm Nhà phát triển & Tiện ích (Sắp tới) 🔮

**Trọng tâm:** Làm cho công cụ nhanh hơn và an toàn hơn để thử nghiệm.

- **Chế độ Mô phỏng (Simulation Mode)**:
  - Tích hợp Mini Snake Engine ngay trên trình duyệt (Canvas/React).
  - Nút "Play" để điều khiển rắn chạy thử theo path đã sinh.
  - Kiểm tra va chạm và tính hợp lệ thực tế (Visual Debugging).
- **Hệ thống Undo/Redo (Command Pattern)**:
  - Hoàn tác các thao tác vẽ tường/xóa ô trên Grid.
  - Hoàn tác các lần sinh level (quay lại kết quả trước đó).
  - Phím tắt Ctrl+Z / Ctrl+Y.
- **Template & Preset**: Lưu cấu hình tạo (vd: "Chế độ khó", "Mê cung dễ").
- **Tạo hàng loạt (Batch Generation)**: Tạo nhiều biến thể cùng lúc.

## Giai đoạn 5: Tích hợp Hệ sinh thái & Cloud (Đề xuất) ☁️

**Trọng tâm:** Mở rộng công cụ cho làm việc nhóm.

- **Xuất trực tiếp Game Engine**: Plugin Unity/Godot.
- **Lưu trữ đám mây & Cộng tác**: Lưu level lên database, chia sẻ URL.
- **Analytics**: Theo dõi chỉ số độ khó.
- **AI Assistant**: Gợi ý đặt chướng ngại vật thông minh.
