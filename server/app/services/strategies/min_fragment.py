import random
from .layered import LayeredStrategy
from ..utils import count_free_neighbors, get_neighbors


class MinFragmentStrategy(LayeredStrategy):
    """
    Helper strategy for bonus fill.
    Prioritizes cleaning up small holes first.
    Creates short snakes that fill isolated cells.
    """
    # This is a helper, doesn't need its own bonus fill
    ENABLE_BONUS_FILL = False
    
    def get_candidates(self):
        candidates = []
        for r in range(self.rows):
            for c in range(self.cols):
                if (r, c) in self.valid_cells and (r, c) not in self.occupied:
                    free_n = count_free_neighbors(r, c, self.rows, self.cols, self.occupied)
                    candidates.append(((r, c), free_n))
                     
        # Sort ASC - fewest free neighbors first (small holes/corners)
        candidates.sort(key=lambda x: x[1])
        
        limit = max(5, int(len(candidates) * 0.2))
        pool = [x[0] for x in candidates[:limit]]
        random.shuffle(pool)
        return pool

    def sort_neighbors(self, nbs, current_path):
        """
        Prefer neighbors with FEWER free neighbors.
        Hug walls and fill corners.
        """
        def score(n):
            free_n = count_free_neighbors(n[0], n[1], self.rows, self.cols, 
                                          self.occupied | set(current_path))
            return free_n + random.random() * 0.5
            
        return sorted(nbs, key=score)


def _min_fragment_sort_neighbors(strategy, nbs, current_path):
    """Helper to sort neighbors using MinFragment logic - fill holes first."""
    def score(n):
        free_n = count_free_neighbors(n[0], n[1], strategy.rows, strategy.cols, 
                                      strategy.occupied | set(current_path))
        return free_n + random.random() * 0.3
    return sorted(nbs, key=score)


def min_fragment_bonus_fill(strategy, min_len, max_len, min_bends, max_bends):
    """
    Bonus fill function using MinFragment logic.
    KEEPS is_exitable check to ensure snakes are solvable.
    Uses smarter candidate selection to find cells that CAN exit.
    """
    initial_remaining = len(strategy.valid_cells - strategy.occupied)
    
    if initial_remaining == 0:
        return
        
    strategy.log(f"MIN_FRAGMENT Bonus Fill: {initial_remaining} cells remaining...")
    
    bonus_snakes = 0
    max_bonus = 200
    
    # Store original sort function
    original_sort = strategy.sort_neighbors
    
    # Override with MinFragment sorting for tighter packing
    strategy.sort_neighbors = lambda nbs, path: _min_fragment_sort_neighbors(strategy, nbs, path)
    
    # Passes: Standard -> Short -> Tiny
    passes = [
        (min_len, max_len, "Pass 1: Standard"),
        (2, max_len, "Pass 2: Short"),
        (2, min(4, max_len), "Pass 3: Tiny"),
    ]
    
    for pass_min, pass_max, pass_name in passes:
        if bonus_snakes >= max_bonus:
            break
            
        max_consecutive_misses = 40  # Higher tolerance
        misses = 0
        
        while misses < max_consecutive_misses and bonus_snakes < max_bonus:
            remaining = list(strategy.valid_cells - strategy.occupied)
            if not remaining:
                break
            
            # SMART CANDIDATE SELECTION:
            # 1. Score each cell by: fewest free neighbors (small holes) + has exit potential
            candidates = []
            for pos in remaining:
                free_n = count_free_neighbors(pos[0], pos[1], strategy.rows, strategy.cols, strategy.occupied)
                
                # Check if this cell has ANY clear exit direction
                has_exit = False
                for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                    if strategy.is_exitable(pos, (dr, dc)):
                        has_exit = True
                        break
                
                # Score: prioritize cells WITH exits and few free neighbors
                # Has exit = 0, No exit = 100 (penalty)
                exit_penalty = 0 if has_exit else 100
                score = free_n + exit_penalty
                
                candidates.append((pos, score, has_exit))
            
            # Sort by score (lower = better)
            candidates.sort(key=lambda x: x[1])
            
            # Take top candidates that have exits FIRST
            exit_pool = [x[0] for x in candidates if x[2]][:20]
            no_exit_pool = [x[0] for x in candidates if not x[2]][:10]
            
            pool = exit_pool + no_exit_pool
            random.shuffle(pool[:len(exit_pool)])  # Shuffle within exit pool
            
            if not pool:
                break
            
            found = False
            for start in pool:
                # Use strategy's find_solvable_path (which checks is_exitable)
                path = strategy.find_solvable_path(start, pass_min, pass_max, min_bends, max_bends)
                
                if path:
                    strategy.occupied.update(path)
                    color = random.choice(strategy.color_list) if strategy.color_list else "#00FF00"
                    strategy.snakes.append({
                        "path": path,
                        "color": color
                    })
                    bonus_snakes += 1
                    found = True
                    misses = 0
                    break
            
            if not found:
                misses += 1
    
    # Restore original sort function
    strategy.sort_neighbors = original_sort
                
    if bonus_snakes > 0:
        final_remaining = len(strategy.valid_cells - strategy.occupied)
        strategy.log(f"MIN_FRAGMENT Bonus Fill Complete: Added {bonus_snakes} snakes. {final_remaining} cells remaining.")
    else:
        strategy.log("MIN_FRAGMENT Bonus Fill: No additional snakes could be placed.")
