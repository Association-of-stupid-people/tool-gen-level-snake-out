// Path Utility Functions for Snake/Arrow drawing

export interface Cell {
    row: number
    col: number
}

/**
 * Check if two cells are adjacent (no diagonal)
 */
export const isAdjacent = (cell1: Cell, cell2: Cell): boolean => {
    const dRow = Math.abs(cell1.row - cell2.row)
    const dCol = Math.abs(cell1.col - cell2.col)
    return (dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1)
}

/**
 * Calculate number of bends/turns in a path
 */
export const calculateBends = (path: Cell[]): number => {
    if (path.length < 3) return 0
    let bends = 0

    // Calculate initial direction
    let lastDr = path[1].row - path[0].row
    let lastDc = path[1].col - path[0].col

    for (let i = 2; i < path.length; i++) {
        const dr = path[i].row - path[i - 1].row
        const dc = path[i].col - path[i - 1].col
        if (dr !== lastDr || dc !== lastDc) {
            bends++
            lastDr = dr
            lastDc = dc
        }
    }
    return bends
}

/**
 * Calculate direction from one cell to the next
 */
export const calculateDirection = (from: Cell, to: Cell): 'up' | 'down' | 'left' | 'right' => {
    const dr = to.row - from.row
    const dc = to.col - from.col
    if (dr === -1) return 'up'
    if (dr === 1) return 'down'
    if (dc === -1) return 'left'
    return 'right'
}

/**
 * Validate path against length and bends constraints
 */
export const validatePath = (
    path: Cell[],
    lengthRange: { min: number; max: number },
    bendsRange: { min: number; max: number }
): boolean => {
    // Min length check (at least 2 cells to form a direction)
    if (path.length < 2) return false

    // Settings Length check
    if (path.length < lengthRange.min || path.length > lengthRange.max) return false

    // Bends check
    const bends = calculateBends(path)
    if (bends < bendsRange.min || bends > bendsRange.max) return false

    // Adjacency check
    for (let i = 1; i < path.length; i++) {
        if (!isAdjacent(path[i - 1], path[i])) return false
    }

    return true
}

/**
 * Check if a cell exists in path
 */
export const cellInPath = (path: Cell[], cell: Cell): boolean => {
    return path.some(p => p.row === cell.row && p.col === cell.col)
}

/**
 * Get the direction from the second-to-last cell to the last cell
 */
export const getPathEndDirection = (path: Cell[]): 'up' | 'down' | 'left' | 'right' => {
    if (path.length < 2) return 'right'
    return calculateDirection(path[path.length - 2], path[path.length - 1])
}

/**
 * Reverse a path and return new direction
 */
export const reversePath = (path: Cell[]): { path: Cell[], direction: 'up' | 'down' | 'left' | 'right' } => {
    const reversed = [...path].reverse()
    return {
        path: reversed,
        direction: getPathEndDirection(reversed)
    }
}
