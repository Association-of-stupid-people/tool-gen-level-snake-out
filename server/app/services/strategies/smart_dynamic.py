import random
import sys
from .layered import LayeredStrategy
from ..utils import get_neighbors, count_free_neighbors

sys.setrecursionlimit(5000)


class SmartDynamicStrategy(LayeredStrategy):
    """
    Learned Strategy:
    1. Uses BFS Distance Map to identify "Deepest" available cells.
    2. Prioritizes filling deep cells first ("Inner Layers").
    3. Sorts neighbors to fill voids effectively.
    Does NOT use bonus fill - relies on smart candidate selection.
    """
    # SmartDynamic is already optimal, no bonus fill needed
    ENABLE_BONUS_FILL = False
    
    # Configurable params with defaults
    DEFAULT_CONFIG = {
        'depth_priority': 0.7,       # How much to prioritize deep cells (0-1)
        'pool_size_percent': 0.25,   # % of candidates to random from (0.1-0.5)
    }
    
    def __init__(self, rows, cols, valid_cells, obstacles_map, color_list, config=None):
        super().__init__(rows, cols, valid_cells, obstacles_map, color_list)
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        self.candidate_cache = [] # Cache for sorted candidates
        self.cache_batch_id = 0

    def get_candidates(self):
        # 0. Try to use Cache
        # Filter out occupied/invalid from cache lazily
        valid_cache = []
        batch_size = 50 # Return 50 candidates at a time
        
        while self.candidate_cache:
            cand = self.candidate_cache.pop(0)
            if cand in self.valid_cells and cand not in self.occupied and cand not in self.obstacles_map:
                valid_cache.append(cand)
                if len(valid_cache) >= batch_size:
                    return valid_cache
        
        # If we reach here, we didn't find enough valid candidates in cache.
        # Need to RECOMPUTE (Refill Cache)
        
        depth_priority = self.config['depth_priority']
        pool_size_percent = self.config['pool_size_percent']
        
        # 1. Compute Distance Map from Exits
        dist_map = self.compute_distance_map()
        
        # 2. Filter valid candidates (Iterate only reachable cells in dist_map)
        candidates = []
        for pos, dist in dist_map.items():
            if pos in self.valid_cells and pos not in self.occupied and pos not in self.obstacles_map:
                candidates.append((pos, dist))
        
        # 3. Bucket Sort by Distance
        buckets = {}
        max_dist = 0
        for pos, dist in candidates:
            if dist not in buckets: buckets[dist] = []
            buckets[dist].append(pos)
            if dist > max_dist: max_dist = dist
            
        # 4. Collect Top Candidates from Deepest Buckets
        # We want to fill the cache with MANY candidates now
        cache_limit = 1000 # Cache up to 1000 candidates
        refilled_cache = []
        
        from .. import optimized_ops 
        
        for d in range(max_dist, -1, -1):
            if d not in buckets: continue
            
            group = buckets[d]
            
            # Use Numba Optimized Count
            group.sort(key=lambda p: optimized_ops.count_free_neighbors_numba(self.rows, self.cols, self.grid_array, p[0], p[1]))
            
            refilled_cache.extend(group)
            
            if len(refilled_cache) >= cache_limit:
                break
                
        # Update self.candidate_cache
        self.candidate_cache = refilled_cache
        
        # Return the first batch from the new cache
        return self.candidate_cache[:batch_size]

    def sort_neighbors(self, nbs, current_path):
        """
        Prefer constrained neighbors (fewer free neighbors).
        This helps pack snakes tightly.
        """
        depth_priority = self.config['depth_priority']
        
        # We use Numba optimized count here.
        # Note: We pass self.grid_array which contains GLOBAL occupied cells.
        # We ignore 'current_path' in this heuristic count for speed. 
        # (It's just a sort key, perfectly fine).
        from .. import optimized_ops
        
        pool = []
        for n in nbs:
            # 1. Constrained check (Numba)
            free_n = optimized_ops.count_free_neighbors_numba(self.rows, self.cols, self.grid_array, n[0], n[1])
            
            # 2. Random noise based on depth_priority
            score = free_n * depth_priority + random.random() * (1 - depth_priority)
            pool.append((n, score))
            
        pool.sort(key=lambda x: x[1])
        return [x[0] for x in pool]
