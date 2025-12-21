import random
from .layered import LayeredStrategy
from .min_fragment import min_fragment_bonus_fill
from ..utils import count_free_neighbors


class MaxClumpStrategy(LayeredStrategy):
    """
    Prioritizes filling large open areas first.
    Creates long snakes that span big voids.
    Uses MIN_FRAGMENT for bonus fill.
    """
    # Disable default bonus fill, use MIN_FRAGMENT instead
    ENABLE_BONUS_FILL = False
    
    # Configurable params with defaults
    DEFAULT_CONFIG = {
        'min_area_size': 4,       # Minimum free neighbors to consider (1-10)
        'expansion_rate': 0.6,    # How aggressively to expand (0-1)
        'avoid_edges': False,     # Avoid edge cells
    }
    
    def __init__(self, rows, cols, valid_cells, obstacles_map, color_list, config=None):
        super().__init__(rows, cols, valid_cells, obstacles_map, color_list)
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
    
    def generate(self, arrow_count, min_len, max_len, min_bends, max_bends):
        # Phase 1: Main Strategy Generation
        for i in range(arrow_count):
            success = False
            
            candidates = self.get_candidates()
            
            if not candidates:
                candidates = list(self.valid_cells - self.occupied)
                random.shuffle(candidates)

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
        
        # Phase 2: Bonus Fill with MIN_FRAGMENT
        min_fragment_bonus_fill(self, min_len, max_len, min_bends, max_bends)
        
        return self.get_result()
    
    def get_candidates(self):
        min_area_size = self.config['min_area_size']
        avoid_edges = self.config['avoid_edges']
        
        candidates = []
        for r in range(self.rows):
            for c in range(self.cols):
                if (r, c) in self.valid_cells and (r, c) not in self.occupied:
                    # Count free neighbors as proxy for "open area"
                    free_n = count_free_neighbors(r, c, self.rows, self.cols, self.occupied)
                    
                    # Skip if below minimum area size
                    if free_n < min_area_size:
                        continue
                    
                    # Skip edges if configured
                    if avoid_edges:
                        dist_to_edge = min(r, self.rows - 1 - r, c, self.cols - 1 - c)
                        if dist_to_edge <= 1:
                            continue
                    
                    candidates.append(((r, c), free_n))
                     
        # Sort DESC - most free neighbors first (big open areas)
        candidates.sort(key=lambda x: x[1], reverse=True)
        
        limit = max(5, int(len(candidates) * 0.15))
        pool = [x[0] for x in candidates[:limit]]
        random.shuffle(pool)
        return pool

    def sort_neighbors(self, nbs, current_path):
        """
        Prefer neighbors with MORE free neighbors.
        Stay in open areas, fill large voids.
        """
        expansion_rate = self.config['expansion_rate']
        
        def score(n):
            free_n = count_free_neighbors(n[0], n[1], self.rows, self.cols, 
                                          self.occupied | set(current_path))
            # Higher expansion_rate = prefer more open areas
            return -free_n * expansion_rate + random.random() * (1 - expansion_rate)
            
        return sorted(nbs, key=score)
