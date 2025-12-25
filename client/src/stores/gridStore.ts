import { create } from 'zustand'

interface GridState {
    // Grid dimensions
    rows: number
    cols: number
    setGridSize: (rows: number, cols: number) => void

    // Grid data (boolean matrix for draw layer)
    gridData: boolean[][]
    setGridData: (data: boolean[][] | ((prev: boolean[][]) => boolean[][])) => void
    resetGridData: (data?: boolean[][]) => void

    // Zoom & Pan (shared between views)
    zoom: number
    pan: { x: number; y: number }
    setZoom: (zoom: number) => void
    setPan: (pan: { x: number; y: number }) => void
    isZoomInitialized: boolean
    setIsZoomInitialized: (initialized: boolean) => void
}

export const useGridStore = create<GridState>((set, get) => ({
    // Grid dimensions (default 10x10)
    rows: 10,
    cols: 10,
    setGridSize: (rows, cols) => {
        set({ rows, cols })
        // Reset grid data when size changes
        const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(false))
        set({ gridData: newGrid })
    },

    // Grid data
    gridData: Array(10).fill(null).map(() => Array(10).fill(false)),
    setGridData: (dataOrUpdater) => {
        if (typeof dataOrUpdater === 'function') {
            set({ gridData: dataOrUpdater(get().gridData) })
        } else {
            set({ gridData: dataOrUpdater })
        }
    },
    resetGridData: (data) => {
        if (data) {
            set({ gridData: data })
        } else {
            const { rows, cols } = get()
            set({ gridData: Array(rows).fill(null).map(() => Array(cols).fill(false)) })
        }
    },

    // Zoom & Pan
    zoom: 1,
    pan: { x: 0, y: 0 },
    setZoom: (zoom) => set({ zoom }),
    setPan: (pan) => set({ pan }),
    isZoomInitialized: false,
    setIsZoomInitialized: (initialized) => set({ isZoomInitialized: initialized }),
}))
