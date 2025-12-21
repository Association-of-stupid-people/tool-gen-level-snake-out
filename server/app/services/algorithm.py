from .strategies.registry import get_strategy_class
from .json_builder import create_level_json
from .validator import validate_level

def generate_level(arrow_count, custom_grid=None, 
                   min_arrow_length=3, max_arrow_length=10, 
                   min_bends=0, max_bends=10, 
                   obstacles_input=None, color_list=None,
                   strategy_name='SMART_DYNAMIC'):
                         
    logs = []
    
    # 1. Parse Input & Validate
    if not custom_grid:
        ROWS, COLS = 10, 10
        valid_cells = set((r, c) for r in range(ROWS) for c in range(COLS))
    else:
        ROWS = len(custom_grid)
        COLS = len(custom_grid[0]) if ROWS > 0 else 0
        valid_cells = set()
        for r in range(ROWS):
            for c in range(COLS):
                if custom_grid[r][c]:
                    valid_cells.add((r, c))
                    
    # 2. Setup Obstacles
    obstacles_map = {}
    tunnel_map = {}
    tunnel_pairs = {}
    
    if obstacles_input:
        for obs in obstacles_input:
            o_type = obs.get('type')
            positions = []
            if 'cells' in obs and obs['cells']:
                positions = [(c['row'], c['col']) for c in obs['cells']]
            elif 'row' in obs and 'col' in obs:
                positions = [(obs['row'], obs['col'])]
                
            for r, c in positions:
                if 0 <= r < ROWS and 0 <= c < COLS:
                    if (r, c) in valid_cells:
                        valid_cells.remove((r, c))
                    obstacles_map[(r, c)] = obs
                    if o_type == 'tunnel':
                        color = obs.get('color')
                        if color not in tunnel_pairs: tunnel_pairs[color] = []
                        tunnel_pairs[color].append((r, c))

    # Link Tunnels
    for color, coords in tunnel_pairs.items():
        if len(coords) == 2:
            u, v = coords[0], coords[1]
            tunnel_map[u] = v
            tunnel_map[v] = u
            obstacles_map[u]['partner'] = v
            obstacles_map[v]['partner'] = u

    # 3. Instantiate Strategy
    StrategyClass = get_strategy_class(strategy_name)
    if not StrategyClass:
         logs.append(f"Warning: Strategy {strategy_name} not implemented. Fallback to SMART_DYNAMIC.")
         from .strategies.smart_dynamic import SmartDynamicStrategy
         StrategyClass = SmartDynamicStrategy

    MAX_RETRIES = 20
    best_result = None
    best_score = -1 # Score = (Solvable * 1000) + Coverage_Percent
    
    for attempt in range(MAX_RETRIES):
        # Create fresh strategy instance
        strategy = StrategyClass(ROWS, COLS, valid_cells, obstacles_map, color_list)
        
        # Run Generation
        result = strategy.generate(arrow_count, min_arrow_length, max_arrow_length, min_bends, max_bends)
        
        final_snakes = result['snakes']
        current_logs = result['logs'] # Capture logs from this attempt
        occupied = result['occupied']
        
        # Calculate Stats
        filled_count = len(occupied)
        total_playable = len(valid_cells)
        coverage_percent = 0
        if total_playable > 0:
            coverage_percent = int(filled_count/total_playable*100)
            
        # Validation Check
        val_result = validate_level(final_snakes, obstacles_map, ROWS, COLS)
        
        # Scoring
        is_solvable = val_result['is_solvable']
        score = (1000 if is_solvable else 0) + coverage_percent
        
        # Update Best Result if this is better
        if score > best_score:
            best_score = score
            best_result = {
                'level_json_data': create_level_json(final_snakes, obstacles_map, ROWS, COLS, color_list),
                'logs': current_logs + [f"Attempt {attempt+1}/{MAX_RETRIES}: Coverage {coverage_percent}% | Solvable: {is_solvable}"],
                'is_solvable': is_solvable,
                'stuck_count': val_result['remained_count'],
                'val_logs': val_result['logs']
            }
            
        # If perfect (Solvable + >95% coverage), stop early
        if is_solvable and coverage_percent >= 95:
             best_result['logs'].append("Perfect result found. Stopping retries.")
             break
    
    # Use best result
    final_logs = logs + best_result['logs']
    final_logs.append("--- Solvability Check ---")
    final_logs.extend(best_result['val_logs'])
    
    if not best_result['is_solvable']:
        final_logs.append(f"WARNING: Level is STUCK. Remained: {best_result['stuck_count']}")

    return {
        'level_json': best_result['level_json_data'],
        'logs': final_logs,
        'is_solvable': best_result['is_solvable'],
        'stuck_count': best_result['stuck_count']
    }
