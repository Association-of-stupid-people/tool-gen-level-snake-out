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
    
    def get_candidates(self):
        depth_priority = self.config['depth_priority']
        pool_size_percent = self.config['pool_size_percent']
        
        # 1. Compute Distance Map from Exits
        dist_map = self.compute_distance_map()
        
        # 2. Filter valid candidates (Empty cells)
        candidates = []
        for r in range(self.rows):
            for c in range(self.cols):
                if (r, c) in self.valid_cells and (r, c) not in self.occupied and (r, c) not in self.obstacles_map:
                     # Default distance 0 (if valid but near exit)
                     d = dist_map.get((r, c), 0)
                     candidates.append(((r, c), d))
        
        # 3. Sort by Distance DESC (Deepest first)
        # Secondary sort: Constrainedness (fewer free neighbors)
        def sort_key(item):
            pos, dist = item
            free_n = count_free_neighbors(pos[0], pos[1], self.rows, self.cols, self.occupied)
            # Higher distance = Better, weighted by depth_priority
            # Lower free_n = Better (more constrained)
            return (dist * 10 * depth_priority) - free_n 
            
        candidates.sort(key=sort_key, reverse=True)
        
        # 4. Return top pool with some randomness
        limit = max(5, int(len(candidates) * pool_size_percent))
        pool = [x[0] for x in candidates[:limit]]
        random.shuffle(pool)
        return pool

    def sort_neighbors(self, nbs, current_path):
        """
        Prefer constrained neighbors (fewer free neighbors).
        This helps pack snakes tightly.
        """
        depth_priority = self.config['depth_priority']
        
        pool = []
        for n in nbs:
            # 1. Constrained check
            free_n = count_free_neighbors(n[0], n[1], self.rows, self.cols, self.occupied | set(current_path))
            
            # 2. Random noise based on depth_priority
            score = free_n * depth_priority + random.random() * (1 - depth_priority)
            pool.append((n, score))
            
        pool.sort(key=lambda x: x[1])
        return [x[0] for x in pool]
