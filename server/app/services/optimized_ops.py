import numpy as np
from numba import njit
from numba.typed import List

@njit
def bfs_dist_map_numba(rows, cols, grid, boundary_dist=1):
    dist_map = np.full((rows, cols), -1, dtype=np.int32)
    queue = np.empty((rows * cols, 2), dtype=np.int32)
    head = 0
    tail = 0

    for r in range(rows):
        for c in range(cols):
            if grid[r, c] != 0: 
                continue 

            is_exit = False
            if r == 0 or r == rows - 1 or c == 0 or c == cols - 1:
                is_exit = True
            
            if not is_exit:
                if r > 0 and grid[r-1, c] == 1: is_exit = True
                elif r < rows - 1 and grid[r+1, c] == 1: is_exit = True
                elif c > 0 and grid[r, c-1] == 1: is_exit = True
                elif c < cols - 1 and grid[r, c+1] == 1: is_exit = True
            
            if is_exit:
                dist_map[r, c] = boundary_dist
                queue[tail, 0] = r
                queue[tail, 1] = c
                tail += 1
    
    while head < tail:
        cr = queue[head, 0]
        cc = queue[head, 1]
        head += 1
        
        current_dist = dist_map[cr, cc]
        next_dist = current_dist + 1
        
        if cr > 0 and grid[cr-1, cc] == 0 and dist_map[cr-1, cc] == -1:
            dist_map[cr-1, cc] = next_dist
            queue[tail, 0] = cr - 1; queue[tail, 1] = cc; tail += 1
            
        if cr < rows - 1 and grid[cr+1, cc] == 0 and dist_map[cr+1, cc] == -1:
            dist_map[cr+1, cc] = next_dist
            queue[tail, 0] = cr + 1; queue[tail, 1] = cc; tail += 1
            
        if cc > 0 and grid[cr, cc-1] == 0 and dist_map[cr, cc-1] == -1:
            dist_map[cr, cc-1] = next_dist
            queue[tail, 0] = cr; queue[tail, 1] = cc - 1; tail += 1

        if cc < cols - 1 and grid[cr, cc+1] == 0 and dist_map[cr, cc+1] == -1:
            dist_map[cr, cc+1] = next_dist
            queue[tail, 0] = cr; queue[tail, 1] = cc + 1; tail += 1
                
    return dist_map

@njit
def count_free_neighbors_numba(rows, cols, grid, r, c):
    count = 0
    if r > 0 and grid[r-1, c] == 0: count += 1
    if r < rows - 1 and grid[r+1, c] == 0: count += 1
    if c > 0 and grid[r, c-1] == 0: count += 1
    if c < cols - 1 and grid[r, c+1] == 0: count += 1
    return count

@njit
def check_raycast_numba(rows, cols, grid, r, c, dr, dc, path=None):
    if dr == 0 and dc == 0: return False
    curr_r = r + dr
    curr_c = c + dc
    while 0 <= curr_r < rows and 0 <= curr_c < cols:
        # Check Global Grid
        if grid[curr_r, curr_c] == 1: return False
        
        # Check Current Path (Self-Collision along Ray)
        # Note: In standard Snake, head chasing tail (last segment) is valid.
        # But hitting middle segment is block.
        # For safety/simplicity in generation, let's forbid hitting ANY part of current path.
        if path is not None:
            for pr, pc in path:
                if pr == curr_r and pc == curr_c:
                    return False
                    
        curr_r += dr
        curr_c += dc
    return True

