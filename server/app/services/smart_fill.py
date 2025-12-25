"""
Smart Fill Gaps Algorithm

Uses simulation-based validation to fill remaining gaps in a level.
Adds snakes that keep the entire level solvable.
"""
import random
from .strategies.layered import LayeredStrategy
from .json_builder import create_level_json
from .validator import validate_level
from .utils import get_neighbors


def smart_fill_gaps(rows, cols, existing_snakes, obstacles_input, custom_grid, 
                    color_list, min_len, max_len, min_bends, max_bends):
    """
    Fill remaining gaps in an existing level using simulation-based validation.
    
    Args:
        rows, cols: Grid dimensions
        existing_snakes: List of existing snake dicts with 'path' and 'color'
        obstacles_input: List of obstacle dicts
        custom_grid: 2D boolean array of valid cells
        color_list: List of hex colors for new snakes
        min_len, max_len: Snake length constraints
        min_bends, max_bends: Snake bend constraints
        
    Returns:
        Dict with level_json, logs, is_solvable, stuck_count, snakes_added
    """
    logs = []
    
    # 1. Parse Grid
    if not custom_grid:
        valid_cells = set((r, c) for r in range(rows) for c in range(cols))
    else:
        valid_cells = set()
        for r in range(len(custom_grid)):
            for c in range(len(custom_grid[0])):
                cell = custom_grid[r][c]
                is_valid = bool(cell) if not isinstance(cell, str) else cell.lower() in ('1', 'true')
                if is_valid:
                    valid_cells.add((r, c))
    
    # 2. Setup Obstacles
    obstacles_map = {}
    if obstacles_input:
        for obs in obstacles_input:
            positions = []
            if 'cells' in obs and obs['cells']:
                positions = [(c['row'], c['col']) for c in obs['cells']]
            elif 'row' in obs and 'col' in obs:
                positions = [(obs['row'], obs['col'])]
            
            for r, c in positions:
                if 0 <= r < rows and 0 <= c < cols:
                    if (r, c) in valid_cells:
                        valid_cells.remove((r, c))
                    obstacles_map[(r, c)] = obs
    
    # 3. Create Strategy Instance
    strategy = LayeredStrategy(rows, cols, valid_cells, obstacles_map, color_list)
    
    # 4. Mark existing snakes as occupied
    for snake in existing_snakes:
        path = snake.get('path', [])
        color = snake.get('color', '#00FF00')
        
        # Convert path format if needed
        parsed_path = []
        for p in path:
            if isinstance(p, dict):
                parsed_path.append((p['row'], p['col']))
            else:
                parsed_path.append(p)
        
        if parsed_path:
            strategy.occupied.update(parsed_path)
            for r, c in parsed_path:
                strategy.grid_array[r, c] = 1
            strategy.snakes.append({
                'path': parsed_path,
                'color': color
            })
    
    original_count = len(strategy.snakes)
    remaining_cells = len(valid_cells - strategy.occupied)
    logs.append(f"Existing snakes: {original_count}")
    logs.append(f"Remaining cells: {remaining_cells}")
    logs.append(f"Constraints: len={min_len}-{max_len}, bends={min_bends}-{max_bends}")
    
    # 5. Smart Fill: Add snakes with simulation-based validation
    max_snakes_to_add = 200
    max_attempts_per_snake = 50
    snakes_added = 0
    
    while snakes_added < max_snakes_to_add:
        remaining = list(valid_cells - strategy.occupied)
        if len(remaining) < min_len:
            logs.append(f"Not enough cells remaining ({len(remaining)} < {min_len})")
            break
        
        # Find a valid path (without exit check)
        found_valid = False
        
        for attempt in range(max_attempts_per_snake):
            random.shuffle(remaining)
            start = remaining[0]
            
            # Try to build a path using DFS
            path = _find_valid_path(
                strategy, start, min_len, max_len, min_bends, max_bends
            )
            
            if not path:
                continue
            
            # Temporarily add snake
            temp_snake = {'path': path, 'color': random.choice(color_list) if color_list else '#00FF00'}
            test_snakes = strategy.snakes + [temp_snake]
            
            # Validate entire level
            test_result = validate_level(test_snakes, obstacles_map, rows, cols)
            
            if test_result['is_solvable']:
                # Level remains solvable - keep this snake!
                strategy.occupied.update(path)
                for r, c in path:
                    strategy.grid_array[r, c] = 1
                strategy.snakes.append(temp_snake)
                snakes_added += 1
                found_valid = True
                break
        
        if not found_valid:
            logs.append(f"No more valid snakes found after {max_attempts_per_snake} attempts")
            break
    
    new_count = len(strategy.snakes)
    logs.append(f"Smart Fill Complete: Added {new_count - original_count} snakes")
    
    # 6. Final Validate
    val_result = validate_level(strategy.snakes, obstacles_map, rows, cols)
    
    return {
        'level_json': create_level_json(strategy.snakes, obstacles_map, rows, cols, color_list),
        'logs': logs,
        'is_solvable': val_result['is_solvable'],
        'stuck_count': val_result['remained_count'],
        'snakes_added': new_count - original_count,
        'grid_rows': rows,  # Return grid dimensions used
        'grid_cols': cols
    }


def _find_valid_path(strategy, start, min_len, max_len, min_bends, max_bends):
    """
    Find a valid snake path without requiring immediate exit.
    Uses DFS with backtracking.
    """
    stack = [(start, [start], 0)]  # (current_pos, path, bends)
    visited_states = set()
    max_nodes = 2000
    nodes_checked = 0
    
    while stack and nodes_checked < max_nodes:
        nodes_checked += 1
        current, path, bends = stack.pop()
        
        state = (current, len(path), bends)
        if state in visited_states:
            continue
        visited_states.add(state)
        
        # Check if we have a valid length and bends
        if len(path) >= min_len and bends >= min_bends:
            if len(path) >= max_len or random.random() < 0.3:
                return path
        
        if len(path) >= max_len:
            continue
        
        # Get neighbors
        nbs = get_neighbors(current[0], current[1], strategy.rows, strategy.cols)
        valid_nbs = [
            n for n in nbs 
            if n in strategy.valid_cells 
            and n not in strategy.occupied 
            and n not in path
        ]
        
        random.shuffle(valid_nbs)
        
        for next_pos in valid_nbs:
            # Calculate bends
            new_bends = bends
            if len(path) >= 2:
                prev = path[-2]
                curr = path[-1]
                d1 = (curr[0] - prev[0], curr[1] - prev[1])
                d2 = (next_pos[0] - curr[0], next_pos[1] - curr[1])
                if d1 != d2:
                    new_bends += 1
            
            if new_bends <= max_bends:
                stack.append((next_pos, path + [next_pos], new_bends))
    
    return None
