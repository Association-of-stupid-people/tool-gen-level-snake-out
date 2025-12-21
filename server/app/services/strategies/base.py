from abc import ABC, abstractmethod
import random

class BaseStrategy(ABC):
    def __init__(self, rows, cols, valid_cells, obstacles_map, color_list):
        self.rows = rows
        self.cols = cols
        self.valid_cells = valid_cells # set of (r, c)
        self.obstacles_map = obstacles_map
        self.color_list = color_list
        self.occupied = set()
        self.snakes = []
        self.logs = []
        
        # Initialize NumPy Grid for Optimization
        import numpy as np
        # 0 = Free, 1 = Blocked/Invalid
        self.grid_array = np.ones((rows, cols), dtype=np.int8)
        
        # Set valid cells to 0 (Free)
        for r, c in valid_cells:
            self.grid_array[r, c] = 0
            
        # Set obstacles to 1 (Blocked)
        for r in obstacles_map:
            self.grid_array[r[0], r[1]] = 1

    @abstractmethod
    def generate(self, arrow_count, min_len, max_len, min_bends, max_bends):
        """
        Core logic to generate snakes.
        Should populate self.snakes and self.logs.
        return: { snake_list, logs } (or just use self properties)
        """
        pass

    def is_valid(self, r, c):
        return (0 <= r < self.rows and 
                0 <= c < self.cols and 
                (r, c) in self.valid_cells and 
                (r, c) not in self.occupied)

    def log(self, message):
        self.logs.append(message)
        
    def get_result(self):
        return {
            "snakes": self.snakes,
            "logs": self.logs,
            "occupied": self.occupied
        }
