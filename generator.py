from PIL import Image, ImageDraw
import random
import io
import math
import base64 

# --- Cấu hình Cố định ---
CELL_SIZE = 25
LINE_WIDTH = 3
ARROW_HEAD_SIZE = 5 
MAX_SIDE = 150 

# --- Hàm trợ giúp cho Hình dạng Biến đổi & Upload ---

def initialize_shape_transforms(ROWS, COLS):
    return {
        'CENTER_R': random.randint(ROWS // 4, ROWS * 3 // 4),
        'CENTER_C': random.randint(COLS // 4, COLS * 3 // 4),
        'RADIUS_R': random.uniform(0.15, 0.45) * ROWS,
        'RADIUS_C': random.uniform(0.15, 0.45) * COLS,
        'RECT_RATIO': random.uniform(0.3, 0.8), 
        'PIXEL_MAP': None 
    }

def process_uploaded_image(image_bytes, target_rows, target_cols):
    img = Image.open(io.BytesIO(image_bytes))
    resized_img = img.resize((target_cols, target_rows), Image.Resampling.LANCZOS)
    img_gray = resized_img.convert("L") 
    THRESHOLD = 200 
    img_binary = img_gray.point(lambda p: 0 if p < THRESHOLD else 255)
    resized_img = img_binary.convert("RGBA") 
    
    pixel_data = []
    for r in range(target_rows):
        row = []
        for c in range(target_cols):
            row.append(resized_img.getpixel((c, r)))
        pixel_data.append(row)
        
    return pixel_data

# --- Các Hàm Định hình (Shape Functions) ---

def get_smile_shape(r, c, ROWS, COLS, TRANSFORMS):
    is_body = (r - ROWS // 2)**2 + (c - COLS // 2)**2 <= (min(ROWS, COLS) * 0.4)**2
    is_eye_l = (r - ROWS * 0.4)**2 + (c - COLS * 0.4)**2 <= (min(ROWS, COLS) * 0.05)**2
    is_eye_r = (r - ROWS * 0.4)**2 + (c - COLS * 0.6)**2 <= (min(ROWS, COLS) * 0.05)**2
    is_mouth = r > ROWS * 0.6 and (c - COLS // 2)**2 <= (ROWS * 0.1)**2
    return is_body and not is_eye_l and not is_eye_r and not is_mouth

def get_heart_shape(r, c, ROWS, COLS, TRANSFORMS):
    x = (c - COLS // 2) / (COLS * 0.4)
    y = (r - ROWS * 0.6) / (ROWS * 0.4) 
    return (x**2 + y**2 - 1)**3 - x**2 * y**3 <= 0.005 

def get_diamond_shape(r, c, ROWS, COLS, TRANSFORMS):
    cr, cc = TRANSFORMS['CENTER_R'], TRANSFORMS['CENTER_C']
    rr, rc = TRANSFORMS['RADIUS_R'], TRANSFORMS['RADIUS_C']
    return abs(r - cr) / rr + abs(c - cc) / rc <= 1

def get_rectangle_shape(r, c, ROWS, COLS, TRANSFORMS):
    cr, cc = TRANSFORMS['CENTER_R'], TRANSFORMS['CENTER_C']
    rr = TRANSFORMS['RADIUS_R'] * TRANSFORMS['RECT_RATIO']
    rc = TRANSFORMS['RADIUS_C'] / TRANSFORMS['RECT_RATIO']
    return abs(r - cr) <= rr and abs(c - cc) <= rc

def get_uploaded_image_shape(r, c, ROWS, COLS, TRANSFORMS):
    pixel_map = TRANSFORMS.get('PIXEL_MAP')
    if not pixel_map or r >= ROWS or c >= COLS:
        return False
    try:
        pixel_value = pixel_map[r][c] 
        is_background_white = (pixel_value[0] == 255 and pixel_value[1] == 255 and pixel_value[2] == 255)
        return not is_background_white 
    except Exception:
        return False

# --- Thư viện Hình dạng & Ánh xạ ---
EMOJI_SHAPE_FUNCTIONS = {
    "SMILE_FACE": get_smile_shape, "HEART": get_heart_shape,
    "DIAMOND_SHAPE": get_diamond_shape, "RECTANGLE_SHAPE": get_rectangle_shape,
    "UPLOADED_IMAGE": get_uploaded_image_shape,
}
EMOJI_MAPPING = {
    "🍎": "DIAMOND_SHAPE", "🍏": "DIAMOND_SHAPE", "⭐": "DIAMOND_SHAPE",
    "❤️": "HEART", "😀": "SMILE_FACE", "📦": "RECTANGLE_SHAPE",
}

def get_available_shapes():
    return list(EMOJI_SHAPE_FUNCTIONS.keys())

def is_in_emoji_shape(r, c, SHAPE_PARAMS):
    shape_func = SHAPE_PARAMS['SHAPE_FUNC']
    ROWS = SHAPE_PARAMS['ROWS']
    COLS = SHAPE_PARAMS['COLS']
    TRANSFORMS = SHAPE_PARAMS['TRANSFORMS'] 
    return shape_func(r, c, ROWS, COLS, TRANSFORMS)

# --- HÀM TẠO JSON OUTPUT ---

def generate_level_json(final_paths_indices, obstacles, tunnel_map, ROWS, COLS, wall_counters=None, snake_colors=None, hole_colors=None):
    """
    Tạo JSON data cho level với format:
    [
        {"position": [...], "itemType": "snake/wallBreak/hole/tunnel", "itemValueConfig": 0, "colorID": 0}
    ]
    Gốc tọa độ (0, 0) nằm ở tâm của bounding box chứa tất cả items.
    """
    level_data = []
    wall_counters = wall_counters or {}
    snake_colors = snake_colors or []
    
    # 1. Thu thập tất cả positions để tính bounding box
    all_positions = []
    
    # Collect from snakes
    for path_indices in final_paths_indices:
        all_positions.extend(path_indices)
    
    # Collect from obstacles
    for pos in obstacles.keys():
        all_positions.append(pos)
    
    # 2. Tính center của bounding box (rounded to integer)
    if not all_positions:
        # Fallback to grid center if no items
        center_r = ROWS // 2
        center_c = COLS // 2
    else:
        rows = [r for r, c in all_positions]
        cols = [c for r, c in all_positions]
        min_r, max_r = min(rows), max(rows)
        min_c, max_c = min(cols), max(cols)
        center_r = round((min_r + max_r) / 2)
        center_c = round((min_c + max_c) / 2)
    
    # 3. Helper function to convert grid position to center-origin
    def create_position_object(r, c):
        """
        Chuyển đổi tọa độ lưới (r, c) sang position object.
        Gốc tọa độ (0, 0) ở tâm của bounding box chứa tất cả items.
        """
        x = c - center_c
        y = center_r - r
        return {
            "x": x,
            "y": y
        }
    
    # 4. Thêm tất cả snake (arrow)
    for idx, path_indices in enumerate(final_paths_indices):
        # Đảo ngược thứ tự: position[0] phải là đầu rắn (arrow head)
        # path_indices[-1] là đầu rắn, path_indices[0] là đuôi
        reversed_path = list(reversed(path_indices))
        position_objects = [create_position_object(r, c) for (r, c) in reversed_path]
        color_id = snake_colors[idx] if idx < len(snake_colors) else -1
        level_data.append({
            "position": position_objects,
            "itemType": "snake",
            "itemValueConfig": 0,
            "colorID": color_id
        })
    
    # 5. Phân loại obstacles
    tunnel_positions = set(tunnel_map.keys())
    processed_tunnels = set()
    
    for (r, c), color in obstacles.items():
        if (r, c) in tunnel_positions:
            # Xử lý tunnel (chỉ thêm 1 lần cho mỗi cặp)
            if (r, c) not in processed_tunnels:
                partner = tunnel_map[(r, c)]
                position_objects = [
                    create_position_object(r, c),
                    create_position_object(partner[0], partner[1])
                ]
                level_data.append({
                    "position": position_objects,
                    "itemType": "tunnel",
                    "itemValueConfig": 0,
                    "colorID": -1
                })
                processed_tunnels.add((r, c))
                processed_tunnels.add(partner)
        elif color == (0, 0, 255):  # Hole (màu xanh dương)
            position_objects = [create_position_object(r, c)]
            # Get colorID from hole_colors map
            hole_color_id = hole_colors.get((r, c), -1) if hole_colors else -1
            level_data.append({
                "position": position_objects,
                "itemType": "hole",
                "itemValueConfig": 0,
                "colorID": hole_color_id
            })
        elif color == (128, 0, 128):  # Wall (màu tím)
            position_objects = [create_position_object(r, c)]
            counter_value = wall_counters.get((r, c), 0)
            level_data.append({
                "position": position_objects,
                "itemType": "wallBreak",
                "itemValueConfig": counter_value,
                "colorID": -1
            })
    
    return level_data

# --- CÁC HÀM PHỤ TRỢ (VẼ VÀ TÌM ĐƯỜNG) ---

def draw_grid_lines(draw, ROWS, COLS, occupied_cells, obstacles, tunnel_positions, wall_counters=None, hole_color_map=None, color_list=None):
    from PIL import ImageFont
    GRID_COLOR = (235, 235, 235)
    OCCUPIED_COLOR = (220, 220, 220)
    
    obstacles = obstacles or {}
    wall_counters = wall_counters or {}
    hole_color_map = hole_color_map or {}
    color_list = color_list or []
    
    # Try to load a font for counter text
    try:
        font = ImageFont.truetype("arial.ttf", 12)
    except:
        font = ImageFont.load_default()
    
    for r in range(ROWS):
        for c in range(COLS):
            x, y = c * CELL_SIZE, r * CELL_SIZE
            rect = [(x, y), (x + CELL_SIZE, y + CELL_SIZE)]
            
            # Mặc định vẽ ô lưới
            draw.rectangle(rect, outline=GRID_COLOR)
            
            if (r, c) in obstacles:
                color = obstacles[(r, c)]
                if (r, c) in tunnel_positions:
                    # Vẽ TUNNEL dạng hình tròn
                    padding = 4
                    draw.ellipse([(x + padding, y + padding), 
                                  (x + CELL_SIZE - padding, y + CELL_SIZE - padding)], 
                                 fill=color, outline=(50, 50, 50))
                else:
                    # Check if this is a hole and get its actual color
                    if color == (0, 0, 255) and (r, c) in hole_color_map:
                        color_id = hole_color_map[(r, c)]
                        if color_id >= 0 and color_id < len(color_list):
                            # Convert hex color to RGB
                            hex_color = color_list[color_id]
                            try:
                                color = tuple(int(hex_color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
                            except:
                                color = (0, 0, 255)  # Fallback to blue
                    
                    # Vẽ WALL/HOLE dạng ô vuông
                    draw.rectangle(rect, fill=color, outline=GRID_COLOR)
                    
                    # Vẽ counter cho WALL
                    if color == (128, 0, 128) and (r, c) in wall_counters:
                        counter = wall_counters[(r, c)]
                        if counter > 0:
                            text = str(counter)
                            # Calculate text position (center of cell)
                            bbox = draw.textbbox((0, 0), text, font=font)
                            text_width = bbox[2] - bbox[0]
                            text_height = bbox[3] - bbox[1]
                            text_x = x + (CELL_SIZE - text_width) // 2
                            text_y = y + (CELL_SIZE - text_height) // 2
                            draw.text((text_x, text_y), text, fill=(255, 255, 255), font=font)
            elif (r, c) in occupied_cells:
                draw.rectangle(rect, fill=OCCUPIED_COLOR, outline=GRID_COLOR)

def draw_snake_arrow(draw, path_coords, color="black"):
    if len(path_coords) < 2: return
    # Convert hex color to RGB tuple if needed
    if isinstance(color, str) and color.startswith('#'):
        try:
            color = tuple(int(color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
        except:
            color = "black"
    draw.line(path_coords, fill=color, width=LINE_WIDTH)
    end_x, end_y = path_coords[-1]; prev_x, prev_y = path_coords[-2]
    dx = end_x - prev_x; dy = end_y - prev_y; size = ARROW_HEAD_SIZE 
    if abs(dx) > abs(dy): 
        if dx > 0: draw.polygon([(end_x, end_y), (end_x - size, end_y - size), (end_x - size, end_y + size)], fill=color)
        else: draw.polygon([(end_x, end_y), (end_x + size, end_y - size), (end_x + size, end_y + size)], fill=color)
    else: 
        if dy > 0: draw.polygon([(end_x, end_y), (end_x - size, end_y - size), (end_x + size, end_y - size)], fill=color)
        else: draw.polygon([(end_x, end_y), (end_x - size, end_y + size), (end_x + size, end_y + size)], fill=color)

def is_conflicting(end_r, end_c, path_dir, occupied_ends):
    neighbors = [(0, 1), (0, -1), (1, 0), (-1, 0)]
    for dr, dc in neighbors:
        nr, nc = end_r + dr, end_c + dc
        if (nr, nc) in occupied_ends:
            neighbor_dir = occupied_ends[(nr, nc)]
            if neighbor_dir[0] == -dr and neighbor_dir[1] == -dc:
                return True
    return False

def is_movable(arrow_path, occupied_cells, ROWS, COLS, hole_positions=None, tunnel_map=None):
    """
    Kiểm tra thoát lưới với logic:
    1. Đầu chạm Hole -> Thoát.
    2. Đầu chạm Tunnel -> Dịch chuyển sang đầu kia.
    3. Toàn bộ thân ra ngoài -> Thoát.
    """
    hole_positions = hole_positions or set()
    tunnel_map = tunnel_map or {}
    other_occupied = occupied_cells - set(arrow_path)
    current_path = list(arrow_path)
    
    # Hướng đầu máy
    dr = current_path[-1][0] - current_path[-2][0]
    dc = current_path[-1][1] - current_path[-2][1]

    for _ in range(MAX_SIDE * 2):
        old_head = current_path[-1]
        new_head = (old_head[0] + dr, old_head[1] + dc)
        
        # 1. Kiểm tra Hole
        if new_head in hole_positions:
            return True
            
        # 2. Kiểm tra Tunnel (Dịch chuyển tức thời)
        if new_head in tunnel_map:
            new_head = tunnel_map[new_head]
            # Sau khi chui qua tunnel, vẫn phải check xem đầu ra có bị chặn không
            if new_head in other_occupied:
                return False

        # 3. Kiểm tra va chạm vật cản khác
        if new_head in other_occupied:
            return False
            
        # Cập nhật di chuyển 'Đầu kéo đuôi'
        new_path = []
        for i in range(len(current_path) - 1):
            new_path.append(current_path[i+1])
        new_path.append(new_head)
        current_path = new_path
        
        # 4. Kiểm tra thoát biên
        is_completely_out = True
        for (r, c) in current_path:
            if 0 <= r < ROWS and 0 <= c < COLS:
                is_completely_out = False
                break
        if is_completely_out:
            return True
            
    return False

def generate_random_snake(start_r, start_c, min_length, max_length, occupied_cells, SHAPE_PARAMS):
    # Thay đổi: Hàm nhận min_length và max_length
    ROWS = SHAPE_PARAMS['ROWS']
    COLS = SHAPE_PARAMS['COLS']
    MAX_BENDS = SHAPE_PARAMS.get('MAX_BENDS', 5) # Default 5
    MIN_BENDS = SHAPE_PARAMS.get('MIN_BENDS', 0) # Default 0
    
    # Bỏ BEND_CHANCE_FACTOR. Giờ trọng số ưu tiên đi thẳng.
    
    path_indices = [(start_r, start_c)] 
    current_r, current_c = start_r, start_c
    last_dr, last_dc = 0, 0
    bend_count = 0
    
    # Chúng ta sử dụng max_length để giới hạn vòng lặp
    for _ in range(max_length):
        moves = [(0, 1), (0, -1), (1, 0), (-1, 0)]
        valid_moves = []
        
        for dr, dc in moves:
            nr, nc = current_r + dr, current_c + dc
            
            is_new_bend = (dr, dc) != (last_dr, last_dc) and (last_dr, last_dc) != (0, 0)
            
            if 0 <= nr < ROWS and 0 <= nc < COLS:
                if is_in_emoji_shape(nr, nc, SHAPE_PARAMS):
                    if (nr, nc) not in occupied_cells and (nr, nc) not in path_indices:
                        
                        # Logic gấp khúc (Tối ưu hóa: Giữ trọng số 2 cho đi thẳng, 1 cho gấp khúc)
                        if is_new_bend:
                            if bend_count >= MAX_BENDS:
                                continue # Đã đạt giới hạn gấp khúc max
                            
                            # Cần đảm bảo nếu path đủ dài và chưa đủ min bends, 
                            # ta vẫn có cơ hội để gấp khúc. Tuy nhiên, logic này sẽ phức tạp.
                            # Tạm thời chỉ giới hạn bởi MAX_BENDS.
                            bend_weight = 1
                            valid_moves.extend([(nr, nc)] * bend_weight)
                            
                        elif (dr, dc) == (last_dr, last_dc) or (last_dr, last_dc) == (0, 0):
                            # Ưu tiên đi thẳng
                            valid_moves.extend([(nr, nc)] * 2) 

        if not valid_moves: break 
            
        next_r, next_c = random.choice(valid_moves)
        new_dr, new_dc = next_r - current_r, next_c - current_c
        
        if (new_dr, new_dc) != (last_dr, last_dc) and (last_dr, last_dc) != (0, 0):
            bend_count += 1
            
        last_dr, last_dc = new_dr, new_dc
        
        path_indices.append((next_r, next_c))
        current_r, current_c = next_r, next_c
        
    # Thêm kiểm tra MIN_BENDS:
    # Nếu path đạt min_length nhưng bend_count < MIN_BENDS, ta có thể loại bỏ path này.
    # Tuy nhiên, để tránh vòng lặp vô tận (nếu không gian không cho phép gấp khúc), 
    # ta chỉ nên loại bỏ nó nếu path đủ dài (ví dụ: > 3 ô)
    if len(path_indices) >= min_length and bend_count < MIN_BENDS:
        return [] # Trả về mảng rỗng nếu không đạt min bends yêu cầu.
        
    return path_indices # Chỉ trả về path hợp lệ


# --- Hàm tạo level chính (ĐÃ HOÀN THIỆN) ---
def generate_level_image(arrow_count, shape_input=None, uploaded_image_bytes=None, 
                         min_arrow_length=2, max_arrow_length=10, 
                         min_bends=0, max_bends=5, wall_counters=None, hole_count=0, tunnel_count=0, color_list=None):    
    # 1. ÁP DỤNG ĐỘ KHÓ VÀ INPUT TỪ NGƯỜI DÙNG
    FIXED_DENSITY_FACTOR = 2.2 
    
    MAX_ARROW_LENGTH_USED = max_arrow_length
    MIN_ARROW_LENGTH_USED = min_arrow_length
    
    MAX_BENDS_USED = max_bends
    MIN_BENDS_USED = min_bends
    
    # Đảm bảo Min/Max hợp lệ
    if MIN_ARROW_LENGTH_USED < 2: MIN_ARROW_LENGTH_USED = 2
    if MAX_ARROW_LENGTH_USED < MIN_ARROW_LENGTH_USED: MAX_ARROW_LENGTH_USED = MIN_ARROW_LENGTH_USED
    if MAX_BENDS_USED < MIN_BENDS_USED: MAX_BENDS_USED = MIN_BENDS_USED
    
    avg_len = (MIN_ARROW_LENGTH_USED + MAX_ARROW_LENGTH_USED) / 2
    required_cells = int(arrow_count * avg_len * FIXED_DENSITY_FACTOR)
    side_length = int(math.sqrt(required_cells)) + 2
    
    ROWS = min(side_length, MAX_SIDE)
    COLS = min(side_length, MAX_SIDE) 
    
    WIDTH = COLS * CELL_SIZE
    HEIGHT = ROWS * CELL_SIZE
    
    # 2. CHỌN HÌNH DẠNG & TIỀN XỬ LÝ ẢNH
    selected_shape_name = None
    shape_transforms = initialize_shape_transforms(ROWS, COLS)
    
    if uploaded_image_bytes:
        selected_shape_name = "UPLOADED_IMAGE"
        shape_transforms['PIXEL_MAP'] = process_uploaded_image(uploaded_image_bytes, ROWS, COLS)
    elif shape_input:
        if shape_input in EMOJI_SHAPE_FUNCTIONS:
            selected_shape_name = shape_input 
        elif shape_input in EMOJI_MAPPING:
            selected_shape_name = EMOJI_MAPPING[shape_input] 
            
    if not selected_shape_name:
        selected_shape_name = random.choice(list(EMOJI_SHAPE_FUNCTIONS.keys()))
        
    shape_func = EMOJI_SHAPE_FUNCTIONS[selected_shape_name]
    
    SHAPE_PARAMS = {
        'ROWS': ROWS, 'COLS': COLS, 
        'SHAPE_NAME': selected_shape_name,
        'SHAPE_FUNC': shape_func,
        'TRANSFORMS': shape_transforms,
        'MAX_BENDS': MAX_BENDS_USED,
        'MIN_BENDS': MIN_BENDS_USED, 
    }

    # 3. KHỞI TẠO VÀ GEN LEVEL
    img = Image.new('RGB', (WIDTH, HEIGHT), color='white')
    draw = ImageDraw.Draw(img)

    # Initialize color list
    color_list = color_list or ['#000000']
    
    occupied_cells = set() 
    occupied_ends = {} 
    final_paths_pixels = [] 
    final_paths_indices = []  # Lưu grid indices cho JSON export
    final_paths_colors = []  # Lưu colorID cho mỗi snake
    
    attempts = 0
    max_attempts = 100000 
    
    while len(final_paths_pixels) < arrow_count and attempts < max_attempts:
        attempts += 1
        
        r = random.randint(0, ROWS - 1)
        c = random.randint(0, COLS - 1)
        
        if not is_in_emoji_shape(r, c, SHAPE_PARAMS) or (r, c) in occupied_cells:
            continue

        # Chọn độ dài ngẫu nhiên trong khoảng Min và Max
        target_len = random.randint(MIN_ARROW_LENGTH_USED, MAX_ARROW_LENGTH_USED)
        
        # Cập nhật hàm gọi: truyền cả min và max length
        snake_path_indices = generate_random_snake(
            start_r=r, start_c=c, 
            min_length=MIN_ARROW_LENGTH_USED, 
            max_length=target_len, # Sử dụng target_len (<= MAX_ARROW_LENGTH_USED)
            occupied_cells=occupied_cells, 
            SHAPE_PARAMS=SHAPE_PARAMS
        )
        
        if len(snake_path_indices) >= MIN_ARROW_LENGTH_USED:
            end_r, end_c = snake_path_indices[-1]
            prev_r, prev_c = snake_path_indices[-2]
            path_dir = (end_r - prev_r, end_c - prev_c) 
            
            if is_conflicting(end_r, end_c, path_dir, occupied_ends):
                continue
            
            for (or_r, or_c) in snake_path_indices:
                occupied_cells.add((or_r, or_c))
            
            occupied_ends[(end_r, end_c)] = path_dir
            
            # Lưu grid indices cho JSON export
            final_paths_indices.append(list(snake_path_indices))
            
            # Assign random color from color list
            color_id = random.randint(0, len(color_list) - 1) if color_list else -1
            final_paths_colors.append(color_id)
            
            pixel_path = []
            for (pr, pc) in snake_path_indices:
                px = pc * CELL_SIZE + CELL_SIZE // 2
                py = pr * CELL_SIZE + CELL_SIZE // 2
                pixel_path.append((px, py))
            
            final_paths_pixels.append(pixel_path)

# --- LOGIC THÊM CHƯỚNG NGẠI VẬT ---
    obstacles = {}
    tunnel_map = {}
    tunnel_positions = set()
    wall_counter_map = {}  # Map position to counter value
    hole_color_map = {}  # Map position to colorID for holes

    empty_cells = [ (r,c) for r in range(ROWS) for c in range(COLS) 
                   if is_in_emoji_shape(r,c,SHAPE_PARAMS) and (r,c) not in occupied_cells ]
    random.shuffle(empty_cells)

    # Wall (Tím) with counters
    wall_counters = wall_counters or []
    for counter_value in wall_counters:
        if empty_cells:
            pos = empty_cells.pop()
            obstacles[pos] = (128, 0, 128)
            wall_counter_map[pos] = counter_value
    # Hole (Xanh dương) with random color
    for _ in range(hole_count):
        if empty_cells:
            pos = empty_cells.pop()
            obstacles[pos] = (0, 0, 255)
            # Assign random colorID from color_list
            if color_list and len(color_list) > 0:
                hole_color_map[pos] = random.randint(0, len(color_list) - 1)
            else:
                hole_color_map[pos] = -1
    # Tunnel (Hình tròn cặp màu)
    for _ in range(tunnel_count):
        if len(empty_cells) >= 2:
            t1, t2 = empty_cells.pop(), empty_cells.pop()
            t_color = (random.randint(50,200), random.randint(50,200), random.randint(50,200))
            obstacles[t1] = t_color
            obstacles[t2] = t_color
            tunnel_map[t1] = t2
            tunnel_map[t2] = t1
            tunnel_positions.update([t1, t2])

    for pos in obstacles: occupied_cells.add(pos)

    # Lưu danh sách tọa độ các Hole riêng biệt
    hole_positions = {pos for pos, color in obstacles.items() if color == (0, 0, 255)}

# --- VẼ CUỐI CÙNG ---
    draw_grid_lines(draw, ROWS, COLS, occupied_cells, obstacles, tunnel_positions, wall_counter_map, hole_color_map, color_list)

    for idx, path_pixels in enumerate(final_paths_pixels):
        # Get color from color_list based on colorID
        color_id = final_paths_colors[idx] if idx < len(final_paths_colors) else -1
        if color_id >= 0 and color_id < len(color_list):
            snake_color = color_list[color_id]
        else:
            snake_color = "#000000"  # Default black
        
        # Draw snake with assigned color
        draw_snake_arrow(draw, path_pixels, color=snake_color)
            
    img_io = io.BytesIO()
    img.save(img_io, 'PNG')
    img_io.seek(0)
    
    base64_image = base64.b64encode(img_io.read()).decode('utf-8')
    
    # Tạo JSON data cho level
    level_json = generate_level_json(final_paths_indices, obstacles, tunnel_map, ROWS, COLS, wall_counter_map, final_paths_colors, hole_color_map)
    
    return {
        'base64_image': base64_image,
        'actual_arrow_count': len(final_paths_pixels),
        'level_json': level_json
    }