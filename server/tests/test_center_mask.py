"""Test script to verify mask centering fix."""
import sys
sys.path.insert(0, '.')
from app.services.image_processor import process_image_to_grid
import numpy as np

# Read the flower image
image_path = r'C:\Users\DMOBIN\.gemini\antigravity\brain\b0d8441f-84ac-4efd-b6ca-4ff208a2cddd\uploaded_image_1766480172260.png'
with open(image_path, 'rb') as f:
    image_data = f.read()

# Test with typical grid size
grid_width = 20
grid_height = 20

result = process_image_to_grid(image_data, grid_width, grid_height)

if 'error' in result:
    print(f'Error: {result["error"]}')
else:
    grid = np.array(result['grid'])
    rows_with_fg = np.any(grid, axis=1)
    cols_with_fg = np.any(grid, axis=0)
    
    if np.any(rows_with_fg):
        min_row = int(np.argmax(rows_with_fg))
        max_row = len(rows_with_fg) - 1 - int(np.argmax(rows_with_fg[::-1]))
        min_col = int(np.argmax(cols_with_fg))
        max_col = len(cols_with_fg) - 1 - int(np.argmax(cols_with_fg[::-1]))
        
        center_row = (min_row + max_row) / 2
        center_col = (min_col + max_col) / 2
        expected_center_row = (grid_height - 1) / 2
        expected_center_col = (grid_width - 1) / 2
        
        offset_row = center_row - expected_center_row
        offset_col = center_col - expected_center_col
        
        print(f'Method: {result["stats"]["method"]}')
        print(f'Centered flag: {result["stats"].get("centered", False)}')
        print(f'Bounding box: rows {min_row}-{max_row}, cols {min_col}-{max_col}')
        print(f'Foreground center: ({center_row:.1f}, {center_col:.1f})')
        print(f'Grid center: ({expected_center_row:.1f}, {expected_center_col:.1f})')
        print(f'Offset: row={offset_row:+.1f}, col={offset_col:+.1f}')
        
        if abs(offset_row) <= 0.5 and abs(offset_col) <= 0.5:
            print('=> CENTERED CORRECTLY!')
        else:
            print(f'=> STILL OFFSET!')
