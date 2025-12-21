import random
from .layered import LayeredStrategy
from .min_fragment import min_fragment_bonus_fill


class EdgeHuggerStrategy(LayeredStrategy):
    """
    Snakes hug the edges/walls tightly.
    Snake paths follow the perimeter and walls.
    Uses MIN_FRAGMENT for bonus fill.
    """
    # Disable default bonus fill, use MIN_FRAGMENT instead
    ENABLE_BONUS_FILL = False
    
    # Configurable params with defaults
    DEFAULT_CONFIG = {
        'edge_distance_max': 2,       # Max distance from edge (0-5)
        'corner_priority': True,      # Prioritize corners first
        'wall_follow_strength': 0.8,  # How strongly to follow walls (0-1)
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
        edge_distance_max = self.config['edge_distance_max']
        corner_priority = self.config['corner_priority']
        
        candidates = []
        for r in range(self.rows):
            for c in range(self.cols):
                if (r, c) in self.valid_cells and (r, c) not in self.occupied:
                    # Distance to nearest edge
                    dist = min(r, self.rows - 1 - r, c, self.cols - 1 - c)
                    
                    # Only consider cells within edge_distance_max
                    if dist <= edge_distance_max:
                        # Corner bonus (corners have 2 edges nearby)
                        is_corner = (r <= edge_distance_max or r >= self.rows - 1 - edge_distance_max) and \
                                   (c <= edge_distance_max or c >= self.cols - 1 - edge_distance_max)
                        
                        # Lower score = higher priority
                        score = dist
                        if corner_priority and is_corner:
                            score -= 10  # Prioritize corners
                        
                        candidates.append(((r, c), score))
        
        # Sort ASC - closest to edge first, corners prioritized
        candidates.sort(key=lambda x: x[1])
        
        limit = max(5, int(len(candidates) * 0.3))
        pool = [x[0] for x in candidates[:limit]]
        random.shuffle(pool)
        return pool
        
    def sort_neighbors(self, nbs, current_path):
        """
        Prefer neighbors that are also near edges.
        Creates snakes that trace along walls.
        """
        wall_follow_strength = self.config['wall_follow_strength']
        
        def score(n):
            dist = min(n[0], self.rows - 1 - n[0], n[1], self.cols - 1 - n[1])
            # Apply wall follow strength
            return dist * wall_follow_strength + random.random() * (1 - wall_follow_strength)
            
        return sorted(nbs, key=score)
