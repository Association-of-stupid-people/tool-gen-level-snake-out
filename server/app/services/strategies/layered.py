import random
from .base import BaseStrategy

from ..utils import get_neighbors
from .. import optimized_ops # Import Numba ops

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
                    for r, c in path: self.grid_array[r, c] = 1 # Sync Grid Array
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
        
        # Passes: Standard -> Standard (Retry)
        # User requested strict adherence to min_len.
        passes = [
            (min_len, max_len, "Pass 1: Standard"),
            (min_len, max_len, "Pass 2: Review"),
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
                    # Use Numba Optimized Count
                    self.sort_neighbors = lambda nbs, path: sorted(
                        nbs, 
                        key=lambda n: optimized_ops.count_free_neighbors_numba(self.rows, self.cols, self.grid_array, n[0], n[1]) + random.random()
                    )
                    
                    path = self.find_solvable_path(start, pass_min, pass_max, min_bends, max_bends)
                    
                    self.sort_neighbors = old_sort
                    
                    if path:
                        self.occupied.update(path)
                        for r, c in path: self.grid_array[r, c] = 1 # Sync Grid Array
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
        Computes BFS distance from 'Exits' using Numba optimization.
        """
        # 1. Run BFS via Numba (Fast C-speed)
        dist_arr = optimized_ops.bfs_dist_map_numba(self.rows, self.cols, self.grid_array)
        
        # 2. Convert Array back to Dict for legacy compatibility
        # (Optimizing SmartDynamic to use Array directly would be even faster)
        dist_map = {}
        for r in range(self.rows):
            for c in range(self.cols):
                 d = dist_arr[r, c]
                 if d != -1:
                     dist_map[(r, c)] = d
        return dist_map

    # _check_and_add_exit is no longer needed with Numba logic

    def find_solvable_path(self, start_pos, min_len, max_len, min_bends, max_bends, heuristic_mode=0):
        # Delegate to Numba DFS (Ultra Fast)
        success, path = optimized_ops.dfs_numba(
            self.rows, self.cols, self.grid_array, 
            start_pos[0], start_pos[1], 
            min_len, max_len, min_bends, max_bends, 
            max_nodes=1000, # Increased limit since it's fast now
            heuristic_mode=heuristic_mode
        )
        
        if success:
            return path
        return None

    def is_exitable(self, curr, direction):
        if not direction: return False 
        r, c = curr
        dr, dc = direction
        # Numba Raycast
        return optimized_ops.check_raycast_numba(self.rows, self.cols, self.grid_array, r, c, dr, dc) 

    def sort_neighbors(self, nbs, current_path):
        random.shuffle(nbs)
        return nbs
