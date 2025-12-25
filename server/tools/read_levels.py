"""
Level Reader Tool
Reads JSON level files and displays summary info.
Usage: python read_levels.py
"""

import os
import sys
import json
import re

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.difficulty_calculator import calculate


def natural_sort_key(s):
    """Sort strings with numbers naturally: 1, 2, 10 instead of 1, 10, 2"""
    return [int(text) if text.isdigit() else text.lower() 
            for text in re.split(r'(\d+)', s)]


def read_level_file(file_path):
    """
    Read and parse a single level JSON file.
    Returns (snakes_count, score) or None if invalid.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        snakes = None
        obstacles = []
        
        # Format 1: Direct snakes/obstacles structure
        if isinstance(data, dict) and 'snakes' in data:
            snakes = data.get('snakes', [])
            obstacles = data.get('obstacles', [])
        
        # Format 2: Nested in level_json
        elif isinstance(data, dict) and 'level_json' in data:
            level_json = data['level_json']
            snakes = level_json.get('snakes', [])
            obstacles = level_json.get('obstacles', [])
        
        # Format 3: Array of items with itemType (Unity format)
        elif isinstance(data, list):
            raw_snakes = [item for item in data if item.get('itemType') == 'snake']
            raw_obstacles = [item for item in data if item.get('itemType') in ['wall', 'hole', 'tunnel', 'wall_break']]
            
            # Convert Unity format (position with x,y) to backend format (path with row,col)
            snakes = []
            for s in raw_snakes:
                position = s.get('position', [])
                if position:
                    # Convert x,y to row,col (y -> row, x -> col)
                    path = [{'row': p.get('y', 0), 'col': p.get('x', 0)} for p in position]
                    snakes.append({'path': path, 'color': s.get('colorID', 0)})
            
            obstacles = []
            for obs in raw_obstacles:
                position = obs.get('position', [])
                if position:
                    cells = [{'row': p.get('y', 0), 'col': p.get('x', 0)} for p in position]
                    obstacles.append({'type': obs.get('itemType'), 'cells': cells})
        
        if snakes is None or len(snakes) == 0:
            return None
        
        # Calculate difficulty
        result = calculate(snakes, obstacles)
        score = result.get('difficulty_score', 0)
        
        return len(snakes), score
        
    except json.JSONDecodeError:
        return None
    except Exception as e:
        print(f"  [DEBUG] Error: {e}")
        return None


def main():
    # Ask for directory path
    path = input("Enter directory path: ").strip()
    
    # Remove quotes if present
    if path.startswith('"') and path.endswith('"'):
        path = path[1:-1]
    if path.startswith("'") and path.endswith("'"):
        path = path[1:-1]
    
    # Validate path
    if not os.path.exists(path):
        print(f"[ERROR] Path does not exist - {path}", file=sys.stderr)
        return
    
    if not os.path.isdir(path):
        print(f"[ERROR] Path is not a directory - {path}", file=sys.stderr)
        return
    
    # Find JSON files
    json_files = [f for f in os.listdir(path) if f.lower().endswith('.json')]
    
    if not json_files:
        print(f"[WARNING] No JSON files found in {path}", file=sys.stderr)
        return
    
    # CSV header
    print("filename,snake,score")
    
    for filename in sorted(json_files, key=natural_sort_key):
        file_path = os.path.join(path, filename)
        result = read_level_file(file_path)
        
        if result:
            snake_count, score = result
            print(f"{filename},{snake_count},{score}")


if __name__ == "__main__":
    main()
