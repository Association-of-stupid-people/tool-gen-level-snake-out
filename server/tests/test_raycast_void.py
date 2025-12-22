
import unittest
import numpy as np
from app.services.optimized_ops import check_raycast_numba

class TestRaycastVoid(unittest.TestCase):
    def test_raycast_traverses_void(self):
        rows, cols = 10, 10
        # Initialize with Void (2) by default
        grid = np.full((rows, cols), 2, dtype=np.int8)
        
        # Valid area in center (0)
        # 0 0 0
        # 0 0 0
        grid[4:7, 4:7] = 0
        
        # Scenario 1: Raycast from valid area (5,5) through Void (2) to Edge -> Should be TRUE
        # (Going Right)
        # 5,5 (0) -> 5,6 (0) -> 5,7 (2) -> 5,8 (2) -> 5,9 (2) -> Edge
        self.assertTrue(check_raycast_numba(rows, cols, grid, 5, 5, 0, 1, None), 
                        "Raycast should traverse pure void to edge successfully")

        # Scenario 2: Raycast from valid area through Void (2) hitting an Obstacle (1) -> Should be FALSE
        # Place obstacle at 5, 8
        grid[5, 8] = 1
        # 5,5 (0) -> ... -> 5,7 (2) -> 5,8 (1/Blocked)
        self.assertFalse(check_raycast_numba(rows, cols, grid, 5, 5, 0, 1, None),
                         "Raycast should be blocked by obstacle inside void")
                         
        print("Raycast Traverse Void Tests Passed")

if __name__ == '__main__':
    unittest.main()
