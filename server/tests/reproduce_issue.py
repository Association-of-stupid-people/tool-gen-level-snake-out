
import numpy as np
from app.services.strategies.base import BaseStrategy
from app.services.optimized_ops import check_raycast_numba

def reproduce_raycast_void_issue():
    # Setup grid with void
    rows, cols = 10, 10
    grid = np.full((rows, cols), 2, dtype=np.int8) # Void = 2
    
    # Create playable area
    grid[2:8, 2:8] = 0
    
    # Test Raycast
    # Center = 5,5
    # Dir = Right (0, 1)
    
    # Old behavior (before fix): Hitting '2' returned SUCCESS instantly.
    # New behavior: Must traverse '2' until boundary.
    
    success = check_raycast_numba(rows, cols, grid, 5, 5, 0, 1, None)
    print(f"Raycast Success: {success}")

if __name__ == "__main__":
    reproduce_raycast_void_issue()
