import { create } from 'zustand'
import { temporal } from 'zundo'
export interface Arrow {
    id: number
    row: number
    col: number
    direction: string
    color: string
    path?: { row: number; col: number }[]
    type?: string
    keyId?: number
    lockId?: number
    snakeId?: number
    countdown?: number
}

export interface Obstacle {
    id: number
    row: number
    col: number
    type: string
    color?: string
    count?: number
    cells?: { row: number; col: number }[]
    direction?: string
    snakeId?: number
    keySnakeId?: number
    lockedSnakeId?: number
    countdown?: number
}

// Grid Data Store with History
interface GridHistoryState {
    gridData: boolean[][]
    rows: number
    cols: number
    setGridData: (data: boolean[][] | ((prev: boolean[][]) => boolean[][])) => void
    setGridSize: (rows: number, cols: number) => void
    resetGrid: (data?: boolean[][]) => void
    toggleCell: (row: number, col: number, value: boolean) => void
    bulkToggleCells: (updates: { row: number; col: number }[], value: boolean) => void
}

export const useGridHistoryStore = create<GridHistoryState>()(
    temporal(
        (set, get) => ({
            gridData: Array(20).fill(null).map(() => Array(20).fill(false)),
            rows: 20,
            cols: 20,

            setGridData: (dataOrFn) => {
                if (typeof dataOrFn === 'function') {
                    set({ gridData: dataOrFn(get().gridData) })
                } else {
                    set({ gridData: dataOrFn })
                }
            },

            setGridSize: (rows, cols) => {
                const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(false))
                set({ rows, cols, gridData: newGrid })
            },

            resetGrid: (data) => {
                if (data) {
                    set({ gridData: data, rows: data.length, cols: data[0]?.length || 0 })
                } else {
                    const { rows, cols } = get()
                    set({ gridData: Array(rows).fill(null).map(() => Array(cols).fill(false)) })
                }
                // Clear temporal history on reset
                useGridHistoryStore.temporal.getState().clear()
            },

            toggleCell: (row, col, value) => {
                const { gridData, rows, cols } = get()
                if (row < 0 || row >= rows || col < 0 || col >= cols) return
                const newGrid = gridData.map(r => [...r])
                newGrid[row][col] = value
                set({ gridData: newGrid })
            },

            bulkToggleCells: (updates, value) => {
                const { gridData, rows, cols } = get()
                const newGrid = gridData.map(r => [...r])
                updates.forEach(({ row, col }) => {
                    if (row >= 0 && row < rows && col >= 0 && col < cols) {
                        newGrid[row][col] = value
                    }
                })
                set({ gridData: newGrid })
            },
        }),
        {
            limit: 20, // Max undo steps
            equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
        }
    )
)

// Overlays Store with History
interface OverlaysHistoryState {
    arrows: Arrow[]
    obstacles: Obstacle[]
    selectedArrowIds: number[]
    nextItemId: number

    setArrows: (arrows: Arrow[]) => void
    addArrow: (arrow: Arrow) => void
    updateArrow: (id: number, updates: Partial<Arrow>) => void
    deleteArrow: (id: number) => void

    setObstacles: (obstacles: Obstacle[]) => void
    addObstacle: (obstacle: Obstacle) => void
    updateObstacle: (id: number, updates: Partial<Obstacle>) => void
    deleteObstacle: (id: number) => void

    setSelectedArrowIds: (ids: number[]) => void
    toggleArrowSelection: (id: number, additive?: boolean) => void
    deleteSelectedArrows: () => void
    clearSelection: () => void

    setNextItemId: (id: number) => void
    getNextId: () => number

    setOverlays: (data: { arrows: Arrow[]; obstacles: Obstacle[] }) => void
    clearAll: () => void
}

export const useOverlaysHistoryStore = create<OverlaysHistoryState>()(
    temporal(
        (set, get) => ({
            arrows: [],
            obstacles: [],
            selectedArrowIds: [],
            nextItemId: 0,

            // Arrows
            setArrows: (arrows) => set({ arrows }),
            addArrow: (arrow) => set((s) => ({ arrows: [...s.arrows, arrow] })),
            updateArrow: (id, updates) =>
                set((s) => ({
                    arrows: s.arrows.map((a) => (a.id === id ? { ...a, ...updates } : a)),
                })),
            deleteArrow: (id) =>
                set((s) => ({
                    arrows: s.arrows.filter((a) => a.id !== id),
                    selectedArrowIds: s.selectedArrowIds.filter((sid) => sid !== id),
                })),

            // Obstacles
            setObstacles: (obstacles) => set({ obstacles }),
            addObstacle: (obstacle) => set((s) => ({ obstacles: [...s.obstacles, obstacle] })),
            updateObstacle: (id, updates) =>
                set((s) => ({
                    obstacles: s.obstacles.map((o) => (o.id === id ? { ...o, ...updates } : o)),
                })),
            deleteObstacle: (id) =>
                set((s) => ({ obstacles: s.obstacles.filter((o) => o.id !== id) })),

            // Selection
            setSelectedArrowIds: (ids) => set({ selectedArrowIds: ids }),
            toggleArrowSelection: (id, additive = false) =>
                set((s) => {
                    const currentSelection = additive ? s.selectedArrowIds : []
                    const isSelected = currentSelection.includes(id)
                    const newSelection = isSelected
                        ? currentSelection.filter((sid) => sid !== id)
                        : [...currentSelection, id]
                    return { selectedArrowIds: newSelection }
                }),
            deleteSelectedArrows: () =>
                set((s) => ({
                    arrows: s.arrows.filter((a) => !s.selectedArrowIds.includes(a.id)),
                    selectedArrowIds: [],
                })),
            clearSelection: () => set({ selectedArrowIds: [] }),

            // ID management
            setNextItemId: (id) => set({ nextItemId: id }),
            getNextId: () => {
                const id = get().nextItemId
                set({ nextItemId: id + 1 })
                return id
            },

            // Bulk operations
            setOverlays: ({ arrows, obstacles }) => set({ arrows, obstacles }),
            clearAll: () => set({ arrows: [], obstacles: [], selectedArrowIds: [] }),
        }),
        {
            limit: 20,
            equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
        }
    )
)

// Type helpers for temporal stores
export type GridHistoryStoreApi = typeof useGridHistoryStore
export type OverlaysHistoryStoreApi = typeof useOverlaysHistoryStore

// Helper hooks for undo/redo
export const useGridUndo = () => useGridHistoryStore.temporal.getState().undo
export const useGridRedo = () => useGridHistoryStore.temporal.getState().redo
export const useOverlaysUndo = () => useOverlaysHistoryStore.temporal.getState().undo
export const useOverlaysRedo = () => useOverlaysHistoryStore.temporal.getState().redo

