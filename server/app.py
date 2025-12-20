from flask import Flask, request, jsonify
from flask_cors import CORS
from generator import generate_level_image, get_available_shapes
import io
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Route lấy danh sách hình dạng
@app.route('/api/shapes', methods=['GET'])
def get_shapes():
    shapes = get_available_shapes()
    return jsonify({"shapes": shapes})

# Route xử lý việc tạo level
@app.route('/api/generate', methods=['POST'])
def generate():
    uploaded_image_bytes = None
    
    try:
        # 1. Lấy tham số form-data
        arrow_count = int(request.form.get('arrow_count', 50))
        shape_input = request.form.get('shape_input', None)

        def safe_int(form_key, default_value):
            val = request.form.get(form_key)
            try:
                return int(val) if val is not None and val != '' else default_value
            except ValueError:
                return default_value
        
        min_arrow_length = safe_int('min_arrow_length', 2)
        max_arrow_length = safe_int('max_arrow_length', 10)
        
        min_bends = safe_int('min_bends', 0)
        max_bends = safe_int('max_bends', 5)
        
        # Parse JSON fields
        wall_counters_str = request.form.get('wall_counters', '[]')
        try:
            wall_counters = json.loads(wall_counters_str)
        except:
            wall_counters = []
        
        try:
            color_list = json.loads(colors_str)
        except:
            color_list = ['#000000']
        
        obstacles_str = request.form.get('obstacles', '[]')
        try:
            obstacles_list = json.loads(obstacles_str)
        except:
            obstacles_list = []
        
        # Validation
        if max_arrow_length < min_arrow_length: max_arrow_length = min_arrow_length
        if max_bends < min_bends: max_bends = min_bends
        
        # Handle file upload
        if 'image_file' in request.files:
            file = request.files['image_file']
            if file.filename != '':
                file.seek(0, io.SEEK_END)
                file_size = file.tell()
                file.seek(0)
                if file_size > 4.5 * 1024 * 1024: 
                    raise ValueError("Kích thước file quá lớn (tối đa 4.5MB).")
                uploaded_image_bytes = file.read() 
        
        # Generate Level
        result_data = generate_level_image(
            arrow_count=arrow_count,
            shape_input=shape_input,
            uploaded_image_bytes=uploaded_image_bytes,
            min_arrow_length=min_arrow_length,
            max_arrow_length=max_arrow_length,
            min_bends=min_bends,
            max_bends=max_bends,
            obstacles_input=obstacles_list,
            color_list=color_list
        )
        
        return jsonify(result_data)

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        print(f"LỖI KHI TẠO LEVEL: {e}")
        return jsonify({"error": f"Lỗi server khi tạo level: {e}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)