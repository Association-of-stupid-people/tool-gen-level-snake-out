def validate_level(snakes, obstacles_map, rows, cols):
    """
    Validates if the level is solvable (no stuck snakes).
    Rule:
    - Snakes move in the direction of their head (straight line).
    - If the path from head to grid boundary is clear (no other snakes/obstacles), 
      the snake is 'movable' and can be removed.
    - Process iteratively until no snakes remain or deadlock.
    
    Args:
        snakes: List of dicts {'path': [(r,c), ...]} (algorithm.py format: Head is last)
        obstacles_map: Dict {(r,c): obstacle_data}
        rows, cols: Grid dimensions
        
    Returns:
        {
            "is_solvable": bool,
            "remained_count": int,
            "total_snakes": int,
            "steps": int,
            "logs": list[str]
        }
    """
    
    # 1. Build Grid State
    # 0 = Empty, 1 = Snake, 2 = Obstacle
    grid = {} # (r, c) -> type
    
    # helper for indexing
    active_snakes = []
    
    for i, s in enumerate(snakes):
        path = s['path']
        if len(path) < 2: continue # Should not happen based on constraints
        
        # In algorithm.py, path is [Start, ..., End]. End is Head.
        head = path[-1]
        neck = path[-2]
        direction = (head[0] - neck[0], head[1] - neck[1])
        
        active_snakes.append({
            "id": i,
            "path": path,
            "head": head,
            "direction": direction
        })
        
        for r, c in path:
            grid[(r, c)] = "snake"
            
    for (r, c), obs in obstacles_map.items():
        # Holes/Walls/etc all block movement for now
        grid[(r, c)] = "obstacle"

    step_count = 0
    logs = []
    
    total_snakes = len(active_snakes)
    
    while True:
        step_count += 1
        removable_indices = []
        
        # Find movable snakes
        for i, s in enumerate(active_snakes):
            r, c = s['head']
            dr, dc = s['direction']
            
            # Cast Ray
            blocked = False
            curr_r, curr_c = r + dr, c + dc
            
            while 0 <= curr_r < rows and 0 <= curr_c < cols:
                if (curr_r, curr_c) in grid:
                    blocked = True
                    break
                curr_r += dr
                curr_c += dc
            
            if not blocked:
                removable_indices.append(i)
        
        if not removable_indices:
            # Deadlock or Finished
            break
            
        # Process Removal
        # Sort indices desc to remove correctly
        removable_indices.sort(reverse=True)
        
        removed_this_step = []
        for idx in removable_indices:
            s = active_snakes.pop(idx)
            removed_this_step.append(s['id'])
            # Clear from grid
            for r, c in s['path']:
                if (r, c) in grid and grid[(r, c)] == "snake":
                    del grid[(r, c)]
                    
        logs.append(f"Step {step_count}: Removed {len(removed_this_step)} snakes (IDs: {removed_this_step})")
        
    is_solvable = len(active_snakes) == 0
    
    if not is_solvable:
        logs.append(f"FAILED: {len(active_snakes)} snakes stuck.")
    else:
        logs.append(f"SUCCESS: All {total_snakes} snakes solved in {step_count} steps.")

    return {
        "is_solvable": is_solvable,
        "remained_count": len(active_snakes),
        "total_snakes": total_snakes,
        "steps": step_count,
        "logs": logs
    }
