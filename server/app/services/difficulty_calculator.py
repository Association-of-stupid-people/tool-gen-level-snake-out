import math

# Constants for Global Normalization (Estimated Caps)
# These act as the 'max' denominator for counts that don't fallback to local max
MAX_POSSIBLE_SNAKES = 100
MAX_OBSTACLE_WALLS = 500 # Depends on grid, but this is a soft cap for norm
MAX_HOLES = 20
MAX_TUNNEL_PAIRS = 20
MAX_WALL_BREAKS = 20
MAX_ICED_LOCKED = 20
MAX_KEY_LOCKED = 20
MAX_LOCKED_KEYS = 20

def normalize(val, min_val, max_val):
    if max_val <= min_val:
        return 0 if val <= min_val else 1 # Avoid division by zero
    
    # Clamp value
    clamped = max(min_val, min(val, max_val))
    return (clamped - min_val) / (max_val - min_val)

def get_snake_corners(path):
    # Path is list of dict/tuple: [{r,c}, ...] or [(r,c), ...]
    if len(path) < 3:
        return 0
    
    corners = 0
    # Iterate from 1 to len-2
    for i in range(1, len(path) - 1):
        # Check if p[i-1], p[i], p[i+1] form a 90 degree turn
        # Vector A: i -> i-1
        # Vector B: i -> i+1
        # Actually easier: check if row changes then col changes
        p_prev = path[i-1]
        p_curr = path[i]
        p_next = path[i+1]
        
        # Accessor helper
        def get_rc(p):
            if isinstance(p, dict): return p.get('row'), p.get('col')
            return p[0], p[1]
            
        r0, c0 = get_rc(p_prev)
        r1, c1 = get_rc(p_curr)
        r2, c2 = get_rc(p_next)
        
        # Direction 1
        dr1, dc1 = r1-r0, c1-c0
        # Direction 2
        dr2, dc2 = r2-r1, c2-c1
        
        if (dr1, dc1) != (dr2, dc2):
            corners += 1
            
    return corners

def check_movable(snake, all_snakes, obstacles_map, rows, cols):
    # Snake path: List of points. Head is usually at one end.
    # In this project: 
    # Frontend sends path: [Tail ... Head]. (Confirmed in earlier logs)
    # Validator/Backend usually expects [Tail...Head] too.
    
    path = snake.get('path', [])
    if not path: return False
    
    # helper
    def get_rc(p):
        if isinstance(p, dict): return p.get('row'), p.get('col')
        return p[0], p[1]
        
    head_r, head_c = get_rc(path[-1]) # Last item is Head
    
    # Determine potential moves (Up, Down, Left, Right)
    neighbors = [
        (head_r - 1, head_c), (head_r + 1, head_c),
        (head_r, head_c - 1), (head_r, head_c + 1)
    ]
    
    # Occupied set (Walls, Obstacles, Other Snakes)
    # Note: For simple "Initial Freedom", we consider other snakes as static blocks
    
    for nr, nc in neighbors:
        # 1. Bounds check
        if nr < 0 or nr >= rows or nc < 0 or nc >= cols:
            continue
            
        # 2. Obstacles check
        if (nr, nc) in obstacles_map:
            obs = obstacles_map[(nr, nc)]
            # If obs is wall, wall_break, locked block -> blocked
            # Holes -> depends? Usually holes kill you, so not "movable" safely? 
            # Or holes is valid move but consequence? 
            # Docs say "Hole - giải pháp / áp lực routing". 
            # In Snake Out context, usually you can move INTO a hole (and die or teleport?).
            # But "Movable" usually means "Can step there". 
            # Let's assume Wall-like blocks are NO-GO.
            o_type = obs.get('type')
            if o_type in ['wall', 'wall_break', 'iced_snake', 'key_snake']:
                continue
        
        # 3. Snake check
        is_blocked_by_snake = False
        for s in all_snakes:
            # Check all dots except possibly the tail (if we want to simulate tail chasing)
            # For strict "Initial Freedom", let's block by all body parts
            s_path = s.get('path', [])
            for p in s_path:
                sr, sc = get_rc(p)
                if sr == nr and sc == nc:
                    is_blocked_by_snake = True
                    break
            if is_blocked_by_snake: break
        
        if is_blocked_by_snake:
            continue
            
        # If passed all checks, found a valid move
        return True
        
    return False

def calculate(snakes, obstacles, rows, cols):
    grid_area = rows * cols
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
    
    for obs in obstacles:
        o_type = obs.get('type')
        cells = obs.get('cells', [])
        
        # Populate map
        if cells:
            for c in cells:
                obstacles_map[(c['row'], c['col'])] = obs
        else:
             obstacles_map[(obs['row'], obs['col'])] = obs
             
        # Count
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

    # --- S: Snake Load (Max 40) ---
    total_snake = len(snakes)
    if total_snake == 0:
        return {"difficulty_score": 0, "breakdown": {"S":0, "F":0, "O":0}}
        
    dots_lens = []
    corners = []
    for s in snakes:
        path = s.get('path', [])
        dots_lens.append(len(path))
        corners.append(get_snake_corners(path))
        
    avg_dot = sum(dots_lens) / total_snake
    avg_corner = sum(corners) / total_snake
    
    # Dynamic Norms (Density based)
    # Max snakes: Assume heavy density is grid_area / 4 (e.g. 100 cells -> 25 snakes)
    max_snakes_norm = max(5, grid_area / 4)
    s_val_count = normalize(total_snake, 0, max_snakes_norm)
    
    # Max len: Assume average length max is grid dimension
    max_len_norm = max(5, max(rows, cols))
    s_val_len = normalize(avg_dot, 2, max_len_norm)
    
    # Max corners: Use the actual max corners found in the current level (Data-driven)
    # If all snakes are straight (max=0), score is 0.
    max_corner_in_level = max(corners) if corners else 0
    s_val_corner = normalize(avg_corner, 0, max(1, max_corner_in_level))
    
    # Weights for S (Total 40):
    # Density (Count): 20 pts
    # Length: 10 pts
    # Complexity: 10 pts
    S = (20 * s_val_count) + (10 * s_val_len) + (10 * s_val_corner)

    # --- F: Freedom (Max 30) ---
    movable_count = 0
    for s in snakes:
        if check_movable(s, snakes, obstacles_map, rows, cols):
            movable_count += 1
    
    ratio = movable_count / total_snake
    F = 30 * (1.0 - ratio)

    # --- O: Obstacle (Max 30) ---
    # Weighted Sum relative to Grid Area
    # Weights reflecting interaction complexity
    obs_raw_score = (wall_count * 1.0) + \
                    (hole_count * 2.5) + \
                    (tunnel_pair_count * 3.0) + \
                    (wall_break_count * 3.0) + \
                    (iced_locked_count * 5.0) + \
                    (key_locked_count * 5.0)
                    
    # Max Obs Score Capacity:
    # If ~30% of grid is obstacles (walls), score would be (0.3 * area).
    # Complex obstacles add more density value.
    max_obs_capacity = max(10, grid_area * 0.4)
    
    O = 30 * normalize(obs_raw_score, 0, max_obs_capacity)
    
    total_score = S + F + O
    
    return {
        "difficulty_score": round(total_score, 1),
        "breakdown": {
            "S": round(S, 1),
            "F": round(F, 1),
            "O": round(O, 1),
        }
    }
