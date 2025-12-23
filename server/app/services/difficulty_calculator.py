"""
Difficulty Calculator Service
Calculates difficulty score for snake levels based on:
- S (Snake Load): 30 pts max
- F (Freedom): 40 pts max  
- O (Obstacles): 30 pts max
"""

from app.services.validator import validate_level

def normalize(val, min_val, max_val):
    """Normalize value to 0-1 range"""
    if max_val <= min_val:
        return 0 if val <= min_val else 1
    clamped = max(min_val, min(val, max_val))
    return (clamped - min_val) / (max_val - min_val)


def get_snake_corners(path):
    """Count number of 90-degree turns in snake path"""
    if len(path) < 3:
        return 0
    
    corners = 0
    for i in range(1, len(path) - 1):
        p_prev = path[i-1]
        p_curr = path[i]
        p_next = path[i+1]
        
        def get_rc(p):
            if isinstance(p, dict): return p.get('row'), p.get('col')
            return p[0], p[1]
            
        r0, c0 = get_rc(p_prev)
        r1, c1 = get_rc(p_curr)
        r2, c2 = get_rc(p_next)
        
        dr1, dc1 = r1-r0, c1-c0
        dr2, dc2 = r2-r1, c2-c1
        
        if (dr1, dc1) != (dr2, dc2):
            corners += 1
            
    return corners


def calculate_bounding_box(snakes, obstacles):
    """
    Calculate grid bounds from actual data (bounding box).
    Returns (rows, cols) based on min/max positions.
    """
    all_positions = []
    
    def get_rc(p):
        if isinstance(p, dict): return p.get('row', 0), p.get('col', 0)
        return p[0], p[1]
    
    # From snakes
    for s in snakes:
        path = s.get('path', [])
        for p in path:
            r, c = get_rc(p)
            all_positions.append((r, c))
    
    # From obstacles
    for obs in obstacles:
        cells = obs.get('cells', [])
        if cells:
            for cell in cells:
                r, c = get_rc(cell)
                all_positions.append((r, c))
        else:
            r = obs.get('row', 0)
            c = obs.get('col', 0)
            all_positions.append((r, c))
    
    if not all_positions:
        return 1, 1
    
    min_r = min(p[0] for p in all_positions)
    max_r = max(p[0] for p in all_positions)
    min_c = min(p[1] for p in all_positions)
    max_c = max(p[1] for p in all_positions)
    
    return (max_r - min_r + 1), (max_c - min_c + 1)


def check_movable(snake, all_snakes, obstacles_map, rows, cols):
    """Check if snake head can move in any direction"""
    path = snake.get('path', [])
    if not path: return False
    
    def get_rc(p):
        if isinstance(p, dict): return p.get('row'), p.get('col')
        return p[0], p[1]
        
    head_r, head_c = get_rc(path[-1])
    
    neighbors = [
        (head_r - 1, head_c), (head_r + 1, head_c),
        (head_r, head_c - 1), (head_r, head_c + 1)
    ]
    
    for nr, nc in neighbors:
        if nr < 0 or nr >= rows or nc < 0 or nc >= cols:
            continue
            
        if (nr, nc) in obstacles_map:
            obs = obstacles_map[(nr, nc)]
            o_type = obs.get('type')
            if o_type in ['wall', 'wall_break', 'iced_snake', 'key_snake']:
                continue
        
        is_blocked_by_snake = False
        for s in all_snakes:
            s_path = s.get('path', [])
            for p in s_path:
                sr, sc = get_rc(p)
                if sr == nr and sc == nc:
                    is_blocked_by_snake = True
                    break
            if is_blocked_by_snake: break
        
        if is_blocked_by_snake:
            continue
            
        return True
        
    return False