@njit
def get_sorted_neighbors_numba(rows, cols, grid, r, c, path, heuristic_mode):
    # Retrieve neighbors
    nbs = List() 
    
    # Candidate neighbors
    for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols:
            if grid[nr, nc] == 0:
                # Check path collision
                in_path = False
                for pr, pc in path:
                    if pr == nr and pc == nc:
                        in_path = True
                        break
                if not in_path:
                    nbs.append((nr, nc))
    
    n_count = len(nbs)
    if n_count > 1:
        # Sort
        scores = np.zeros(n_count, dtype=np.float32)
        for i in range(n_count):
            nr, nc = nbs[i]
            
            # Base Randomness
            rnd = np.random.random() * 0.3
            
            if heuristic_mode == 0: # SmartDynamic (Constrained)
                free_n = count_free_neighbors_numba(rows, cols, grid, nr, nc)
                scores[i] = free_n * 0.7 + rnd
                
            elif heuristic_mode == 1: # EdgeHugger
                # Dist to edge
                dist = min(nr, rows - 1 - nr, nc, cols - 1 - nc)
                scores[i] = dist * 1.0 + rnd
                
            elif heuristic_mode == 2: # MaxClump (Open Areas)
                free_n = count_free_neighbors_numba(rows, cols, grid, nr, nc)
                # We want MAX free neighbors -> Ascending Sort -> Use Negative
                scores[i] = -free_n * 1.0 + rnd
            
        # Bubble sort ascending
        for i in range(n_count):
            for j in range(0, n_count - i - 1):
                if scores[j] > scores[j + 1]:
                    # Swap
                    t_s = scores[j]; scores[j] = scores[j+1]; scores[j+1] = t_s
                    t_n = nbs[j]; nbs[j] = nbs[j+1]; nbs[j+1] = t_n
                    
    return nbs

@njit
def dfs_numba(rows, cols, grid, start_r, start_c, min_len, max_len, min_bends, max_bends, max_nodes=500, heuristic_mode=0):
    # Iterative DFS
    path = List()
    path.append((np.int64(start_r), np.int64(start_c)))
    
    # Stacks
    # We need to backtrack:
    # 1. State at current depth: (last_dr, last_dc, current_bends)
    # 2. Neighbors to explore
    # 3. Current neighbor index
    
    nbs_stack = List()
    idx_stack = List()
    bends_stack = List()
    
    # Init Start Node
    start_nbs = get_sorted_neighbors_numba(rows, cols, grid, start_r, start_c, path, heuristic_mode)
    nbs_stack.append(start_nbs)
    idx_stack.append(0)
    bends_stack.append(0)
    
    visited_nodes = 0
    
    while len(nbs_stack) > 0:
        depth = len(nbs_stack) - 1
        current_nbs = nbs_stack[depth]
        current_idx = idx_stack[depth]
        
        # Current Head of path is path[-1]
        curr_r, curr_c = path[-1]
        current_bends = bends_stack[depth]
        
        if current_idx >= len(current_nbs):
            # Backtrack
            nbs_stack.pop()
            idx_stack.pop()
            bends_stack.pop()
            path.pop()
            continue
            
        # Try next neighbor
        nr, nc = current_nbs[current_idx]
        idx_stack[depth] = current_idx + 1 # Advance index for next time
        
        visited_nodes += 1
        if visited_nodes > max_nodes:
            return False, path # Fail
            
        # Calc constraints
        dr = nr - curr_r
        dc = nc - curr_c
        
        # Get last direction
        last_dr = 0
        last_dc = 0
        if len(path) > 1:
            pr, pc = path[-2]
            last_dr = curr_r - pr
            last_dc = curr_c - pc
            
        new_bends = current_bends
        if last_dr != 0 or last_dc != 0:
            if dr != last_dr or dc != last_dc:
                new_bends += 1
                
        if new_bends > max_bends:
            continue # Prune this neighbor
            
        # Push Node
        path.append((np.int64(nr), np.int64(nc)))
        
        # Check if Success
        path_len = len(path)
        if path_len >= min_len:
            # Check Exitable with PATH AWARENESS
            if check_raycast_numba(rows, cols, grid, nr, nc, dr, dc, path):
                 should_stop = False
                 if path_len >= max_len: should_stop = True
                 elif np.random.random() < 0.3: should_stop = True
                 
                 if should_stop:
                     return True, path
                     
        if path_len >= max_len:
            # Reached limit, backtrack immediately
            path.pop()
            continue
            
        # Generate Neighbors for new node
        new_nbs = get_sorted_neighbors_numba(rows, cols, grid, nr, nc, path, heuristic_mode)
        
        # Push to Stack
        nbs_stack.append(new_nbs)
        idx_stack.append(0)
        bends_stack.append(new_bends)
        
    return False, path
