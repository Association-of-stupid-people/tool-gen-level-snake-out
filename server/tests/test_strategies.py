
import pytest
import sys
import os

# Add server directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.strategies.smart_dynamic import SmartDynamicStrategy
from app.services.strategies.edge_hugger import EdgeHuggerStrategy
from app.services.strategies.max_clump import MaxClumpStrategy
from app.services.strategies.spiral_fill import SpiralFillStrategy
from app.services.strategies.symmetry import SymmetricalStrategy

STRATEGIES = [
    ("SmartDynamic", SmartDynamicStrategy),
    ("EdgeHugger", EdgeHuggerStrategy),
    ("MaxClump", MaxClumpStrategy),
    ("SpiralFill", SpiralFillStrategy),
    ("Symmetrical", SymmetricalStrategy),
]

@pytest.mark.parametrize("name, StrategyClass", STRATEGIES)
def test_strategy_generation(name, StrategyClass):
    """Test that each strategy generates a level without crashing."""
    print(f"\nTesting {name}...")
    
    ROWS, COLS = 10, 10
    valid_cells = set((r, c) for r in range(ROWS) for c in range(COLS))
    obstacles_map = {}
    color_list = ["#FF0000", "#00FF00", "#0000FF"]
    
    strategy = StrategyClass(ROWS, COLS, valid_cells, obstacles_map, color_list)
    
    # Try generating a small level
    result = strategy.generate(
        arrow_count=5, 
        min_len=3, 
        max_len=10, 
        min_bends=0, 
        max_bends=5
    )
    
    assert result is not None, f"{name} returned None"
    assert 'snakes' in result, f"{name} result missing 'snakes'"
    assert len(result['snakes']) > 0, f"{name} generated 0 snakes (might be valid but unexpected for 5 arrows)"
    
    print(f"✅ {name} Passed. Snakes: {len(result['snakes'])}")

if __name__ == "__main__":
    # Manually run if executed directly
    for name, Cls in STRATEGIES:
        try:
            test_strategy_generation(name, Cls)
        except Exception as e:
            print(f"❌ {name} Failed: {e}")
            import traceback
            traceback.print_exc()
