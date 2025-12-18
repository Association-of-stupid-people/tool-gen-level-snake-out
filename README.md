# 🐍 Arrow Level Generator - Snake Game

Web tool để tự động generate level cho game Snake. Được thiết kế cho Game Designer có thể dễ dàng tạo và export level configuration.

## ✨ Tính năng

### 🎲 Generate Level (Tự động)
- **Generate tự động**: Tạo level với số lượng arrow (snake) tùy chỉnh
- **Hình dạng đa dạng**: Trái tim ❤️, Mặt cười 😀, Kim cương ⭐, Hình chữ nhật 📦
- **Upload ảnh**: Sử dụng ảnh của bạn làm hình dạng level
- **Tùy chỉnh độ khó**:
  - Độ dài arrow (Min/Max)
  - Số lần gấp khúc (Min/Max bends)
- **Chướng ngại vật**:
  - 🧱 Wall (với counter)
  - 🕳️ Hole (lỗ thoát)
  - 🌀 Tunnel (cổng dịch chuyển)
- **Export CSV**: Tải về file CSV với format chuẩn

### ✏️ Custom Level (Vẽ tay)
- **Vẽ snake**: Kéo chuột để vẽ đường đi của snake
- **Thêm obstacles**: Wall, Hole, Tunnel
- **Keyboard shortcuts**: S (Snake), W (Wall), H (Hole), T (Tunnel)
- **Load generated level**: Import level từ tab Generate để chỉnh sửa
- **Export CSV**: Tải về level đã vẽ

## 🚀 Deploy lên Vercel

### Prerequisites
- Tài khoản GitHub
- Tài khoản Vercel (miễn phí tại [vercel.com](https://vercel.com))
- Git đã được cài đặt

### Bước 1: Push code lên GitHub

```bash
# Nếu chưa có remote repository
git remote add origin https://github.com/your-username/your-repo-name.git

# Commit tất cả các thay đổi
git add .
git commit -m "Prepare for Vercel deployment"

# Push lên GitHub
git push -u origin main
```

### Bước 2: Deploy trên Vercel

1. Truy cập [vercel.com](https://vercel.com) và đăng nhập
2. Click **"Add New..."** → **"Project"**
3. Import repository từ GitHub:
   - Chọn repository của bạn
   - Click **"Import"**
4. Configure Project:
   - **Framework Preset**: Other
   - **Build Command**: (để trống)
   - **Output Directory**: (để trống)
   - **Install Command**: `pip install -r requirements.txt`
5. Click **"Deploy"**

### Bước 3: Hoàn tất

- Vercel sẽ build và deploy tự động (mất ~1-2 phút)
- Bạn sẽ nhận được URL production: `https://your-project-name.vercel.app`
- Mỗi lần push code mới lên GitHub, Vercel sẽ tự động deploy lại

## 💻 Development Local

### Cài đặt

```bash
# Clone repository
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name

# Tạo virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt
```

### Chạy local

```bash
python app.py
```

Mở browser tại: `http://localhost:5000`

## 📋 CSV Format

File CSV export có 7 cột:

| Column | Description |
|--------|-------------|
| Level | Level number (để trống) |
| LevelType | Loại level (để trống) |
| LevelTimer | Thời gian limit (để trống) |
| ItemType | `snake`, `wall`, `hole`, `tunnel` |
| Position | JSON array của coordinates `[{"x": 0, "y": 0}, ...]` |
| ItemValueConfig | Counter value (cho wall) |
| DifficultyScore | Điểm độ khó (để trống) |

### Ví dụ:

```csv
Level,LevelType,LevelTimer,ItemType,Position,ItemValueConfig,DifficultyScore
,,,snake,"[{""x"":0,""y"":5},{""x"":0,""y"":4}]",0,
,,,wall,"[{""x"":2,""y"":3}]",3,
,,,hole,"[{""x"":-1,""y"":2}]",0,
,,,tunnel,"[{""x"":3,""y"":1},{""x"":-3,""y"":-1}]",0,
```

## 🎮 Coordinate System

- **Origin (0, 0)**: Center của grid
- **X-axis**: Âm ← → Dương
- **Y-axis**: Âm ↓ ↑ Dương
- **Snake position[0]**: Đầu snake (arrow head)
- **Snake position[n-1]**: Đuôi snake

## ⚠️ Vercel Limitations

- **Timeout**: 10 giây cho mỗi request (Free tier)
- **File upload**: Tối đa 4.5MB
- **Bandwidth**: Giới hạn theo plan
- Nếu generate level phức tạp timeout, thử giảm số lượng arrow hoặc kích thước grid

## 🛠️ Tech Stack

- **Backend**: Flask 3.1.2 (Python)
- **Image Processing**: Pillow 12.0.0
- **Frontend**: Vanilla JavaScript, HTML5 Canvas
- **Deployment**: Vercel Serverless Functions

## 📝 License

MIT License - Free to use and modify

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

Nếu có vấn đề hoặc câu hỏi, vui lòng tạo Issue trên GitHub.

---

Made with ❤️ for Game Designers

