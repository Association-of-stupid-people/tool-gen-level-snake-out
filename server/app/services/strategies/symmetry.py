import random
from .layered import LayeredStrategy
from .min_fragment import min_fragment_bonus_fill
from ..utils import get_neighbors


class SymmetricalStrategy(LayeredStrategy):
    """
    Generates symmetrical snake patterns.
    Attempts to place snakes with mirror symmetry across axis.
    Uses MIN_FRAGMENT for bonus fill.
    """
    # Disable default bonus fill, use MIN_FRAGMENT instead
    ENABLE_BONUS_FILL = False
    
    # Configurable params with defaults
    DEFAULT_CONFIG = {
        'symmetry_type': 'random',       # 'random', 'horizontal', 'vertical', 'both', 'radial'
        'strictness': 0.8,               # How strict symmetry is (0-1)
        'fallback_strategy': 'random',   # 'random', 'smart_dynamic', 'edge_hugger'
    }
    
    def __init__(self, rows, cols, valid_cells, obstacles_map, color_list, config=None):
        super().__init__(rows, cols, valid_cells, obstacles_map, color_list)
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        
        # Resolve random options
        self._resolve_random_options()
    
    def _resolve_random_options(self):
        """Resolve 'random' options to actual values"""
        symmetry_type = self.config['symmetry_type']
        if symmetry_type == 'random':
            symmetry_type = random.choice(['horizontal', 'vertical', 'both', 'radial'])
        self._symmetry_type = symmetry_type
        
        fallback = self.config['fallback_strategy']
        if fallback == 'random':
            fallback = random.choice(['smart_dynamic', 'edge_hugger'])
        self._fallback = fallback
    
    def _get_mirror_pos(self, pos):
        """Get mirrored position based on symmetry type"""
        r, c = pos
        center_r, center_c = self.rows // 2, self.cols // 2
        
        mirrors = []
        
        if self._symmetry_type in ['horizontal', 'both']:
            # Mirror across horizontal axis (flip rows)
            mirror_r = self.rows - 1 - r
            mirrors.append((mirror_r, c))
            
        if self._symmetry_type in ['vertical', 'both']:
            # Mirror across vertical axis (flip cols)
            mirror_c = self.cols - 1 - c
            mirrors.append((r, mirror_c))
            
        if self._symmetry_type == 'both':
            # Mirror across both (diagonal opposite)
            mirrors.append((self.rows - 1 - r, self.cols - 1 - c))
            
        if self._symmetry_type == 'radial':
            # 180-degree rotation around center
            mirror_r = self.rows - 1 - r
            mirror_c = self.cols - 1 - c
            mirrors.append((mirror_r, mirror_c))
        
        return mirrors
    
    def _mirror_path(self, path):
        """Create mirrored paths based on symmetry type"""
        mirrored_paths = []
        
        for pos in path:
            mirrors = self._get_mirror_pos(pos)
            for i, mirror in enumerate(mirrors):
                if i >= len(mirrored_paths):
                    mirrored_paths.append([])
                mirrored_paths[i].append(mirror)
        
        return mirrored_paths
    
    def _is_valid_for_mirror(self, path):
        """Check if mirrored paths are valid (not overlapping with occupied)"""
        mirrored_paths = self._mirror_path(path)
        
        for mpath in mirrored_paths:
            for pos in mpath:
                if pos in self.occupied or pos not in self.valid_cells:
                    return False
                if pos in path:  # Overlaps with original
                    continue  # This is OK for symmetric snakes
        
        return True
    
    def generate(self, arrow_count, min_len, max_len, min_bends, max_bends):
        # Re-resolve random options for each generate call
        self._resolve_random_options()
        
        strictness = self.config['strictness']
        
        self.log(f"Symmetrical: type={self._symmetry_type}, strictness={strictness}")
        
        # Phase 1: Try to place symmetrical snakes
        snakes_placed = 0
        target = arrow_count
        max_attempts = arrow_count * 3
        attempts = 0
        
        while snakes_placed < target and attempts < max_attempts:
            attempts += 1
            
            candidates = self.get_candidates()
            if not candidates:
                break
            
            for start_pos in candidates[:10]:
                path = self.find_solvable_path(start_pos, min_len, max_len, min_bends, max_bends)
                if path:
                    # Try to place mirrored paths
                    mirrored_paths = self._mirror_path(path)
                    all_valid = True
                    
                    # Collect all positions from original + all mirrored paths
                    path_set = set(path)
                    all_mirrored_positions = set()
                    
                    for mpath in mirrored_paths:
                        mpath_set = set(mpath)
                        
                        # Check if mirrored path is valid (not occupied, in valid cells)
                        for pos in mpath:
                            if pos in self.occupied or pos not in self.valid_cells:
                                all_valid = False
                                break
                        
                        if not all_valid:
                            break
                        
                        # Check overlap with original path (unless same snake - symmetric)
                        if mpath_set != path_set:
                            overlap_with_original = mpath_set & path_set
                            if overlap_with_original:
                                all_valid = False
                                break
                        
                        # Check overlap with other mirrored paths
                        overlap_with_mirrors = mpath_set & all_mirrored_positions
                        if overlap_with_mirrors:
                            all_valid = False
                            break
                        
                        # Check is_exitable for mirrored path (prevent stuck snakes)
                        if len(mpath) >= 2 and mpath_set != path_set:
                            mhead = mpath[-1]
                            mneck = mpath[-2]
                            m_direction = (mhead[0] - mneck[0], mhead[1] - mneck[1])
                            # Temporarily add original path + previous mirrors to check
                            temp_occupied = self.occupied | path_set | all_mirrored_positions
                            old_occupied = self.occupied
                            self.occupied = temp_occupied
                            if not self.is_exitable(mhead, m_direction):
                                all_valid = False
                            self.occupied = old_occupied
                            if not all_valid:
                                break
                        
                        all_mirrored_positions.update(mpath_set)
                    
                    if not all_valid:
                        continue  # Try next candidate
                    
                    # Place original snake
                    self.occupied.update(path)
                    color = random.choice(self.color_list) if self.color_list else "#00FF00"
                    self.snakes.append({
                        "path": path,
                        "color": color
                    })
                    snakes_placed += 1
                    
                    # Place mirrored snakes
                    for mpath in mirrored_paths:
                        if snakes_placed >= target:
                            break
                        # Skip if mpath is same as original (symmetric snake)
                        if set(mpath) == set(path):
                            continue
                        self.occupied.update(mpath)
                        self.snakes.append({
                            "path": mpath,
                            "color": color  # Same color for symmetry
                        })
                        snakes_placed += 1
                    break
        
        self.log(f"Symmetrical: placed {snakes_placed} of {target} snakes")
        
        # Phase 2: Bonus Fill with MIN_FRAGMENT
        min_fragment_bonus_fill(self, min_len, max_len, min_bends, max_bends)
        
        return self.get_result()
    
    def get_candidates(self):
        """
        Get candidates for symmetric placement.
        Prefer cells that have valid mirror positions.
        """
        candidates = []
        
        for r in range(self.rows):
            for c in range(self.cols):
                if (r, c) in self.valid_cells and (r, c) not in self.occupied:
                    # Check if mirror positions are also valid
                    mirrors = self._get_mirror_pos((r, c))
                    mirror_score = 0
                    for m in mirrors:
                        if m in self.valid_cells and m not in self.occupied:
                            mirror_score += 1
                    
                    # Prefer cells with valid mirrors
                    candidates.append(((r, c), -mirror_score))
        
        # Sort by mirror score (higher is better, so we negate)
        candidates.sort(key=lambda x: x[1])
        
        limit = max(5, int(len(candidates) * 0.2))
        pool = [x[0] for x in candidates[:limit]]
        random.shuffle(pool)
        return pool

    def sort_neighbors(self, nbs, current_path):
        """
        Prefer neighbors that maintain symmetry potential.
        """
        strictness = self.config['strictness']
        
        def score(n):
            # Check if mirror positions are valid
            mirrors = self._get_mirror_pos(n)
            mirror_score = 0
            for m in mirrors:
                if m in self.valid_cells and m not in self.occupied and m not in current_path:
                    mirror_score += 1
            
            # Higher mirror_score = lower score (better)
            return -mirror_score * strictness + random.random() * (1 - strictness)
            
        return sorted(nbs, key=score)
