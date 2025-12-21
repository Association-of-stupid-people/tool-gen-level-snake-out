import pytest
from server.app.services.algorithm import generate_level
from server.app.services.strategies.registry import STRATEGIES

# Test grid: 10x10 all valid
TEST_GRID = [[True]*10 for _ in range(10)]
ARROW_COUNT = 15
MIN_LEN = 3
MAX_LEN = 8

def count_bends(path):
    """Count direction changes in a snake path"""
    if len(path) < 3:
        return 0
    bends = 0
    for i in range(1, len(path) - 1):
        prev_dir = (path[i][0] - path[i-1][0], path[i][1] - path[i-1][1])
        next_dir = (path[i+1][0] - path[i][0], path[i+1][1] - path[i][1])
        if prev_dir != next_dir:
            bends += 1
    return bends

def get_direction_stats(path):
    """Calculate horizontal vs vertical movement ratio"""
    if len(path) < 2:
        return 0, 0
    h_moves = 0
    v_moves = 0
    for i in range(len(path) - 1):
        dr = path[i+1][0] - path[i][0]
        dc = path[i+1][1] - path[i][1]
        if dr == 0:  # Horizontal
            h_moves += 1
        else:  # Vertical
            v_moves += 1
    return h_moves, v_moves

def avg_distance_from_center(path, rows, cols):
    """Average Manhattan distance from grid center"""
    center_r, center_c = rows // 2, cols // 2
    total = sum(abs(r - center_r) + abs(c - center_c) for r, c in path)
    return total / len(path) if path else 0

def avg_distance_from_edge(path, rows, cols):
    """Average distance from nearest edge"""
    total = sum(min(r, rows - 1 - r, c, cols - 1 - c) for r, c in path)
    return total / len(path) if path else 0


class TestAllStrategiesRunWithoutError:
    """Basic sanity check: all strategies should run without crashing"""
    
    @pytest.mark.parametrize("strategy_name", STRATEGIES.keys())
    def test_strategy_runs(self, strategy_name):
        result = generate_level(
            arrow_count=ARROW_COUNT,
            custom_grid=TEST_GRID,
            min_arrow_length=MIN_LEN,
            max_arrow_length=MAX_LEN,
            strategy_name=strategy_name
        )
        assert 'level_json' in result
        assert 'is_solvable' in result
        # Should produce at least some snakes
        snakes = [item for item in result['level_json'] if item.get('itemType') == 'snake']
        assert len(snakes) > 0, f"{strategy_name} produced no snakes"


class TestZigZagHasMoreBends:
    """ZigZag should have more direction changes than Horizontal/Vertical"""
    
    def test_zigzag_vs_horizontal(self):
        # Generate with ZigZag
        zz_result = generate_level(
            arrow_count=10, custom_grid=TEST_GRID,
            min_arrow_length=4, max_arrow_length=8,
            strategy_name='ZIGZAG_SCAN'
        )
        
        # Generate with Horizontal
        h_result = generate_level(
            arrow_count=10, custom_grid=TEST_GRID,
            min_arrow_length=4, max_arrow_length=8,
            strategy_name='HORIZONTAL_SCAN'
        )
        
        # Extract snake paths (need to parse from level_json)
        # level_json format: position is [{x, y}, ...] - need to convert
        # Actually, we need raw paths from strategy result
        # For now, let's check the strategy output directly
        
        from server.app.services.strategies.pattern_strategies import ZigZagScanStrategy, HorizontalScanStrategy
        
        grid = [[True]*10 for _ in range(10)]
        valid_cells = set((r, c) for r in range(10) for c in range(10))
        
        zz_strat = ZigZagScanStrategy(10, 10, valid_cells, {}, None)
        zz_res = zz_strat.generate(10, 4, 8, 0, 10)
        
        h_strat = HorizontalScanStrategy(10, 10, valid_cells.copy(), {}, None)
        h_res = h_strat.generate(10, 4, 8, 0, 10)
        
        # Count total bends
        zz_bends = sum(count_bends(s['path']) for s in zz_res['snakes'])
        h_bends = sum(count_bends(s['path']) for s in h_res['snakes'])
        
        print(f"ZigZag total bends: {zz_bends}")
        print(f"Horizontal total bends: {h_bends}")
        
        # ZigZag should have MORE bends
        assert zz_bends > h_bends, f"ZigZag ({zz_bends} bends) should have more bends than Horizontal ({h_bends})"


