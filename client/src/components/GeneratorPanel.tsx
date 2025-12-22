import { Loader2, Trash2, RotateCcw, Palette, ArrowUpDown, Hash, ChevronDown } from 'lucide-react'
import { GridCanvas } from './GridCanvas'
import { useMemo, useEffect, useState, useRef } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import React from 'react'

import { useLanguage } from '../i18n'

interface GeneratorPanelProps {
    isGenerating: boolean
    jsonInput?: string
    gridData?: boolean[][] // Grid from Grid Editor
    setGridData?: React.Dispatch<React.SetStateAction<boolean[][]>> // Setter for Grid Editor
    generatorTool: 'arrow' | 'obstacle' | 'eraser' | 'none'
    generatorSettings: { arrowColor: string, obstacleType: string, obstacleColor: string, obstacleCount: number, tunnelDirection: string }
    generatorOverlays: {
        arrows: { id: number, row: number, col: number, direction: string, color: string, path?: { row: number, col: number }[], type?: string, keyId?: number, lockId?: number }[],
        obstacles: { id: number, row: number, col: number, type: string, color?: string, count?: number, cells?: { row: number, col: number }[], direction?: string, snakeId?: number, keySnakeId?: number, lockedSnakeId?: number }[]
    }
    setGeneratorOverlays: React.Dispatch<React.SetStateAction<{
        arrows: { id: number, row: number, col: number, direction: string, color: string, path?: { row: number, col: number }[], type?: string, keyId?: number, lockId?: number }[],
        obstacles: { id: number, row: number, col: number, type: string, color?: string, count?: number, cells?: { row: number, col: number }[], direction?: string, snakeId?: number, keySnakeId?: number, lockedSnakeId?: number }[]
    }>>
    onObstacleTypeUsed?: (data: { type: string, row: number, col: number, color?: string, count?: number, keySnakeId?: number, lockedSnakeId?: number, id?: number }) => void
    onObstacleUpdate?: (row: number, col: number, updates: any) => void
    onObstacleDelete?: (row: number, col: number) => void
    nextItemId: number
    setNextItemId: React.Dispatch<React.SetStateAction<number>>
    onValidate?: () => Promise<{ is_solvable: boolean, stuck_count?: number }>
    // View State
    zoom: number
    setZoom: (zoom: number) => void
    pan: { x: number, y: number }
    setPan: (pan: { x: number, y: number }) => void
    isZoomInitialized: boolean
    setIsZoomInitialized: (initialized: boolean) => void
}

