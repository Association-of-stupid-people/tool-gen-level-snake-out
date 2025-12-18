from flask import Flask, render_template, request, send_file, jsonify
from generator import generate_level_image, get_available_shapes
import io
# import base64 (Không cần thiết ở đây vì generator đã xử lý Base64)

app = Flask(__name__)

# Route hiển thị trang chính với form nhập liệu
@app.route('/', methods=['GET'])
def index():
    shapes = get_available_shapes()
    return render_template('index.html', shapes=shapes)

# Route xử lý việc tạo level
@app.route('/generate', methods=['POST'])
def generate():
    uploaded_image_bytes = None
    
    try:
        # 1. Lấy tham số bắt buộc
        arrow_count = int(request.form.get('arrow_count', 50))
        shape_input = request.form.get('shape_input', None)

        def safe_int(form_key, default_value):
            """Hàm trợ giúp để lấy giá trị int an toàn từ form"""
            val = request.form.get(form_key)
            try:
                return int(val) if val is not None and val != '' else default_value
            except ValueError:
                return default_value
        
        min_arrow_length = safe_int('min_arrow_length', 2)
        max_arrow_length = safe_int('max_arrow_length', 10)
        
        min_bends = safe_int('min_bends', 0)
        max_bends = safe_int('max_bends', 5)
        
        # Parse wall counters from JSON string
        import json
        wall_counters_str = request.form.get('wall_counters', '[]')
        try:
            wall_counters = json.loads(wall_counters_str)
        except:
            wall_counters = []
        
        # Parse colors from JSON string
        colors_str = request.form.get('colors', '["#000000"]')
        try:
            color_list = json.loads(colors_str)
        except:
            color_list = ['#000000']
        
        hole_count = safe_int('hole_count', 0)
        tunnel_count = safe_int('tunnel_count', 0)
        
        # Đảm bảo Max >= Min
        if max_arrow_length < min_arrow_length: max_arrow_length = min_arrow_length
        if max_bends < min_bends: max_bends = min_bends
        
        # 3. Xử lý file upload
        if 'image_file' in request.files:
            file = request.files['image_file']
            if file.filename != '':
                file.seek(0, io.SEEK_END)
                file_size = file.tell()
                file.seek(0)
                # Vercel has a 4.5MB limit for serverless functions
                if file_size > 4.5 * 1024 * 1024: 
                    raise ValueError("Kích thước file quá lớn (tối đa 4.5MB).")
                uploaded_image_bytes = file.read() 
        
        # 4. Gọi hàm tạo level
        result_data = generate_level_image(
            arrow_count=arrow_count,
            shape_input=shape_input,
            uploaded_image_bytes=uploaded_image_bytes,
            min_arrow_length=min_arrow_length,
            max_arrow_length=max_arrow_length,
            min_bends=min_bends,
            max_bends=max_bends,
            wall_counters=wall_counters,
            hole_count=hole_count,
            tunnel_count=tunnel_count,
            color_list=color_list
        )
        
        # Trả về JSON chứa ảnh Base64 và số lượng đếm
        return jsonify(result_data)

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        print(f"LỖI KHI TẠO LEVEL: {e}")
        return jsonify({"error": f"Lỗi server khi tạo level: {e}"}), 500

# For Vercel serverless deployment
# The app instance is automatically used by Vercel
# Local development: run with `python app.py`
if __name__ == '__main__':
    app.run(debug=True)