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
        
        # Phase 1: Try to place symmetrical snakes using ADAPTIVE JOINT STEP
        snakes_placed = 0
        target = arrow_count
        max_attempts = arrow_count * 5 # Allow more attempts for complex joint generation
        attempts = 0
        
        while snakes_placed < target and attempts < max_attempts:
            attempts += 1
            
            candidates = self.get_candidates()
            if not candidates:
                break
            
            # Try candidates
            path_found = False
            for start_pos in candidates[:5]: # Try a few top candidates
                # Identify mirrors for start_pos
                mirror_starts = self._get_mirror_pos(start_pos)
                
                # Verify start and mirror starts are valid
                if not self._are_positions_valid([start_pos] + mirror_starts):
                    continue
                    
                # Attempt to find JOINT path
                result = self.find_adaptive_symmetric_path(
                    start_pos, mirror_starts, min_len, max_len, min_bends, max_bends
                )
                
                if result:
                    path_a, path_mirrors = result
                    
                    # Place Original
                    self._place_snake(path_a)
                    snakes_placed += 1
                    
                    # Place Mirrors
                    color = self.snakes[-1]['color'] # Match color
                    for m_path in path_mirrors:
                         if snakes_placed >= target: break
                         # Check if identical (e.g. center snake in odd grid)
                         if set(m_path) == set(path_a): continue
                         
                         # Check against other placed mirrors to avoid duplicates in radial/both modes
                         is_duplicate = False
                         for existing_s in self.snakes[-len(path_mirrors):]: # Check recent snakes
                             if set(existing_s['path']) == set(m_path):
                                 is_duplicate = True
                                 break
                         if is_duplicate: continue

                         self._place_snake(m_path, color)
                         snakes_placed += 1
                         
                    path_found = True
                    break # Success for this iteration
            
            if not path_found:
                # If we fail to place symmetric snakes, maybe try a fallback or just skip
                pass

        self.log(f"Symmetrical: placed {snakes_placed} of {target} snakes")
        
        # Phase 2: Bonus Fill with MIN_FRAGMENT
        min_fragment_bonus_fill(self, min_len, max_len, min_bends, max_bends)
        
        return self.get_result()

    def _are_positions_valid(self, positions):
        """Check if a list of positions are all valid and unoccupied."""
        for p in positions:
            if p not in self.valid_cells or p in self.occupied:
                return False
        # Check for conflicts within the list setup (e.g. overlapping starts)
        if len(positions) != len(set(positions)):
            # Overlapping start positions mean the snakes starts on top of each other.
            # This is only valid if they are the SAME snake (e.g. center of self-symmetry),
            # but current logic treats them as separate entities growing apart.
            # For simplicity, distinct starts are safer for now unless we handle self-intersecting symmetry.
            return False 
        return True

    def _place_snake(self, path, color=None):
        self.occupied.update(path)
        for r, c in path: self.grid_array[r, c] = 1
        if color is None:
            color = random.choice(self.color_list) if self.color_list else "#00FF00"
        self.snakes.append({
            "path": path,
            "color": color
        })

    def find_adaptive_symmetric_path(self, start_a, starts_mirrors, min_len, max_len, min_bends, max_bends):
        """
        Generates path for A and its Mirrors simultaneously step-by-step.
        Fallback: If strict mirror move is blocked, try other valid neighbors for mirror.
        """
        stack = []
        # State: (path_a, [path_m1, path_m2...], bends_a, [bends_m1...])
        initial_mirrors = [[m] for m in starts_mirrors]
        stack.append(([start_a], initial_mirrors, 0, [0] * len(starts_mirrors)))
        
        max_nodes = 3000 # Increased for complex branching
        nodes_visited = 0
        
        from ..utils import get_neighbors
        
        while stack:
            nodes_visited += 1
            if nodes_visited > max_nodes: break
            
            path_a, paths_mirrors, bends_a, bends_mirrors = stack.pop()
            
            curr_a = path_a[-1]
            path_len = len(path_a)
            
            # --- CHECK SUCCESS ---
            if path_len >= min_len:
                # Validate Exitable for A
                head_a = path_a[-1]; neck_a = path_a[-2]
                dir_a = (head_a[0] - neck_a[0], head_a[1] - neck_a[1])
                
                # Exitable check using Numba directly to support 'path' exclusion
                # OPTIMIZATION: Combine all current partial paths into a TEMP GRID
                # and pass that to Numba. Passing 'path' list triggers slow Numba reflection.
                from .. import optimized_ops
                
                # Create mask
                temp_grid = self.grid_array.copy()
                
                # Mark path A
                for pr, pc in path_a: temp_grid[pr, pc] = 1
                # Mark mirrors
                for pm in paths_mirrors:
                     for pr, pc in pm: temp_grid[pr, pc] = 1
                
                # Check A
                if not optimized_ops.check_raycast_numba(self.rows, self.cols, temp_grid, head_a[0], head_a[1], dir_a[0], dir_a[1], None):
                    pass # Fail
                else:
                    # Check Mirrors exitability
                    all_mirrors_ok = True
                    for i, pm in enumerate(paths_mirrors):
                        hm = pm[-1]; nm = pm[-2]
                        dm = (hm[0] - nm[0], hm[1] - nm[1])
                        
                        if not optimized_ops.check_raycast_numba(self.rows, self.cols, temp_grid, hm[0], hm[1], dm[0], dm[1], None):
                            all_mirrors_ok = False
                            break
                    
                    if all_mirrors_ok:
                        should_stop = False
                        if path_len >= max_len: should_stop = True
                        elif random.random() < 0.2: should_stop = True
                        
                        if should_stop:
                            return path_a, paths_mirrors

            if path_len >= max_len: continue

            # --- GENERATE NEXT STEPS ---
            
            # 1. Get Neighbors for A
            raw_nbs_a = get_neighbors(curr_a[0], curr_a[1], self.rows, self.cols)
            # Filter Valid A Neighbors (not in global occupied, not in own path, not in ANY mirror path)
            # Collision check: A bumping into Mirrors
            current_mirror_cells = set()
            for pm in paths_mirrors: current_mirror_cells.update(pm)
            
            valid_nbs_a = []
            for n in raw_nbs_a:
                if (n in self.valid_cells and 
                    n not in self.occupied and 
                    n not in path_a and 
                    n not in current_mirror_cells):
                    valid_nbs_a.append(n)
            
            random.shuffle(valid_nbs_a) # Randomize A's choices
            
            for next_a in valid_nbs_a:
                # Calc Bends A
                new_bends_a = bends_a
                if len(path_a) > 1:
                    prev_a = path_a[-2]
                    d1 = (curr_a[0] - prev_a[0], curr_a[1] - prev_a[1])
                    d2 = (next_a[0] - curr_a[0], next_a[1] - curr_a[1])
                    if d1 != d2: new_bends_a += 1
                if new_bends_a > max_bends: continue

                # Now try to find move for EACH Mirror
                new_paths_mirrors = []
                new_bends_mirrors = []
                possible_branch = True
                
                # Temp set for collision check within this step (Mirror B vs Mirror C)
                step_occupied = set([next_a]) 
                
                # Pre-calculate all mirror bodies for fast lookup
                # (current_mirror_cells was calculated above for A, can reuse if accessible or re-do)
                all_mirrors_set = set()
                for p in paths_mirrors: all_mirrors_set.update(p)
                
                for i, pm in enumerate(paths_mirrors):
                    curr_m = pm[-1]
                    
                    # Ideal Mirror Move (Strict Symmetry)
                    ideal_mirror_pos = self._calculate_ideal_mirror_next(curr_a, next_a, curr_m, i, start_a, initial_mirrors[i][0])
                    
                    # Candidates for Mirror: Priority [Ideal, Random Others...]
                    m_candidates = []
                    
                    # Get all valid neighbors for this mirror head
                    raw_nbs_m = get_neighbors(curr_m[0], curr_m[1], self.rows, self.cols)
                    valid_nbs_m = []
                    for nm in raw_nbs_m:
                        if (nm in self.valid_cells and 
                            nm not in self.occupied and 
                            nm not in pm and 
                            nm not in path_a and # Mirror bumping into A
                            nm not in all_mirrors_set and # Mirror bumping into OTHER mirrors (body)
                            nm not in step_occupied): # Mirror bumping into A-next or previous Mirrors-next
                            valid_nbs_m.append(nm)
                            
                    if ideal_mirror_pos in valid_nbs_m:
                        # Ideal is valid, put it first!
                        m_candidates.append(ideal_mirror_pos)
                        # Remove it from the others list to avoid duplicates
                        valid_nbs_m.remove(ideal_mirror_pos)
                    
                    # Add others (Adaptive Fallback)
                    random.shuffle(valid_nbs_m)
                    m_candidates.extend(valid_nbs_m)
                    
                    # Try to pick ONE valid move for this mirror
                    chosen_m = None
                    chosen_bends_m = 0
                    
                    for cand_m in m_candidates:
                        # Check Bends
                        nb_m = bends_mirrors[i]
                        if len(pm) > 1:
                            prev_m = pm[-2]
                            md1 = (curr_m[0] - prev_m[0], curr_m[1] - prev_m[1])
                            md2 = (cand_m[0] - curr_m[0], cand_m[1] - curr_m[1])
                            if md1 != md2: nb_m += 1
                        
                        if nb_m <= max_bends:
                            chosen_m = cand_m
                            chosen_bends_m = nb_m
                            break # Found a valid move for this mirror
                    
                    if chosen_m:
                        new_paths_mirrors.append(pm + [chosen_m])
                        new_bends_mirrors.append(chosen_bends_m)
                        step_occupied.add(chosen_m)
                    else:
                        possible_branch = False
                        break # One mirror stuck -> Entire branch fails
                
                if possible_branch:
                    # Push successful joint step
                    stack.append((path_a + [next_a], new_paths_mirrors, new_bends_a, new_bends_mirrors))
                    
        return None

    def _calculate_ideal_mirror_next(self, prev_a, curr_a, prev_m, mirror_index, start_a, start_m):
        """
        Calculates where the mirror 'should' go to maintain perfect symmetry.
        This relies on the relative vector from previous step.
        """
        dr = curr_a[0] - prev_a[0]
        dc = curr_a[1] - prev_a[1]
        
        # Determine symmetry logic based on config type
        # Or simpler: Deduce relationship from starts (Robust)
        # Relationship: Start_M is Transform(Start_A). 
        # So Next_M should be Transform(Next_A).
        
        # Logic: 
        # Horizontal (Row Flip): dr' = -dr, dc' = dc
        # Vertical (Col Flip):   dr' = dr,  dc' = -dc
        # Both/Radial:           dr' = -dr, dc' = -dc
        
        # Detecting relation from starts is tricky if starts are same (center).
        # We rely on self._symmetry_type resolved in __init__
        
        target_dr =0
        target_dc = 0
        
        if self._symmetry_type == 'horizontal':
             target_dr = -dr; target_dc = dc
        elif self._symmetry_type == 'vertical':
             target_dr = dr; target_dc = -dc
        elif self._symmetry_type in ['both', 'radial']:
             target_dr = -dr; target_dc = -dc
             
        # Handling the composite 'both' correctly relative to the specific mirror instance
        # if there are multiple mirrors (e.g. 4-way symmetry support in future)
        # For now _get_mirror_pos returns a list.
        # If type is 'both', it returns 1 mirror (Diagonal).
        # Wait, _get_mirror_pos implementation:
        # horizontal -> 1 mirror
        # vertical -> 1 mirror
        # both -> 1 mirror (diagonal) -- Wait, standard 'both' implies 4 way? 
        # Looking at _get_mirror_pos:
        # if 'horizontal' or 'both': append horiz_mirror
        # if 'vertical' or 'both': append vert_mirror
        # if 'both': append diag_mirror
        # So 'both' generates 3 mirrors.
        
        # We need to match the specific mirror index to know which transform to apply.
        # This is slightly implicit order dependency on _get_mirror_pos.
        
        # Order in _get_mirror_pos:
        # 1. Horizontal (if horiz or both)
        # 2. Vertical (if vert or both)
        # 3. Diagonal (if both)
        # 4. Radial (if radial) -> 1 mirror
        
        st = self._symmetry_type
        
        if st == 'horizontal':
            target_dr = -dr; target_dc = dc
        elif st == 'vertical':
             target_dr = dr; target_dc = -dc
        elif st == 'radial':
             target_dr = -dr; target_dc = -dc
        elif st == 'both':
            # Index 0: Horizontal
            # Index 1: Vertical
            # Index 2: Diagonal
            if mirror_index == 0: # Horiz
                target_dr = -dr; target_dc = dc
            elif mirror_index == 1: # Vert
                target_dr = dr; target_dc = -dc
            elif mirror_index == 2: # Diag
                target_dr = -dr; target_dc = -dc
                
        return (prev_m[0] + target_dr, prev_m[1] + target_dc)