function ColorDropdown({ color, palette, onChange }: { color: string, palette: string[], onChange: (color: string) => void }) {
    const [isOpen, setIsOpen] = useState(false)
    const { t } = useLanguage()
    const index = palette.indexOf(color)

    return (
        <div className="relative w-32">
            <button
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white flex items-center justify-between hover:border-gray-500 transition-colors"
                style={{ borderLeft: `8px solid ${color}` }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{t?.('color') || 'Color'} {index !== -1 ? index + 1 : '?'}</span>
                <ChevronDown size={12} className="text-gray-400" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 w-48 bg-gray-800 border border-gray-600 rounded mb-1 z-20 shadow-xl max-h-48 overflow-y-auto">
                        {palette.map((c, i) => (
                            <button
                                key={i}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-left transition-colors border-b border-gray-700/50 last:border-0"
                                onClick={() => {
                                    onChange(c)
                                    setIsOpen(false)
                                }}
                            >
                                <div className="w-3 h-3 rounded-full shrink-0 border border-gray-500" style={{ backgroundColor: c }} />
                                <span className="text-xs text-gray-200">{t?.('color') || 'Color'} {i + 1} <span className="text-gray-500 font-mono ml-1">({c})</span></span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export function GeneratorPanel({
    isGenerating,
    jsonInput,
    gridData: propGridData,
    setGridData,
    generatorTool,
    generatorSettings,
    generatorOverlays,
    setGeneratorOverlays,
    onObstacleTypeUsed,
    onObstacleUpdate,
    onObstacleDelete,
    nextItemId,
    setNextItemId,
    onValidate,
    zoom,
    setZoom,
    pan,
    setPan,
    isZoomInitialized,
    setIsZoomInitialized
}: GeneratorPanelProps) {
    const { restrictDrawToColored, snakePalette, lengthRange, bendsRange } = useSettings()
    // Need to handle missing t if useLanguage isn't ready or mocked in some way, though it should be.
    // However, since ColorDropdown is a separate component, I need to pass t or useLanguage inside it?
    // ColorDropdown is defined in the same file but outside GeneratorPanel. It can't use the hook from GeneratorPanel.
    // It should use the hook itself.
    const { t } = useLanguage()

    // Arrow drag state for path-based drawing
    const [arrowDragState, setArrowDragState] = useState<{
        isDrawing: boolean
        path: { row: number, col: number }[]
    }>({ isDrawing: false, path: [] })

    // Obstacle drag state for wall/wallbreak drawing
    const [obstacleDragState, setObstacleDragState] = useState<{
        isDrawing: boolean
        cells: { row: number, col: number }[]
        type: string
    }>({ isDrawing: false, cells: [], type: '' })

    // Ref to avoid stale closure in mouseup handler
    const obstacleDragStateRef = useRef(obstacleDragState)
    useEffect(() => {
        obstacleDragStateRef.current = obstacleDragState
    }, [obstacleDragState])

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number
        y: number
        type: 'arrow' | 'obstacle'
        data: any
        index: number
    } | null>(null)

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null)
        if (contextMenu) {
            document.addEventListener('click', handleClickOutside)
            return () => document.removeEventListener('click', handleClickOutside)
        }
    }, [contextMenu])

    // Check if two cells are adjacent (no diagonal)
    const isAdjacent = (cell1: { row: number, col: number }, cell2: { row: number, col: number }): boolean => {
        const dRow = Math.abs(cell1.row - cell2.row)
        const dCol = Math.abs(cell1.col - cell2.col)
        return (dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1)
    }

    // Calculate number of bends in the path
    const calculateBends = (path: { row: number, col: number }[]): number => {
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

    // Validate path against constraints
    const validatePath = (path: { row: number, col: number }[]): boolean => {
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

    const gridData = useMemo(() => {
        // If jsonInput exists, try to parse it
        if (jsonInput && jsonInput.trim()) {
            try {
                const parsed = JSON.parse(jsonInput)
                // Validate if it is boolean[][]
                if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
                    return parsed as boolean[][]
                }
            } catch (e) {
                // Fall through to use propGridData
            }
        }
        // Fall back to gridData from Grid Editor
        return propGridData || null
    }, [jsonInput, propGridData])

    const handleCellInteraction = (row: number, col: number) => {
        if (!gridData || !gridData[row] || gridData[row][col] === undefined) return

        // Check if drawing is restricted to colored cells only
        if (restrictDrawToColored && !gridData[row][col]) return

        // Auto-color the cell when placing arrow/obstacle
        if (setGridData && !gridData[row][col] && (generatorTool === 'arrow' || generatorTool === 'obstacle')) {
            setGridData((prev: boolean[][]) => {
                const newGrid = prev.map((r: boolean[]) => [...r])
                newGrid[row][col] = true
                return newGrid
            })
        }

        if (generatorTool === 'arrow') {
            // Check if cell is blocked by existing arrow head or path
            const existingArrow = generatorOverlays.arrows.find(a =>
                (a.row === row && a.col === col) ||
                a.path?.some(p => p.row === row && p.col === col)
            )
            const existingObstacle = generatorOverlays.obstacles.find(o => o.row === row && o.col === col)

            if (existingArrow || existingObstacle) {
                return // Cannot draw over existing arrow/path or obstacle
            }

            if (!arrowDragState.isDrawing) {
                // Start drag tracking
                setArrowDragState({ isDrawing: true, path: [{ row, col }] })
            } else {
                // Continue drag tracking
                const lastCell = arrowDragState.path[arrowDragState.path.length - 1]

                // Allow moving back to previous cell (undo last step)
                if (arrowDragState.path.length > 1) {
                    const prevCell = arrowDragState.path[arrowDragState.path.length - 2]
                    if (prevCell.row === row && prevCell.col === col) {
                        setArrowDragState(prev => ({
                            ...prev,
                            path: prev.path.slice(0, -1)
                        }))
                        return
                    }
                }

                // Check for self-intersection (cannot cross own path)
                const isSelfIntersecting = arrowDragState.path.some(p => p.row === row && p.col === col)
                if (isSelfIntersecting) {
                    return // Cannot cross own path
                }

                // Add new cell if adjacent
                if (isAdjacent(lastCell, { row, col })) {
                    setArrowDragState(prev => ({ ...prev, path: [...prev.path, { row, col }] }))
                }
            }
        } else if (generatorTool === 'obstacle') {
            const obstacleType = generatorSettings.obstacleType

            // Check for collision with existing obstacles or arrows (including paths)
            const existingObstacle = generatorOverlays.obstacles.find(o =>
                (o.row === row && o.col === col) ||
                o.cells?.some(c => c.row === row && c.col === col)
            )
            const existingArrow = generatorOverlays.arrows.find(a =>
                (a.row === row && a.col === col) ||
                a.path?.some(p => p.row === row && p.col === col)
            )

            if (existingObstacle || existingArrow) {
                return // Do nothing if occupied
            }

            // For wall types, use drag-based drawing
            if (obstacleType === 'wall' || obstacleType === 'wall_break') {
                if (!obstacleDragState.isDrawing) {
                    // Start drag
                    setObstacleDragState({ isDrawing: true, cells: [{ row, col }], type: obstacleType })
                } else if (obstacleDragState.type === obstacleType) {
                    // Continue drag - use functional update to avoid stale closure
                    setObstacleDragState(prev => {
                        // Check self-intersection using fresh prev state
                        const isSelfIntersecting = prev.cells.some(c => c.row === row && c.col === col)
                        if (isSelfIntersecting) return prev // Don't add duplicate
                        return { ...prev, cells: [...prev.cells, { row, col }] }
                    })
                }
            } else {
                // For other obstacle types (tunnel, hole), immediate placement
                let resolvedColor = generatorSettings.obstacleColor

                // If color is "Color N" format, resolve to actual palette color
                if (resolvedColor && resolvedColor.startsWith('Color ')) {
                    const colorIndex = parseInt(resolvedColor.replace('Color ', '')) - 1
                    if (snakePalette[colorIndex]) {
                        resolvedColor = snakePalette[colorIndex]
                    }
                }

                // Fallback to first palette color if no color set
                if (!resolvedColor || resolvedColor === '') {
                    resolvedColor = snakePalette[0] || '#ffffff'
                }

                // Pair validation for tunnels: max 2 per color
                if (obstacleType === 'tunnel') {
                    const existingTunnelsWithColor = generatorOverlays.obstacles.filter(
                        o => o.type === 'tunnel' && o.color === resolvedColor
                    )
                    if (existingTunnelsWithColor.length >= 2) {
                        return // Block: already 2 tunnels with this color
                    }
                }

                const newObs = {
                    row,
                    col,
                    type: obstacleType,
                    color: resolvedColor,
                    count: undefined,
                    direction: obstacleType === 'tunnel' ? generatorSettings.tunnelDirection : undefined
                }

                setGeneratorOverlays(prev => ({
                    ...prev,
                    obstacles: [...prev.obstacles, { ...newObs, id: nextItemId }]
                }))
                setNextItemId(prev => prev + 1)

                if (onObstacleTypeUsed) {
                    onObstacleTypeUsed({ ...newObs, id: nextItemId })
                }
            }
        } else if (generatorTool === 'eraser') {
            setGeneratorOverlays(prev => ({
                arrows: prev.arrows.filter(a => a.row !== row || a.col !== col),
                obstacles: prev.obstacles.filter(o => o.row !== row || o.col !== col)
            }))
        }
    }

    // Mouse up handler to finalize arrow placement
    const handleMouseUp = () => {
        if (generatorTool === 'arrow' && arrowDragState.isDrawing) {
            const path = arrowDragState.path

            if (validatePath(path)) {
                // Check for collision at any cell in path
                const hasCollision = path.some(cell => {
                    const existingArrow = generatorOverlays.arrows.find(a =>
                        a.row === cell.row && a.col === cell.col ||
                        a.path?.some(p => p.row === cell.row && p.col === cell.col)
                    )
                    const existingObstacle = generatorOverlays.obstacles.find(o => o.row === cell.row && o.col === cell.col)
                    return existingArrow || existingObstacle
                })

                if (!hasCollision) {
                    // Resolve arrow color
                    let resolvedColor = generatorSettings.arrowColor
                    if (resolvedColor === 'random') {
                        const randomIndex = Math.floor(Math.random() * snakePalette.length)
                        resolvedColor = snakePalette[randomIndex] || '#ffffff'
                    } else if (!resolvedColor || resolvedColor === '') {
                        resolvedColor = snakePalette[0] || '#ffffff'
                    }

                    // Calculate direction from last segment
                    const endCell = path[path.length - 1]
                    let direction = 'up'
                    if (path.length >= 2) {
                        const prevCell = path[path.length - 2]
                        if (prevCell.row > endCell.row) direction = 'up'
                        else if (prevCell.row < endCell.row) direction = 'down'
                        else if (prevCell.col < endCell.col) direction = 'right'
                        else if (prevCell.col > endCell.col) direction = 'left'
                    }

                    // Create single arrow with full path
                    setGeneratorOverlays(prev => ({
                        ...prev,
                        arrows: [...prev.arrows, {
                            row: endCell.row,
                            col: endCell.col,
                            direction,
                            color: resolvedColor,
                            path: [...path],
                            id: nextItemId
                        }]
                    }))

                    // Removed auto-typing logic based on color as per user request

                    setNextItemId(prev => prev + 1)
                }
            }
        }

        // Finalize obstacle (wall/wall_break) placement
        const currentObstacleDrag = obstacleDragStateRef.current
        if (generatorTool === 'obstacle' && currentObstacleDrag.isDrawing) {
            const cells = currentObstacleDrag.cells

            if (cells.length > 0) {
                // Use first cell as the reference point
                const firstCell = cells[0]

                const newObs = {
                    row: firstCell.row,
                    col: firstCell.col,
                    type: currentObstacleDrag.type,
                    color: undefined,
                    count: currentObstacleDrag.type === 'wall_break' ? generatorSettings.obstacleCount : undefined,
                    cells: [...cells]
                }

                setGeneratorOverlays(prev => ({
                    ...prev,
                    obstacles: [...prev.obstacles, { ...newObs, id: nextItemId }]
                }))
                setNextItemId(prev => prev + 1)

                if (onObstacleTypeUsed) {
                    onObstacleTypeUsed({
                        ...newObs,
                        id: nextItemId, // Pass the ID to LeftSidebar
                        cells: cells  // Include cells in callback
                    } as any)
                }
            }
        }

        setArrowDragState({ isDrawing: false, path: [] })
        setObstacleDragState({ isDrawing: false, cells: [], type: '' })
    }

    // Global mouse up listener
    useEffect(() => {
        if (arrowDragState.isDrawing || obstacleDragState.isDrawing) {
            window.addEventListener('mouseup', handleMouseUp)
            return () => window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [arrowDragState, obstacleDragState, generatorTool, lengthRange, bendsRange, generatorSettings, generatorOverlays])

    if (isGenerating) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Loader2 size={48} className="animate-spin mb-4 text-purple-500" />
                <p>{t('generatingLevel')}</p>
            </div>
        )
    }

    if (!gridData) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 bg-gray-900/50">
                <div className="text-center p-8 bg-gray-800 rounded-2xl shadow-xl border border-gray-700">
                    <p className="text-2xl mb-2">{t('readyToGen')}</p>
                    <p className="text-sm text-gray-400">{t('pasteJsonPrompt')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full overflow-hidden flex flex-col bg-gray-900 relative">
            <GridCanvas
                gridData={gridData}
                onCellToggle={handleCellInteraction}
                onBulkCellToggle={() => { }}
                rows={gridData.length}
                cols={gridData[0].length}
                currentTool="pen"
                currentShape="rectangle"
                readOnlyGrid={true}
                overlays={generatorOverlays}
                previewPath={arrowDragState.isDrawing ? arrowDragState.path : undefined}
                previewObstacle={obstacleDragState.isDrawing ? { cells: obstacleDragState.cells, type: obstacleDragState.type } : undefined}
                onItemContextMenu={(e, item) => {
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        type: item.type,
                        data: {
                            ...item.data,
                            // Ensure ID is present even if item.data is just the clicked cell info
                            id: item.type === 'arrow'
                                ? generatorOverlays.arrows[item.index].id
                                : generatorOverlays.obstacles[item.index].id
                        },
                        index: item.index
                    })
                }}
                onValidate={onValidate}
                zoom={zoom}
                setZoom={setZoom}
                pan={pan}
                setPan={setPan}
                isZoomInitialized={isZoomInitialized}
                setIsZoomInitialized={setIsZoomInitialized}
            />

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Item ID Header */}
                    <div className="px-4 py-2 border-b border-gray-700 bg-gray-900/50 rounded-t-lg">
                        <span className="text-xs font-mono text-gray-400">{t('itemId')}: {contextMenu.data.id}</span>
                    </div>



                    {/* Delete - always available */}
                    <button
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-red-600/30 flex items-center gap-2"
                        onClick={() => {
                            if (contextMenu.type === 'arrow') {
                                const deletedArrow = generatorOverlays.arrows[contextMenu.index]
                                setGeneratorOverlays(prev => ({
                                    ...prev,
                                    arrows: prev.arrows.filter((_, i) => i !== contextMenu.index)
                                }))
                                // Sync delete with LeftSidebar
                                if (deletedArrow && onObstacleDelete) {
                                    onObstacleDelete(deletedArrow.row, deletedArrow.col)
                                }
                            } else {
                                // Get obstacle data before deleting
                                const deletedObs = generatorOverlays.obstacles[contextMenu.index]
                                setGeneratorOverlays(prev => ({
                                    ...prev,
                                    obstacles: prev.obstacles.filter((_, i) => i !== contextMenu.index)
                                }))
                                // Sync with LeftSidebar
                                if (deletedObs && onObstacleDelete) {
                                    onObstacleDelete(deletedObs.row, deletedObs.col)
                                }
                            }
                            setContextMenu(null)
                        }}
                    >
                        <Trash2 size={14} /> {t('delete')}
                    </button>

                    {/* Arrow-specific options */}
                    {contextMenu.type === 'arrow' && (
                        <>
                            <div className="border-t border-gray-700 my-1" />
                            <button
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                                onClick={() => {
                                    setGeneratorOverlays(prev => ({
                                        ...prev,
                                        arrows: prev.arrows.map((a, i) => {
                                            if (i !== contextMenu.index) return a

                                            // Reverse the path
                                            const reversedPath = a.path?.slice().reverse()
                                            if (!reversedPath || reversedPath.length < 2) return a

                                            // New end cell (was first cell)
                                            const newEndCell = reversedPath[reversedPath.length - 1]
                                            const prevCell = reversedPath[reversedPath.length - 2]

                                            // Calculate new direction based on last two cells
                                            let newDirection = a.direction
                                            const dr = newEndCell.row - prevCell.row
                                            const dc = newEndCell.col - prevCell.col
                                            if (dr === -1) newDirection = 'up'
                                            else if (dr === 1) newDirection = 'down'
                                            else if (dc === -1) newDirection = 'left'
                                            else if (dc === 1) newDirection = 'right'

                                            return {
                                                ...a,
                                                row: newEndCell.row,
                                                col: newEndCell.col,
                                                direction: newDirection,
                                                path: reversedPath
                                            }
                                        })
                                    }))
                                    setContextMenu(null)
                                }}
                            >
                                <RotateCcw size={14} /> {t('reverseDirection')}
                            </button>
                            <div className="px-4 py-2 text-sm text-gray-400 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Palette size={14} /> {t('color')}:
                                </div>
                                <ColorDropdown
                                    color={contextMenu.data.color || '#ffffff'}
                                    palette={snakePalette}
                                    onChange={(color) => {
                                        setGeneratorOverlays(prev => ({
                                            ...prev,
                                            arrows: prev.arrows.map((a, i) =>
                                                i === contextMenu.index ? { ...a, color } : a
                                            )
                                        }))
                                        // Update local context menu data to reflect change immediately?
                                        setContextMenu(prev => prev ? { ...prev, data: { ...prev.data, color } } : null)
                                    }}
                                />
                            </div>


                            {/* Key Snake Inputs */}
                            {contextMenu.data.type === 'keySnake' && (
                                <div className="px-4 py-2 space-y-2 border-t border-gray-700">
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="text-xs text-gray-400">{t('keyId')}</label>
                                        <input
                                            type="number"
                                            className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                            value={contextMenu.data.keyId || 0}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0
                                                setGeneratorOverlays(prev => ({
                                                    ...prev,
                                                    arrows: prev.arrows.map((a, i) =>
                                                        i === contextMenu.index ? { ...a, keyId: val } : a
                                                    )
                                                }))
                                                // Sync update
                                                onObstacleUpdate?.(contextMenu.data.row, contextMenu.data.col, { keySnakeId: val })
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="text-xs text-gray-400">{t('lockId')}</label>
                                        <input
                                            type="number"
                                            className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                            value={contextMenu.data.lockId || 0}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0
                                                setGeneratorOverlays(prev => ({
                                                    ...prev,
                                                    arrows: prev.arrows.map((a, i) =>
                                                        i === contextMenu.index ? { ...a, lockId: val } : a
                                                    )
                                                }))
                                                // Sync update
                                                onObstacleUpdate?.(contextMenu.data.row, contextMenu.data.col, { lockedSnakeId: val })
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Obstacle-specific options */}
                    {contextMenu.type === 'obstacle' && (
                        <>
                            {/* Color for tunnel/hole */}
                            {(contextMenu.data.type === 'tunnel' || contextMenu.data.type === 'hole') && (
                                <>
                                    <div className="border-t border-gray-700 my-1" />
                                    <div className="px-4 py-2 text-sm text-gray-400 flex items-center gap-2">
                                        <Palette size={14} /> {t('color')}:
                                        <div className="flex gap-1 flex-wrap">
                                            {snakePalette.slice(0, 5).map((color, idx) => (
                                                <button
                                                    key={idx}
                                                    className="w-5 h-5 rounded border border-gray-500 hover:scale-110 transition-transform"
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => {
                                                        const obs = generatorOverlays.obstacles[contextMenu.index]
                                                        setGeneratorOverlays(prev => ({
                                                            ...prev,
                                                            obstacles: prev.obstacles.map((o, i) =>
                                                                i === contextMenu.index ? { ...o, color } : o
                                                            )
                                                        }))
                                                        // Sync with LeftSidebar
                                                        if (obs && onObstacleUpdate) {
                                                            onObstacleUpdate(obs.row, obs.col, { color })
                                                        }
                                                        setContextMenu(null)
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Direction for tunnel */}
                            {contextMenu.data.type === 'tunnel' && (
                                <div className="px-4 py-2 text-sm text-gray-400 flex items-center gap-2">
                                    <ArrowUpDown size={14} /> {t('direction')}:
                                    <select
                                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                        value={contextMenu.data.direction || 'right'}
                                        onChange={(e) => {
                                            const obs = generatorOverlays.obstacles[contextMenu.index]
                                            const newDirection = e.target.value
                                            setGeneratorOverlays(prev => ({
                                                ...prev,
                                                obstacles: prev.obstacles.map((o, i) =>
                                                    i === contextMenu.index ? { ...o, direction: newDirection } : o
                                                )
                                            }))
                                            // Sync with LeftSidebar
                                            if (obs && onObstacleUpdate) {
                                                onObstacleUpdate(obs.row, obs.col, { direction: newDirection })
                                            }
                                            setContextMenu(null)
                                        }}
                                    >
                                        <option value="up">↑</option>
                                        <option value="down">↓</option>
                                        <option value="left">←</option>
                                        <option value="right">→</option>
                                    </select>
                                </div>
                            )}

                            {/* Countdown for wall_break */}
                            {contextMenu.data.type === 'wall_break' && (
                                <>
                                    <div className="border-t border-gray-700 my-1" />
                                    <div className="px-4 py-2 text-sm text-gray-400 flex items-center gap-2">
                                        <Hash size={14} /> {t('countdown')}:
                                        <input
                                            type="number"
                                            className="w-12 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                            defaultValue={contextMenu.data.count || 3}
                                            min={1}
                                            max={99}
                                            onClick={(e) => e.stopPropagation()}
                                            onBlur={(e) => {
                                                const obs = generatorOverlays.obstacles[contextMenu.index]
                                                const value = parseInt(e.target.value) || 3
                                                setGeneratorOverlays(prev => ({
                                                    ...prev,
                                                    obstacles: prev.obstacles.map((o, i) =>
                                                        i === contextMenu.index ? { ...o, count: value } : o
                                                    )
                                                }))
                                                // Sync with LeftSidebar
                                                if (obs && onObstacleUpdate) {
                                                    onObstacleUpdate(obs.row, obs.col, { wallBreakCounter: value })
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const obs = generatorOverlays.obstacles[contextMenu.index]
                                                    const value = parseInt((e.target as HTMLInputElement).value) || 3
                                                    setGeneratorOverlays(prev => ({
                                                        ...prev,
                                                        obstacles: prev.obstacles.map((o, i) =>
                                                            i === contextMenu.index ? { ...o, count: value } : o
                                                        )
                                                    }))
                                                    // Sync with LeftSidebar
                                                    if (obs && onObstacleUpdate) {
                                                        onObstacleUpdate(obs.row, obs.col, { wallBreakCounter: value })
                                                    }
                                                    setContextMenu(null)
                                                }
                                            }}
                                        />
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
