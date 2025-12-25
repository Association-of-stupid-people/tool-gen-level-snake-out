import { create } from 'zustand'

interface Arrow {
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

interface Obstacle {
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

interface OverlaysState {
    arrows: Arrow[]
    obstacles: Obstacle[]
    selectedArrows: Set<number>
    nextItemId: number

    // Actions
    setArrows: (arrows: Arrow[]) => void
    addArrow: (arrow: Arrow) => void
    updateArrow: (id: number, updates: Partial<Arrow>) => void
    deleteArrow: (id: number) => void
    deleteSelectedArrows: () => void

    setObstacles: (obstacles: Obstacle[]) => void
    addObstacle: (obstacle: Obstacle) => void
    updateObstacle: (id: number, updates: Partial<Obstacle>) => void
    deleteObstacle: (id: number) => void

    setSelectedArrows: (ids: Set<number>) => void
    toggleArrowSelection: (id: number, additive?: boolean) => void
    clearSelection: () => void

    setNextItemId: (id: number) => void
    getNextId: () => number

    clearAll: () => void
    setOverlays: (overlays: { arrows: Arrow[]; obstacles: Obstacle[] }) => void
}

export const useOverlaysStore = create<OverlaysState>((set, get) => ({
    arrows: [],
    obstacles: [],
    selectedArrows: new Set(),
    nextItemId: 0,

    // Arrows
    setArrows: (arrows) => set({ arrows }),
    addArrow: (arrow) => set((state) => ({ arrows: [...state.arrows, arrow] })),
    updateArrow: (id, updates) =>
        set((state) => ({
            arrows: state.arrows.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
    deleteArrow: (id) =>
        set((state) => ({
            arrows: state.arrows.filter((a) => a.id !== id),
            selectedArrows: new Set([...state.selectedArrows].filter((sid) => sid !== id)),
        })),
    deleteSelectedArrows: () =>
        set((state) => ({
            arrows: state.arrows.filter((a) => !state.selectedArrows.has(a.id)),
            selectedArrows: new Set(),
        })),

    // Obstacles
    setObstacles: (obstacles) => set({ obstacles }),
    addObstacle: (obstacle) => set((state) => ({ obstacles: [...state.obstacles, obstacle] })),
    updateObstacle: (id, updates) =>
        set((state) => ({
            obstacles: state.obstacles.map((o) => (o.id === id ? { ...o, ...updates } : o)),
        })),
    deleteObstacle: (id) =>
        set((state) => ({
            obstacles: state.obstacles.filter((o) => o.id !== id),
        })),

    // Selection
    setSelectedArrows: (ids) => set({ selectedArrows: ids }),
    toggleArrowSelection: (id, additive = false) =>
        set((state) => {
            const newSet = new Set(additive ? state.selectedArrows : [])
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
            return { selectedArrows: newSet }
        }),
    clearSelection: () => set({ selectedArrows: new Set() }),

    // ID management
    setNextItemId: (id) => set({ nextItemId: id }),
    getNextId: () => {
        const id = get().nextItemId
        set({ nextItemId: id + 1 })
        return id
    },

    // Bulk operations
    clearAll: () => set({ arrows: [], obstacles: [], selectedArrows: new Set() }),
    setOverlays: ({ arrows, obstacles }) => set({ arrows, obstacles }),
}))

// Type exports for use in components
export type { Arrow, Obstacle }
