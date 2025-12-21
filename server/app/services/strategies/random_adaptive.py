import random
from .layered import LayeredStrategy


class RandomAdaptiveStrategy(LayeredStrategy):
    """
    Pure random selection but with strict solvability.
    Good as fallback or for creating varied patterns.
    """
    # Uses default bonus fill from LayeredStrategy
    ENABLE_BONUS_FILL = True
    
    # Configurable params with defaults
    DEFAULT_CONFIG = {
        'prefer_edges': False,    # Prefer starting from edges
        'avoid_corners': False,   # Avoid corner cells
    }
    
    def __init__(self, rows, cols, valid_cells, obstacles_map, color_list, config=None):
        super().__init__(rows, cols, valid_cells, obstacles_map, color_list)
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}

    def get_candidates(self):
        prefer_edges = self.config['prefer_edges']
        avoid_corners = self.config['avoid_corners']
        
        pool = list(self.valid_cells - self.occupied)
        
        if avoid_corners:
            # Remove corner cells
            corners = [
                (0, 0),
                (0, self.cols - 1),
                (self.rows - 1, 0),
                (self.rows - 1, self.cols - 1)
            ]
            pool = [p for p in pool if p not in corners]
        
        if prefer_edges:
            # Sort by distance to edge (closer = better)
            def edge_score(pos):
                r, c = pos
                return min(r, self.rows - 1 - r, c, self.cols - 1 - c)
            
            pool.sort(key=edge_score)
            # Add some randomness to avoid being too predictable
            if len(pool) > 10:
                top = pool[:10]
                random.shuffle(top)
                pool = top + pool[10:]
        else:
            random.shuffle(pool)
        
        return pool
