from .smart_dynamic import SmartDynamicStrategy
from .random_adaptive import RandomAdaptiveStrategy
from .edge_hugger import EdgeHuggerStrategy
from .max_clump import MaxClumpStrategy
from .spiral_fill import SpiralFillStrategy
from .symmetry import SymmetricalStrategy

STRATEGIES = {
    'SMART_DYNAMIC': SmartDynamicStrategy,
    'RANDOM_ADAPTIVE': RandomAdaptiveStrategy,
    'EDGE_HUGGER': EdgeHuggerStrategy,
    'MAX_CLUMP': MaxClumpStrategy,
    'SPIRAL_FILL': SpiralFillStrategy,
    'SYMMETRICAL': SymmetricalStrategy,
}


def get_strategy_class(name):
    return STRATEGIES.get(name, SmartDynamicStrategy)
