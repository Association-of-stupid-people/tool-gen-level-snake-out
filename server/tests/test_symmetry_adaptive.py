
import unittest
import numpy as np
import random
from app.services.strategies.symmetry import SymmetricalStrategy

class TestAdaptiveSymmetry(unittest.TestCase):
    def test_generate_symmetry(self):
        rows, cols = 30, 30
        # Create a grid with some valid cells
        valid_cells = set()
        for r in range(rows):
            for c in range(cols):
                valid_cells.add((r, c))
                
        # Block center to force some complexity
        occupied = set()
        occupied.add((10, 10))
        occupied.add((10, 11))
        
        obstacles = [] # Mock obstacles list
        color_list = ["#FF0000", "#00FF00"]
        
        # Test 'both' symmetry (most complex)
        config = {
            'symmetry_type': 'both',
            'strictness': 1.0,
            'fallback_strategy': 'random'
        }
        
        strategy = SymmetricalStrategy(rows, cols, valid_cells, occupied, color_list, config)
        
        # Try to generate 8 snakes (4 pairs) on 30x30
        result = strategy.generate(8, 5, 10, 0, 5)
        
        snakes = result['snakes']
        print(f"Generated {len(snakes)} snakes using Adaptive Symmetry")
        
        # Basic Validation
        self.assertTrue(len(snakes) > 0, "Should generate at least some snakes")
        
        # Check validity
        for s in snakes:
            path = s['path']
            self.assertTrue(len(path) >= 5, "Snake should be min length")
            # Check collisions
            path_set = set(path)
            self.assertTrue(path_set.issubset(valid_cells), "Path must be in valid cells")

if __name__ == '__main__':
    unittest.main()
