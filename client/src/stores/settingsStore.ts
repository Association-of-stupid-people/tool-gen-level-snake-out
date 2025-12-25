import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
    // Grid Settings
    gridSize: { width: number; height: number }
    setGridSize: (size: { width: number; height: number }) => void

    // Appearance
    backgroundColor: string
    setBackgroundColor: (color: string) => void
    checkerboardView: boolean
    setCheckerboardView: (value: boolean) => void

    // Snake Colors
    snakePalette: string[]
    setSnakePalette: (palette: string[]) => void

    // File Export
    filenamePrefix: string
    setFilenamePrefix: (prefix: string) => void
    filenameSuffix: string
    setFilenameSuffix: (suffix: string) => void

    // Drawing Constraints
    restrictDrawToColored: boolean
    setRestrictDrawToColored: (restrict: boolean) => void
    lengthRange: { min: number; max: number }
    setLengthRange: (range: { min: number; max: number }) => void
    bendsRange: { min: number; max: number }
    setBendsRange: (range: { min: number; max: number }) => void

    // Import Options
    autoResizeGridOnImport: boolean
    setAutoResizeGridOnImport: (value: boolean) => void
    autoFillDrawOnImport: boolean
    setAutoFillDrawOnImport: (value: boolean) => void

    // Reset
    resetSettings: () => void
}

const DEFAULT_PALETTE = [
    '#FF6B9D', // color-1 - Bright Pink
    '#7CFC00', // color-2 - Bright Lime Green
    '#FF00FF', // color-3 - Magenta
    '#00FFFF', // color-4 - Cyan
    '#FF8C00', // color-5 - Dark Orange
    '#DEB887', // color-6 - BurlyWood/Tan
    '#FFD700', // color-7 - Gold
    '#00BFFF', // color-8 - Deep Sky Blue
    '#FF4500', // color-9 - Orange Red
]

const DEFAULT_SETTINGS = {
    gridSize: { width: 20, height: 20 },
    backgroundColor: '#111827',
    checkerboardView: false,
    snakePalette: DEFAULT_PALETTE,
    filenamePrefix: 'Level',
    filenameSuffix: 'Data',
    restrictDrawToColored: true,
    lengthRange: { min: 3, max: 50 },
    bendsRange: { min: 0, max: 20 },
    autoResizeGridOnImport: true,
    autoFillDrawOnImport: true,
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            ...DEFAULT_SETTINGS,

            setGridSize: (size) => set({ gridSize: size }),
            setBackgroundColor: (color) => set({ backgroundColor: color }),
            setCheckerboardView: (value) => set({ checkerboardView: value }),
            setSnakePalette: (palette) => set({ snakePalette: palette }),
            setFilenamePrefix: (prefix) => set({ filenamePrefix: prefix }),
            setFilenameSuffix: (suffix) => set({ filenameSuffix: suffix }),
            setRestrictDrawToColored: (restrict) => set({ restrictDrawToColored: restrict }),
            setLengthRange: (range) => set({ lengthRange: range }),
            setBendsRange: (range) => set({ bendsRange: range }),
            setAutoResizeGridOnImport: (value) => set({ autoResizeGridOnImport: value }),
            setAutoFillDrawOnImport: (value) => set({ autoFillDrawOnImport: value }),

            resetSettings: () => set(DEFAULT_SETTINGS),
        }),
        {
            name: 'snake-level-settings',
            version: 1,
        }
    )
)

// Alias for backward compatibility with useSettings hook
export const useSettings = useSettingsStore
