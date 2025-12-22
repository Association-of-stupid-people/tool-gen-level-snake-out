
import unittest
import numpy as np
from app.services.strategies.symmetry import SymmetricalStrategy

class TestSymmetryCollisions(unittest.TestCase):
    def test_overlap_collisions(self):
        # 4-way symmetry on a small grid increases collision likelihood
        rows, cols = 10, 10
        valid_cells = set((r, c) for r in range(rows) for c in range(cols))
        occupied = set()
        
        # 'radial' or 'both' creates multiple mirrors that can cross
        config = {
            'symmetry_type': 'both', # 4 snakes (A + 3 Mirrors)
            'strictness': 0.5,       # Allow adaptive moves (more chaos)
            'fallback_strategy': 'random'
        }
        
        strategy = SymmetricalStrategy(rows, cols, valid_cells, occupied, [], config)
        
        # Use generate() to test full integration
        # Generate 4 snakes (1 set of 4)
        # Run multiple iterations to catch probabilistic failures
        for i in range(50):
            # Reset occupied for clean run each time (logic-wise, but here we reuse strategy instance)
            # Actually generate() accumulates snakes. We should make new strategy each time or clear it.
            strategy = SymmetricalStrategy(rows, cols, valid_cells, set(), [], config)
            
            result = strategy.generate(4, 4, 8, 0, 10)
            snakes = result['snakes']
            
            # Check for ANY overlap among ALL snakes
            all_cells = []
            for s in snakes:
                all_cells.extend(s['path'])
            
            if len(set(all_cells)) < len(all_cells):
                print(f"COLLISION DETECTED in Iteration {i}!")
                for s in snakes:
                    print(f"Snake: {s['path']}")
                self.fail("Snakes overlap with each other!")
                
        print("Collision Integration Test Passed (50 iterations)")

if __name__ == '__main__':
    unittest.main()