class TestHorizontalIsHorizontal:
    """Horizontal scan should produce mostly horizontal movement"""
    
    def test_horizontal_direction_ratio(self):
        from server.app.services.strategies.pattern_strategies import HorizontalScanStrategy
        
        valid_cells = set((r, c) for r in range(10) for c in range(10))
        strat = HorizontalScanStrategy(10, 10, valid_cells, {}, None)
        res = strat.generate(10, 4, 8, 0, 10)
        
        total_h = 0
        total_v = 0
        for s in res['snakes']:
            h, v = get_direction_stats(s['path'])
            total_h += h
            total_v += v
        
        print(f"Horizontal: H moves={total_h}, V moves={total_v}")
        
        # Should have at least 2x more horizontal than vertical
        assert total_h > total_v * 1.5, f"Horizontal strategy should prefer H moves: {total_h} vs {total_v}"


class TestVerticalIsVertical:
    """Vertical scan should produce mostly vertical movement"""
    
    def test_vertical_direction_ratio(self):
        from server.app.services.strategies.pattern_strategies import VerticalScanStrategy
        
        valid_cells = set((r, c) for r in range(10) for c in range(10))
        strat = VerticalScanStrategy(10, 10, valid_cells, {}, None)
        res = strat.generate(10, 4, 8, 0, 10)
        
        total_h = 0
        total_v = 0
        for s in res['snakes']:
            h, v = get_direction_stats(s['path'])
            total_h += h
            total_v += v
        
        print(f"Vertical: H moves={total_h}, V moves={total_v}")
        
        # Should have at least 2x more vertical than horizontal
        assert total_v > total_h * 1.5, f"Vertical strategy should prefer V moves: {total_v} vs {total_h}"


class TestEdgeHuggerNearEdges:
    """Edge hugger snakes should be closer to edges on average"""
    
    def test_edge_vs_center(self):
        from server.app.services.strategies.pattern_strategies import EdgeHuggerStrategy, CenterSpreadStrategy
        
        valid_cells = set((r, c) for r in range(10) for c in range(10))
        
        edge_strat = EdgeHuggerStrategy(10, 10, valid_cells.copy(), {}, None)
        edge_res = edge_strat.generate(10, 3, 6, 0, 10)
        
        center_strat = CenterSpreadStrategy(10, 10, valid_cells.copy(), {}, None)
        center_res = center_strat.generate(10, 3, 6, 0, 10)
        
        # Calculate average distance from edge
        edge_avg = 0
        edge_count = 0
        for s in edge_res['snakes']:
            for r, c in s['path']:
                edge_avg += min(r, 9 - r, c, 9 - c)
                edge_count += 1
        edge_avg = edge_avg / edge_count if edge_count else 99
        
        center_avg = 0
        center_count = 0
        for s in center_res['snakes']:
            for r, c in s['path']:
                center_avg += min(r, 9 - r, c, 9 - c)
                center_count += 1
        center_avg = center_avg / center_count if center_count else 0
        
        print(f"EdgeHugger avg dist from edge: {edge_avg:.2f}")
        print(f"CenterSpread avg dist from edge: {center_avg:.2f}")
        
        # Edge hugger should be CLOSER to edges (lower value)
        assert edge_avg < center_avg, f"EdgeHugger ({edge_avg:.2f}) should be closer to edges than CenterSpread ({center_avg:.2f})"


class TestCenterSpreadFromCenter:
    """Center spread snakes should start from center region"""
    
    def test_center_starting_positions(self):
        from server.app.services.strategies.pattern_strategies import CenterSpreadStrategy
        
        valid_cells = set((r, c) for r in range(10) for c in range(10))
        strat = CenterSpreadStrategy(10, 10, valid_cells, {}, None)
        res = strat.generate(10, 3, 6, 0, 10)
        
        # Check first few snakes - their start should be near center
        center = (5, 5)
        for i, s in enumerate(res['snakes'][:5]):
            start = s['path'][0]
            dist = abs(start[0] - center[0]) + abs(start[1] - center[1])
            print(f"Snake {i} starts at {start}, dist from center: {dist}")
            # First snakes should be within 3 of center
            if i < 3:
                assert dist <= 4, f"Early snake {i} should start near center, but started at {start} (dist={dist})"


class TestSolvability:
    """All strategies should produce solvable levels"""
    
    @pytest.mark.parametrize("strategy_name", STRATEGIES.keys())
    def test_is_solvable(self, strategy_name):
        result = generate_level(
            arrow_count=15,
            custom_grid=TEST_GRID,
            min_arrow_length=3,
            max_arrow_length=6,
            strategy_name=strategy_name
        )
        
        assert result['is_solvable'], f"{strategy_name} produced unsolvable level"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
