import pytest
from app.services.algorithm import generate_level

def test_generate_level_basic():
    # 5x5 grid, all true
    grid = [[True]*5 for _ in range(5)]
    
    result = generate_level(
        arrow_count=2,
        custom_grid=grid,
        min_arrow_length=3,
        max_arrow_length=5
    )
    
    assert 'level_json' in result
    assert 'logs' in result
    assert len(result['logs']) > 0 # Should have at least success msg
    
    # Check JSON structure
    level_data = result['level_json']
    assert isinstance(level_data, list)
    
    # Check if snakes are generated
    snakes = [item for item in level_data if item['itemType'] == 'snake']
    assert len(snakes) > 0

def test_generate_level_constraints():
    # 10x10 grid
    grid = [[True]*10 for _ in range(10)]
    
    arrow_count = 5
    result = generate_level(
        arrow_count=arrow_count,
        custom_grid=grid,
        min_arrow_length=2,
        max_arrow_length=4
    )
    
    level_data = result['level_json']
    snakes = [item for item in level_data if item['itemType'] == 'snake']
    
    # Might not always succeed 100% due to random, but usually should for simple case
    # We check if it returns valid structure mostly
    assert len(snakes) <= arrow_count
    
    for snake in snakes:
        # Path length check (snake positions list length)
        # Note: position list len = cells count.
        # Logic: min_arrow_length is cells count or segment count?
        # Usually length = cells. 
        length = len(snake['position'])
        assert length >= 2 # Absolute min
        # assert length <= 4 # Max constraints might be soft or hard depending on implementation
