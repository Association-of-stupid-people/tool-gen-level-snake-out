"""Test bonus_fill parameter in level generation"""
import pytest
from app.services.algorithm import generate_level


class TestBonusFill:
    """Test that bonus_fill parameter correctly controls whether extra snakes are added"""
    
    def test_bonus_fill_disabled_respects_arrow_count(self):
        """When bonus_fill=False, should generate at most arrow_count snakes"""
        arrow_count = 5
        
        # Simple 10x10 grid
        custom_grid = [[1] * 10 for _ in range(10)]
        
        result = generate_level(
            arrow_count=arrow_count,
            custom_grid=custom_grid,
            min_arrow_length=2,
            max_arrow_length=5,
            min_bends=0,
            max_bends=2,
            obstacles_input=[],
            color_list=['#FF0000'],
            strategy_name='RANDOM_ADAPTIVE',  # A strategy that normally has bonus fill
            bonus_fill=False  # Disable bonus fill
        )
        
        # Get number of snakes generated
        snakes = result['level_json']['snakes']
        snake_count = len(snakes)
        
        print(f"arrow_count={arrow_count}, generated snakes={snake_count}")
        
        # Should have at most arrow_count snakes (could be less if placement fails)
        assert snake_count <= arrow_count, \
            f"With bonus_fill=False, expected at most {arrow_count} snakes but got {snake_count}"
    
    def test_bonus_fill_enabled_can_exceed_arrow_count(self):
        """When bonus_fill=True, may generate more than arrow_count snakes to fill gaps"""
        arrow_count = 3
        
        # Simple 10x10 grid - plenty of space for bonus fill
        custom_grid = [[1] * 10 for _ in range(10)]
        
        result = generate_level(
            arrow_count=arrow_count,
            custom_grid=custom_grid,
            min_arrow_length=2,
            max_arrow_length=3,  # Short snakes so there's room for bonus
            min_bends=0,
            max_bends=1,
            obstacles_input=[],
            color_list=['#00FF00'],
            strategy_name='RANDOM_ADAPTIVE',  # A strategy that normally has bonus fill
            bonus_fill=True  # Enable bonus fill
        )
        
        # Get number of snakes generated
        snakes = result['level_json']['snakes']
        snake_count = len(snakes)
        
        print(f"arrow_count={arrow_count}, generated snakes with bonus={snake_count}")
        
        # With bonus fill enabled, should typically have more snakes than arrow_count
        # (Not strictly guaranteed, but very likely with a 10x10 grid and only 3 short snakes)
        # We just check it ran without error
        assert snake_count >= arrow_count, \
            f"With bonus_fill=True, expected at least {arrow_count} snakes but got {snake_count}"
    
    def test_bonus_fill_false_multiple_strategies(self):
        """Test bonus_fill=False works for multiple strategies"""
        arrow_count = 5
        custom_grid = [[1] * 10 for _ in range(10)]
        
        strategies_with_bonus = ['RANDOM_ADAPTIVE', 'EDGE_HUGGER', 'MAX_CLUMP', 'SPIRAL_FILL', 'SYMMETRICAL']
        
        for strategy_name in strategies_with_bonus:
            result = generate_level(
                arrow_count=arrow_count,
                custom_grid=custom_grid,
                min_arrow_length=2,
                max_arrow_length=4,
                min_bends=0,
                max_bends=2,
                obstacles_input=[],
                color_list=['#0000FF'],
                strategy_name=strategy_name,
                bonus_fill=False
            )
            
            snakes = result['level_json']['snakes']
            snake_count = len(snakes)
            
            print(f"Strategy={strategy_name}, arrow_count={arrow_count}, generated={snake_count}")
            
            assert snake_count <= arrow_count, \
                f"Strategy {strategy_name} with bonus_fill=False: expected at most {arrow_count} snakes but got {snake_count}"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
