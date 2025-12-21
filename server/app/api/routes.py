from flask import Blueprint, request, jsonify
from app.services.algorithm import generate_level
from app.services.validator import validate_level
from app.services.difficulty_calculator import calculate
import json

api_bp = Blueprint('api', __name__)

# Route lấy danh sách hình dạng
@api_bp.route('/shapes', methods=['GET'])
def get_shapes():
    # Deprecated: New logic uses custom_grid
    return jsonify({"shapes": ["CUSTOM_GRID"]})

# Route xử lý việc tạo level
@api_bp.route('/generate', methods=['POST'])
def generate():
    try:
        # 1. Lấy tham số form-data
        arrow_count = int(request.form.get('arrow_count', 50))
        
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
        colors_str = request.form.get('colors', '[]')
        try:
            color_list = json.loads(colors_str)
        except:
            color_list = ['#000000']
        
        obstacles_str = request.form.get('obstacles', '[]')
        try:
            obstacles_list = json.loads(obstacles_str)
        except:
            obstacles_list = []
            
        strategy = request.form.get('strategy', 'SMART_DYNAMIC')
            
        custom_grid_str = request.form.get('custom_grid')
        custom_grid = None
        if custom_grid_str:
            try:
                custom_grid = json.loads(custom_grid_str)
            except:
                print("Error parsing custom_grid")
        
        # Validation
        if max_arrow_length < min_arrow_length: max_arrow_length = min_arrow_length
        if max_bends < min_bends: max_bends = min_bends
        
        # Generate Level
        result_data = generate_level(
            arrow_count=arrow_count,
            custom_grid=custom_grid,
            min_arrow_length=min_arrow_length,
            max_arrow_length=max_arrow_length,
            min_bends=min_bends,
            max_bends=max_bends,
            obstacles_input=obstacles_list,
            color_list=color_list,
            strategy_name=strategy
        )
        
        return jsonify(result_data)

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        print(f"LỖI KHI TẠO LEVEL: {e}")
        return jsonify({"error": f"Lỗi server khi tạo level: {e}"}), 500

@api_bp.route('/validate', methods=['POST'])
def validate():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        rows = data.get('rows')
        cols = data.get('cols')
        snakes = data.get('snakes', [])
        obstacles = data.get('obstacles', []) # List of obstacle dicts

        # Convert obstacles list to map expected by validator
        # Frontend sends: [{row, col, type, ...}, ...]
        # Validator expects: {(r,c): data}
        obstacles_map = {}
        for obs in obstacles:
            # Handle obstacles that might span multiple cells (walls)
            cells = obs.get('cells', [])
            if cells:
                for cell in cells:
                    obstacles_map[(cell['row'], cell['col'])] = obs
            else:
                obstacles_map[(obs['row'], obs['col'])] = obs

        # Prepare snakes in format [{'path': [...]}]
        # Frontend sends: [{path: [{row, col}, ...]}, ...]
        formatted_snakes = []
        for s in snakes:
            path = [(p['row'], p['col']) for p in s.get('path', [])]
            if path:
                formatted_snakes.append({'path': path})

        result = validate_level(formatted_snakes, obstacles_map, rows, cols)
        return jsonify(result)

    except Exception as e:
        print(f"VALIDATION ERROR: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/calculate-difficulty', methods=['POST'])
def calculate_difficulty_route():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        rows = data.get('rows')
        cols = data.get('cols')
        snakes = data.get('snakes', []) # Expects format with 'path'
        obstacles = data.get('obstacles', []) # List of dicts

        # Map snake input format if needed (Frontend sends [{path: ...}])
        # Calculator expects standard structure.
        
        # NOTE: Frontend currently sends `path` as `[{row, col}, ...]`.
        # Calculator uses this directly.

        result = calculate(snakes, obstacles, rows, cols)
        return jsonify(result)

    except Exception as e:
        print(f"DIFFICULTY CALCULATION ERROR: {e}")
        return jsonify({"error": str(e)}), 500