def calculate(snakes, obstacles, rows=None, cols=None):
    """
    Calculate difficulty score for a level.
    
    Args:
        snakes: List of snake data
        obstacles: List of obstacle data
        rows, cols: Grid size from settings (used for validation)
    
    Grid bounds (bounding box) are calculated from data for density calculation.
    But validator uses rows/cols from settings to determine exits.
    """
    
    # Calculate grid bounds from data
    bounds_h, bounds_w = calculate_bounding_box(snakes, obstacles)
    grid_area = bounds_h * bounds_w
    
    if grid_area == 0:
        return {"difficulty_score": 0, "breakdown": {"S": 0, "F": 0, "O": 0}}

    # Pre-process Obstacles
    obstacles_map = {}
    
    wall_count = 0
    hole_count = 0
    tunnel_pair_count = 0 
    wall_break_count = 0
    iced_locked_count = 0
    key_locked_count = 0
    obstacle_cells = 0
    
    for obs in obstacles:
        o_type = obs.get('type')
        cells = obs.get('cells', [])
        
        # Populate map
        if cells:
            for c in cells:
                obstacles_map[(c['row'], c['col'])] = obs
                obstacle_cells += 1
        else:
            obstacles_map[(obs['row'], obs['col'])] = obs
            obstacle_cells += 1
             
        # Count by type
        if o_type == 'wall':
            wall_count += len(cells) if cells else 1
        elif o_type == 'hole':
            hole_count += 1
        elif o_type == 'tunnel':
            tunnel_pair_count += 0.5
        elif o_type == 'wall_break':
            wall_break_count += 1
        elif o_type == 'iced_snake':
            iced_locked_count += 1
        elif o_type == 'key_snake':
            key_locked_count += 1
            
    tunnel_pair_count = int(tunnel_pair_count)

    # --- S: Snake Load ---
    # Điểm trực tiếp, không cap
    total_snakes = len(snakes)
    if total_snakes == 0:
        return {"difficulty_score": 0, "breakdown": {"S": 0, "F": 0, "O": 0}}
        
    dots_lens = []
    corners = []
    snake_cells = 0
    
    for s in snakes:
        path = s.get('path', [])
        dots_lens.append(len(path))
        corners.append(get_snake_corners(path))
        snake_cells += len(path)
        
    avg_dot = sum(dots_lens) / total_snakes
    avg_corner = sum(corners) / total_snakes
    
    # S sub-scores (không cap)
    # Số lượng rắn: mỗi rắn = 2 pts
    s_count = total_snakes * 2
    # Độ dài trung bình: mỗi cell trung bình = 1 pt
    s_len = avg_dot * 0.25
    # Góc cua trung bình: mỗi góc trung bình = 2 pts
    s_corner = avg_corner * 0.5
    
    S = s_count + s_len + s_corner

    # --- F: Freedom ---
    
    # First, run validation to get depth and per-step stuck ratio
    validator_snakes = []
    for s in snakes:
        path = s.get('path', [])
        path_tuples = []
        for p in path:
            if isinstance(p, dict):
                path_tuples.append((p.get('row', 0), p.get('col', 0)))
            else:
                path_tuples.append((p[0], p[1]))
        validator_snakes.append({'path': path_tuples})
    
    # Use rows/cols from settings for validation (determines exit edges)
    # If not provided, fall back to bounding box
    validate_rows = rows if rows else bounds_h
    validate_cols = cols if cols else bounds_w
    
    validation_result = validate_level(validator_snakes, obstacles_map, validate_rows, validate_cols)
    solve_depth = validation_result.get('steps', 1)
    avg_stuck_ratio = validation_result.get('avg_stuck_ratio', 0)
    
    # 1. Tỷ lệ rắn bị kẹt trung bình qua các step (0-1, nhân 5)
    f_stuck = avg_stuck_ratio * 5
    
    # 2. Độ lớn của grid: mỗi 100 cells = 1 pt
    f_grid = grid_area / 100
    
    # 3. Chiều sâu: mỗi step = 2 pts
    f_depth = solve_depth * 2
    
    F = f_stuck + f_grid + f_depth

    # --- O: Obstacles ---
    # Weighted sum trực tiếp, không cap
    O = (wall_count * 1.0) + \
        (hole_count * 2.5) + \
        (tunnel_pair_count * 3.0) + \
        (wall_break_count * 3.0) + \
        (iced_locked_count * 5.0) + \
        (key_locked_count * 5.0)
    
    total_score = S + F + O
    
    return {
        "difficulty_score": round(total_score, 1),
        "breakdown": {
            "S": round(S, 1),
            "F": round(F, 1),
            "O": round(O, 1),
        },
        "details": {
            "grid_bounds": f"{bounds_w}x{bounds_h}",
            "total_snakes": total_snakes,
            "solve_depth": solve_depth,
            "occupied_cells": snake_cells + obstacle_cells
        }
    }
