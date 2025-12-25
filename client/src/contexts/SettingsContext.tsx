import { createContext, useContext, useState, type ReactNode } from 'react'

interface SettingsContextType {
    gridSize: { width: number; height: number }
    setGridSize: (size: { width: number; height: number }) => void
    backgroundColor: string
    setBackgroundColor: (color: string) => void
    snakePalette: string[]
    setSnakePalette: (palette: string[]) => void
    filenamePrefix: string
    setFilenamePrefix: (prefix: string) => void
    filenameSuffix: string
    setFilenameSuffix: (suffix: string) => void
    restrictDrawToColored: boolean
    setRestrictDrawToColored: (restrict: boolean) => void
    lengthRange: { min: number; max: number }
    setLengthRange: (range: { min: number; max: number }) => void
    bendsRange: { min: number; max: number }
    setBendsRange: (range: { min: number; max: number }) => void
    autoResizeGridOnImport: boolean
    setAutoResizeGridOnImport: (value: boolean) => void
    autoFillDrawOnImport: boolean
    setAutoFillDrawOnImport: (value: boolean) => void
    checkerboardView: boolean
    setCheckerboardView: (value: boolean) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [gridSize, setGridSize] = useState({ width: 20, height: 20 })
    const [backgroundColor, setBackgroundColor] = useState('#111827')
    const [snakePalette, setSnakePalette] = useState<string[]>([
        '#FF6B9D', // color-1 - Bright Pink (was #EF8AA8)
        '#7CFC00', // color-2 - Bright Lime Green (was #84D245)
        '#FF00FF', // color-3 - Magenta (was #9536E9 - too similar to purple bg)
        '#00FFFF', // color-4 - Cyan (was #34C4CC)
        '#FF8C00', // color-5 - Dark Orange (was #F9743A)
        '#DEB887', // color-6 - BurlyWood/Tan (was #6B3C2C - too dark)
        '#FFD700', // color-7 - Gold (was #F1C24F)
        '#00BFFF', // color-8 - Deep Sky Blue (was #477FF7 - too similar to bg)
        '#FF4500', // color-9 - Orange Red (was #EE4226)
    ])
    const [filenamePrefix, setFilenamePrefix] = useState('Level')
    const [filenameSuffix, setFilenameSuffix] = useState('Data')
    const [restrictDrawToColored, setRestrictDrawToColored] = useState(true)
    const [lengthRange, setLengthRange] = useState({ min: 3, max: 50 })
    const [bendsRange, setBendsRange] = useState({ min: 0, max: 20 })
    const [autoResizeGridOnImport, setAutoResizeGridOnImport] = useState(true)
    const [autoFillDrawOnImport, setAutoFillDrawOnImport] = useState(true)
    const [checkerboardView, setCheckerboardView] = useState(false)

    return (
        <SettingsContext.Provider
            value={{
                gridSize,
                setGridSize,
                backgroundColor,
                setBackgroundColor,
                snakePalette,
                setSnakePalette,
                filenamePrefix,
                setFilenamePrefix,
                filenameSuffix,
                setFilenameSuffix,
                restrictDrawToColored,
                setRestrictDrawToColored,
                lengthRange,
                setLengthRange,
                bendsRange,
                setBendsRange,
                autoResizeGridOnImport,
                setAutoResizeGridOnImport,
                autoFillDrawOnImport,
                setAutoFillDrawOnImport,
                checkerboardView,
                setCheckerboardView
            }}
        >
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}
