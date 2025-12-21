import random
from .base import BaseStrategy
from ..utils import get_neighbors

class LayeredStrategy(BaseStrategy):
    # Set to False in SmartDynamicStrategy to disable bonus fill
    ENABLE_BONUS_FILL = True
    
    def generate(self, arrow_count, min_len, max_len, min_bends, max_bends):
        # Phase 1: Main Strategy Generation
        for i in range(arrow_count):
            success = False
            
            candidates = self.get_candidates()
            
            if not candidates:
                candidates = list(self.valid_cells - self.occupied)
                random.shuffle(candidates)
            elif isinstance(candidates[0], tuple) and len(candidates[0]) == 2:
                 pass
            else:
                 pass

            pool = candidates[:20] 
            
            for start_pos in pool:
                path = self.find_solvable_path(start_pos, min_len, max_len, min_bends, max_bends)
                if path:
                    self.occupied.update(path)
                    color = random.choice(self.color_list) if self.color_list else "#00FF00"
                    self.snakes.append({
                        "path": path,
                        "color": color
                    })
                    success = True
                    break
            
            if not success:
               self.log(f"Warning: Could not place Snake {i+1} (Strict Solvability Mode).")
        
        # Phase 2: Bonus Fill - Use SmartDynamic logic to fill remaining gaps
        if self.ENABLE_BONUS_FILL:
            self._bonus_fill(min_len, max_len, min_bends, max_bends)
        
        return self.get_result()

    def _bonus_fill(self, min_len, max_len, min_bends, max_bends):
        """
        Fill remaining gaps with SmartDynamic-like logic.
        Uses multi-pass approach with prioritizing SOLVABLE candidates first.
        """
        from ..utils import count_free_neighbors
        
        initial_remaining = len(self.valid_cells - self.occupied)
        initial_total = len(self.valid_cells)
        
        if initial_remaining == 0:
            return
            
        self.log(f"Bonus Fill: {initial_remaining} cells remaining. Starting smart fill...")
        
        bonus_snakes = 0
        max_bonus = 100
        
        # Passes: Standard -> Short -> Tiny
        passes = [
            (min_len, max_len, "Pass 1: Standard"),
            (2, max_len, "Pass 2: Short"),
            (2, min(4, max_len), "Pass 3: Tiny"),
        ]
        
        for pass_min, pass_max, pass_name in passes:
            if bonus_snakes >= max_bonus: break
                
            # Heuristic Loop: Keep trying as long as we find something
            # To avoid infinite loops, limit consecutive failures
            max_consecutive_misses = 20 
            misses = 0
            
            while misses < max_consecutive_misses and bonus_snakes < max_bonus:
                remaining = list(self.valid_cells - self.occupied)
                if not remaining: break
                
                # OPTIMIZATION: Prioritize candidates that are LIKELY solvable.
                # A candidate is solvable if it has a raycast to boundary/obstacle.
                # We can pre-filter or sort by distance to boundary?
                # Or just simple Shuffle to avoid getting stuck in "Deep Hole" traps.
                # Let's try shuffling first, it's robust.
                random.shuffle(remaining)
                
                # Better: Sort by "Distance from Occupied/Edge" -> Closer to "Open Space" is better?
                # Actually, simply checking `is_exitable` for 4 directions is cheap.
                # Let's prioritize cells that have AT LEAST ONE clear exit direction immediately.
                
                solvable_candidates = []
                unsolvable_candidates = []
                
                # Check a batch of candidates to find solvable starts
                batch_size = 50
                for cand in remaining[:batch_size]:
                    # Check 4 directions for immediate exit
                    has_exit = False
                    for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                        if self.is_exitable(cand, (dr, dc)):
                            has_exit = True
                            break
                    if has_exit:
                        solvable_candidates.append(cand)
                    else:
                        unsolvable_candidates.append(cand)
                
                # Combine: Solvable first
                pool = solvable_candidates + unsolvable_candidates
                
                found = False
                for start in pool[:10]: # Try top 10 from filtered pool
                    # For Bonus Fill, we want to fill VOIDS.
                    # So prioritizing neighbors that have FEW free neighbors (filling holes) 
                    # is still good for SHAPE, provided the START is good.
                    
                    old_sort = self.sort_neighbors
                    # Sort neighbors by "Constrainedness" to tightly pack
                    self.sort_neighbors = lambda nbs, path: sorted(
                        nbs, 
                        key=lambda n: count_free_neighbors(n[0], n[1], self.rows, self.cols, self.occupied | set(path)) + random.random()
                    )
                    
                    path = self.find_solvable_path(start, pass_min, pass_max, min_bends, max_bends)
                    
                    self.sort_neighbors = old_sort
                    
                    if path:
                        self.occupied.update(path)
                        color = random.choice(self.color_list) if self.color_list else "#00FF00"
                        self.snakes.append({
                            "path": path,
                            "color": color
                        })
                        bonus_snakes += 1
                        found = True
                        misses = 0 # Reset misses
                        break
                
                if not found:
                    misses += 1
                    
        if bonus_snakes > 0:
            filled = len(self.occupied) - (len(self.valid_cells) - initial_remaining)
            self.log(f"Bonus Fill Complete: Added {bonus_snakes} snakes.")

    def get_candidates(self):
        """Override this to bias start positions (e.g. Center, Edge)"""
        pool = list(self.valid_cells - self.occupied)
        random.shuffle(pool)
        return pool

    def compute_distance_map(self):
        """
        Computes BFS distance from 'Exits' (Boundary + Existing Occupied Cells)
        for all empty cells.
        Returns: Dict { (r,c): distance }
        Distance 0 = Adjacent to exit/occupied.
        High Distance = Deep inside.
        """
        dist_map = {}
        queue = []
        visited = set()
        
        # Initialize queue with all virtual "exits"
        # Cells adjacent to boundary or occupied cells have distance 1?
        # Let's say: "Exit" is distance 0.
        # Neighbors of Exit are distance 1.
        
        # Add all "Boundary Neighbors" and "Occupied Neighbors" to queue
        for r in range(self.rows):
            for c in range(self.cols):
                if (r, c) in self.occupied or (r,c) in self.obstacles_map:
                    continue
                
                # Check if it touches boundary or occupied
                is_exit_neighbor = False
                
                # Boundary check
                if r == 0 or r == self.rows-1 or c == 0 or c == self.cols-1:
                    is_exit_neighbor = True
                else:
                    # Check neighbors for occupied/obstacle obstacles are blocking?
                    # Obstacles are just like walls.
                    # Snake Occupied cells are blocking? 
                    # No, strict solvability says we can exit via snake BODY (if we assume it moves away?)
                    # Wait, our `is_exitable` raycast checks `if in self.occupied: return False`.
                    # So current logic treats occupied snakes as BLOCKS.
                    # This means we layer ON TOP.
                    # So previous snakes are effectively Walls for the new snake.
                    # So Distance Map should treat them as Walls.
                    pass
                
                if is_exit_neighbor:
                    dist_map[(r, c)] = 1
                    queue.append((r, c))
                    visited.add((r, c))

        # Run BFS
        head = 0
        while head < len(queue):
            curr = queue[head]
            head += 1
            d = dist_map[curr]
            
            for n in get_neighbors(curr[0], curr[1], self.rows, self.cols):
                if n not in visited and n not in self.occupied and n not in self.obstacles_map:
                    visited.add(n)
                    dist_map[n] = d + 1
                    queue.append(n)
                    
        return dist_map

    def find_solvable_path(self, start_pos, min_len, max_len, min_bends, max_bends):
        # DFS to find a path that is STRICTLY EXITABLE
        self.found_path = None
        self.nodes_visited = 0
        MAX_NODES = 500 # Fail fast optimization
        
        def dfs(curr, path, bends, last_dir):
            if self.found_path: return True
            
            self.nodes_visited += 1
            if self.nodes_visited > MAX_NODES: return False
            
            path_len = len(path)
            
            if path_len >= min_len:
                if self.is_exitable(curr, last_dir):
                    # Found one!
                    should_stop = False
                    if path_len >= max_len: should_stop = True
                    elif random.random() < 0.3: should_stop = True 
                    
                    if should_stop:
                        self.found_path = path
                        return True
            
            if path_len >= max_len: return False
            if bends > max_bends: return False

            nbs = get_neighbors(curr[0], curr[1], self.rows, self.cols)
            nbs = self.sort_neighbors(nbs, path)
            
            for n in nbs:
                if self.is_valid(n[0], n[1]) and n not in path:
                    new_dir = (n[0] - curr[0], n[1] - curr[1])
                    new_bends = bends
                    if last_dir and new_dir != last_dir:
                        new_bends += 1
                    
                    if new_bends <= max_bends:
                        if dfs(n, path + [n], new_bends, new_dir):
                            return True
            
            return False

        dfs(start_pos, [start_pos], 0, None)
        return self.found_path

    def is_exitable(self, curr, direction):
        if not direction: return False 
        r, c = curr
        dr, dc = direction
        
        # Project Ray
        proj_r, proj_c = r + dr, c + dc
        while 0 <= proj_r < self.rows and 0 <= proj_c < self.cols:
            # Check collision with Static Obstacles OR Other Snakes (Occupied)
            # self.occupied contains ALL previously placed snakes + impediments
            if (proj_r, proj_c) in self.occupied:
                return False
            # Also check obstacles_map explicitly if not in occupied? (occupied should have it)
            if (proj_r, proj_c) in self.obstacles_map:
                return False

            proj_r += dr
            proj_c += dc
        
        return True # Hit boundary cleanly 

    def sort_neighbors(self, nbs, current_path):
        random.shuffle(nbs)
        return nbs
