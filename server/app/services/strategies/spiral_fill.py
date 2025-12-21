import random
from .layered import LayeredStrategy
from .min_fragment import min_fragment_bonus_fill


class SpiralFillStrategy(LayeredStrategy):
    """
    Snakes spiral outward from center in a CLOCKWISE or COUNTER_CLOCKWISE pattern.
    The snake PATH itself wraps around like a true spiral.
    Uses MIN_FRAGMENT for bonus fill.
    """
    # Disable default bonus fill, use MIN_FRAGMENT instead
    ENABLE_BONUS_FILL = False
    
    # Direction cycles
    CLOCKWISE = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # Right → Down → Left → Up
    COUNTER_CLOCKWISE = [(0, 1), (-1, 0), (0, -1), (1, 0)]  # Right → Up → Left → Down
    
    # Configurable params with defaults
    DEFAULT_CONFIG = {
        'direction': 'random',     # 'random', 'clockwise', 'counter_clockwise'
        'start_from': 'random',    # 'random', 'center', 'corner'
        'tightness': 0.7,          # How tight the spiral is (0-1)
    }
    
    def __init__(self, rows, cols, valid_cells, obstacles_map, color_list, config=None):
        super().__init__(rows, cols, valid_cells, obstacles_map, color_list)
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        
        # Resolve random options
        self._resolve_random_options()
    
    def _resolve_random_options(self):
        """Resolve 'random' options to actual values"""
        direction = self.config['direction']
        if direction == 'random':
            direction = random.choice(['clockwise', 'counter_clockwise'])
        self._direction = direction
        
        start_from = self.config['start_from']
        if start_from == 'random':
            start_from = random.choice(['center', 'corner'])
        self._start_from = start_from
        
        # Set direction cycle
        self._dir_cycle = self.CLOCKWISE if self._direction == 'clockwise' else self.COUNTER_CLOCKWISE
    
    def generate(self, arrow_count, min_len, max_len, min_bends, max_bends):
        # Re-resolve random options for each generate call
        self._resolve_random_options()
        
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
        candidates = []
        
        if self._start_from == 'center':
            # Start from center, expand outward
            center_r, center_c = self.rows // 2, self.cols // 2
            
            for r in range(self.rows):
                for c in range(self.cols):
                    if (r, c) in self.valid_cells and (r, c) not in self.occupied:
                        dist = abs(r - center_r) + abs(c - center_c)
                        candidates.append(((r, c), dist))
            
            # Sort ASC - start from CENTER
            candidates.sort(key=lambda x: x[1])
        else:  # corner
            # Start from corners
            corners = [
                (0, 0),
                (0, self.cols - 1),
                (self.rows - 1, 0),
                (self.rows - 1, self.cols - 1)
            ]
            
            for r in range(self.rows):
                for c in range(self.cols):
                    if (r, c) in self.valid_cells and (r, c) not in self.occupied:
                        # Distance to nearest corner
                        dist = min(abs(r - cr) + abs(c - cc) for cr, cc in corners)
                        candidates.append(((r, c), dist))
            
            # Sort ASC - start from corners
            candidates.sort(key=lambda x: x[1])
        
        limit = max(5, int(len(candidates) * 0.15))
        pool = [x[0] for x in candidates[:limit]]
        random.shuffle(pool)
        return pool

    def sort_neighbors(self, nbs, current_path):
        """
        Enforce spiral pattern:
        - Prefer the NEXT direction in cycle order
        - If can't turn, continue straight
        - Avoid turning opposite direction
        """
        tightness = self.config['tightness']
        
        if len(current_path) < 2:
            # Initial direction: start going RIGHT
            def score(n):
                if n[1] > current_path[-1][1]:
                    return -100
                return random.random()
            return sorted(nbs, key=score)
            
        curr = current_path[-1]
        prev = current_path[-2]
        last_dir = (curr[0] - prev[0], curr[1] - prev[1])
        
        # Find current direction index in cycle
        try:
            dir_idx = self._dir_cycle.index(last_dir)
        except ValueError:
            dir_idx = 0
        
        # Next direction in cycle (turn)
        next_turn_dir = self._dir_cycle[(dir_idx + 1) % 4]
        # Same direction (go straight)
        same_dir = last_dir
        # Opposite direction (avoid)
        opposite_dir = self._dir_cycle[(dir_idx + 2) % 4]
        
        def score(n):
            new_dir = (n[0] - curr[0], n[1] - curr[1])
            
            base_score = random.random() * (1 - tightness)
            
            # BEST: Turn in cycle direction (spiral)
            if new_dir == next_turn_dir:
                return -100 * tightness + base_score
            # GOOD: Continue straight
            elif new_dir == same_dir:
                return -50 * tightness + base_score
            # BAD: Turn opposite direction
            elif new_dir == opposite_dir:
                return 100 + base_score
            # WORST: Go backwards
            else:
                return 200 + base_score
                
        return sorted(nbs, key=score)
