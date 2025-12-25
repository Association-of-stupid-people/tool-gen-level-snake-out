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
    // Selection Props
    selectedArrows?: Set<number>
    setSelectedArrows?: React.Dispatch<React.SetStateAction<Set<number>>>
    onDeleteSelectedArrows?: () => void
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
    setIsZoomInitialized,
    selectedArrows = new Set(),
    setSelectedArrows,
    onDeleteSelectedArrows
}: GeneratorPanelProps) {
    const { restrictDrawToColored, snakePalette, lengthRange, bendsRange, checkerboardView } = useSettings()
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

    // Marquee selection state
    const [marqueeSelection, setMarqueeSelection] = useState<{
        start: { row: number, col: number }
        end: { row: number, col: number }
    } | null>(null)
    const [isMarqueeDragging, setIsMarqueeDragging] = useState(false)
    const [rightClickStart, setRightClickStart] = useState<{ row: number, col: number, clientX: number, clientY: number } | null>(null)
    const [justFinishedMarquee, setJustFinishedMarquee] = useState(false) // Flag to prevent context menu after marquee
    const MARQUEE_DRAG_THRESHOLD = 5 // pixels

    // Path editing state
    const [editingArrowId, setEditingArrowId] = useState<number | null>(null)
    const [editingEnd, setEditingEnd] = useState<'head' | 'tail' | null>(null)
    const [_isDraggingNode, setIsDraggingNode] = useState(false)
    const [editingPath, setEditingPath] = useState<{ row: number, col: number }[] | null>(null)

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
        type: 'arrow' | 'obstacle' | 'bulk'
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

    // Bulk operations handlers
    const handleRecolorSelected = (newColor: string) => {
        if (!setSelectedArrows || selectedArrows.size === 0) return
        setGeneratorOverlays(prev => ({
            ...prev,
            arrows: prev.arrows.map(a =>
                selectedArrows.has(a.id) ? { ...a, color: newColor } : a
            )
        }))
        setContextMenu(null)
    }

    const handleFlipSelected = () => {
        if (!setSelectedArrows || selectedArrows.size === 0) return
        setGeneratorOverlays(prev => ({
            ...prev,
            arrows: prev.arrows.map(a => {
                if (!selectedArrows.has(a.id)) return a
                if (!a.path || a.path.length < 2) return a

                const reversedPath = [...a.path].reverse()
                const newEnd = reversedPath[reversedPath.length - 1]
                const prevCell = reversedPath[reversedPath.length - 2]

                // Calculate new direction
                let newDirection = a.direction
                const dr = newEnd.row - prevCell.row
                const dc = newEnd.col - prevCell.col
                if (dr === -1) newDirection = 'up'
                else if (dr === 1) newDirection = 'down'
                else if (dc === -1) newDirection = 'left'
                else if (dc === 1) newDirection = 'right'

                return {
                    ...a,
                    row: newEnd.row,
                    col: newEnd.col,
                    direction: newDirection,
                    path: reversedPath
                }
            })
        }))
        setContextMenu(null)
    }

    // Handle node handle click for path editing
    const handleNodeHandleClick = (arrowId: number, end: 'head' | 'tail', _row: number, _col: number, _e: React.MouseEvent) => {
        if (selectedArrows.size !== 1) return

        const arrow = generatorOverlays.arrows.find(a => a.id === arrowId)
        if (!arrow || !arrow.path || arrow.path.length === 0) return

        setEditingArrowId(arrowId)
        setEditingEnd(end)
        setIsDraggingNode(true)

        // Initialize editing path
        // For head editing, reverse path so we edit from start
        // For tail editing, use path as-is
        if (end === 'head') {
            setEditingPath([...arrow.path].reverse())
        } else {
            setEditingPath([...arrow.path])
        }
    }

    // Handle path editing drag
    const handlePathEditMove = (row: number, col: number) => {
        if (!editingArrowId || !editingEnd || !editingPath || editingPath.length === 0) return

        const arrow = generatorOverlays.arrows.find(a => a.id === editingArrowId)
        if (!arrow) return

        // Get current path
        let newPath = [...editingPath]
        const lastCell = newPath[newPath.length - 1]

        // Check if moving to adjacent cell
        if (isAdjacent(lastCell, { row, col })) {
            // Check if moving back into the path (shorten)
            const indexInPath = newPath.findIndex(p => p.row === row && p.col === col)
            if (indexInPath >= 0 && indexInPath < newPath.length - 1) {
                // Shorten: remove cells from indexInPath+1 to end
                newPath = newPath.slice(0, indexInPath + 1)
            } else {
                // Extend: check for collisions
                // Check self-intersection (cannot cross own path except the handle itself)
                const isSelfIntersecting = newPath.slice(0, -1).some(p => p.row === row && p.col === col)

                // Check collision with other arrows
                const isCollidingWithOtherArrow = generatorOverlays.arrows.some(otherArrow => {
                    if (otherArrow.id === editingArrowId) return false // Skip self

                    // Check if new cell overlaps with other arrow's head
                    if (otherArrow.row === row && otherArrow.col === col) return true

                    // Check if new cell overlaps with other arrow's path
                    if (otherArrow.path?.some(p => p.row === row && p.col === col)) return true

                    return false
                })

                if (!isSelfIntersecting && !isCollidingWithOtherArrow) {
                    // Add new cell (extend)
                    newPath = [...newPath, { row, col }]
                }
            }
        }

        setEditingPath(newPath)
    }

    // Commit path editing
    const handlePathEditCommit = () => {
        if (!editingArrowId || !editingEnd || !editingPath || editingPath.length === 0) {
            setEditingArrowId(null)
            setEditingEnd(null)
            setIsDraggingNode(false)
            setEditingPath(null)
            return
        }

        const arrow = generatorOverlays.arrows.find(a => a.id === editingArrowId)
        if (!arrow) return

        // Validate path
        let finalPath = [...editingPath]

        // If editing head, reverse back to original order
        if (editingEnd === 'head') {
            finalPath = finalPath.reverse()
        }

        if (validatePath(finalPath)) {
            // Update arrow with new path
            if (editingEnd === 'tail') {
                // Editing tail: update end cell and direction
                let newEndCell = finalPath[finalPath.length - 1]
                let newDirection = arrow.direction

                // Calculate direction from last segment
                if (finalPath.length >= 2) {
                    const prevCell = finalPath[finalPath.length - 2]
                    const dr = newEndCell.row - prevCell.row
                    const dc = newEndCell.col - prevCell.col
                    if (dr === -1) newDirection = 'up'
                    else if (dr === 1) newDirection = 'down'
                    else if (dc === -1) newDirection = 'left'
                    else if (dc === 1) newDirection = 'right'
                }

                // Update arrow
                setGeneratorOverlays(prev => ({
                    ...prev,
                    arrows: prev.arrows.map(a => {
                        if (a.id !== editingArrowId) return a
                        return {
                            ...a,
                            row: newEndCell.row,
                            col: newEndCell.col,
                            direction: newDirection,
                            path: finalPath
                        }
                    })
                }))
            } else {
                // Editing head: only update path (arrow.row/col remains the tail)
                // Direction is calculated from tail segment
                let newDirection = arrow.direction
                if (finalPath.length >= 2) {
                    const tailCell = finalPath[finalPath.length - 1]
                    const prevCell = finalPath[finalPath.length - 2]
                    const dr = tailCell.row - prevCell.row
                    const dc = tailCell.col - prevCell.col
                    if (dr === -1) newDirection = 'up'
                    else if (dr === 1) newDirection = 'down'
                    else if (dc === -1) newDirection = 'left'
                    else if (dc === 1) newDirection = 'right'
                }

                setGeneratorOverlays(prev => ({
                    ...prev,
                    arrows: prev.arrows.map(a => {
                        if (a.id !== editingArrowId) return a
                        return {
                            ...a,
                            direction: newDirection,
                            path: finalPath
                        }
                    })
                }))
            }
        }

        // Reset editing state
        setEditingArrowId(null)
        setEditingEnd(null)
        setIsDraggingNode(false)
        setEditingPath(null)
    }

    // Auto-set editing state when exactly 1 arrow is selected
    useEffect(() => {
        if (selectedArrows.size === 1 && !editingArrowId) {
            const selectedArrow = generatorOverlays.arrows.find(a => selectedArrows.has(a.id))
            if (selectedArrow && selectedArrow.path && selectedArrow.path.length > 0) {
                // Ready for editing, but don't auto-start
                // Handles will be shown, user needs to click on handle to start editing
            } else {
                // Arrow not found - clear editing state
                setEditingArrowId(null)
                setEditingEnd(null)
                setIsDraggingNode(false)
                setEditingPath(null)
            }
        } else if (selectedArrows.size !== 1) {
            // Clear editing state if selection changes
            if (editingArrowId) {
                setEditingArrowId(null)
                setEditingEnd(null)
                setIsDraggingNode(false)
                setEditingPath(null)
            }
        }

        // Also check if editing arrow still exists
        if (editingArrowId) {
            const editingArrow = generatorOverlays.arrows.find(a => a.id === editingArrowId)
            if (!editingArrow) {
                // Arrow was deleted - clear editing state
                setEditingArrowId(null)
                setEditingEnd(null)
                setIsDraggingNode(false)
                setEditingPath(null)
            }
        }
    }, [selectedArrows, generatorOverlays.arrows, editingArrowId])

    // Handle arrow click for selection
    const handleArrowClick = (arrowId: number, shiftKey: boolean) => {
        if (!setSelectedArrows) return

        if (shiftKey === true) {
            // Shift+click: Add to selection (multi-select)
            setSelectedArrows(prev => {
                const newSet = new Set(prev)
                newSet.add(arrowId)
                return newSet
            })
        } else {
            // Normal click: Single selection (replace existing selection)
            setSelectedArrows(new Set([arrowId]))
        }
    }

    // Handle right-click mouse events for marquee selection
    const handleRightMouseDown = (row: number, col: number, e: React.MouseEvent) => {
        if (!gridData || !gridData[row] || !setSelectedArrows) return

        // Check if clicked on arrow or obstacle - if yes, don't start marquee
        const clickedArrow = generatorOverlays.arrows.find(a => {
            if (a.row === row && a.col === col) return true
            if (a.path?.some(p => p.row === row && p.col === col)) return true
            return false
        })
        const clickedObstacle = generatorOverlays.obstacles.find(o => {
            if (o.row === row && o.col === col) return true
            if (o.cells?.some(c => c.row === row && c.col === col)) return true
            return false
        })

        if (clickedArrow || clickedObstacle) {
            // Clicked on item - don't start marquee, let context menu handle it
            return
        }

        // Clicked on empty space - start marquee
        setRightClickStart({ row, col, clientX: e.clientX, clientY: e.clientY })
        setMarqueeSelection({ start: { row, col }, end: { row, col } })
        setIsMarqueeDragging(false) // Will be set to true when drag threshold is reached
    }

    const handleRightMouseMove = (row: number, col: number, e: React.MouseEvent) => {
        if (!rightClickStart || !setSelectedArrows) return

        // Always update end position for visual preview
        // Calculate bounding box
        const minRow = Math.min(rightClickStart.row, row)
        const maxRow = Math.max(rightClickStart.row, row)
        const minCol = Math.min(rightClickStart.col, col)
        const maxCol = Math.max(rightClickStart.col, col)

        // Check if drag threshold is reached
        const dx = e.clientX - rightClickStart.clientX
        const dy = e.clientY - rightClickStart.clientY
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Find all cells that contain arrows within the box (only if threshold reached)
        let arrowCells: { row: number, col: number }[] | undefined = undefined
        if (distance > MARQUEE_DRAG_THRESHOLD) {
            // Start marquee drag
            setIsMarqueeDragging(true)

            arrowCells = []
            generatorOverlays.arrows.forEach(arrow => {
                const allCells = arrow.path ? [...arrow.path] : []
                allCells.push({ row: arrow.row, col: arrow.col })

                allCells.forEach(cell => {
                    if (cell.row >= minRow && cell.row <= maxRow &&
                        cell.col >= minCol && cell.col <= maxCol) {
                        // Avoid duplicates
                        if (!arrowCells!.some(c => c.row === cell.row && c.col === cell.col)) {
                            arrowCells!.push(cell)
                        }
                    }
                })
            })
        }

        // Always update marquee selection for visual preview
        setMarqueeSelection(prev => ({
            start: prev ? prev.start : { row: rightClickStart.row, col: rightClickStart.col },
            end: { row, col },
            arrowCells
        }))
    }

    const handleRightMouseUp = (_row: number, _col: number, e: React.MouseEvent) => {
        if (!rightClickStart || !setSelectedArrows) {
            setRightClickStart(null)
            return
        }

        const wasMarqueeDragging = isMarqueeDragging

        if (isMarqueeDragging && marqueeSelection) {
            // Finish marquee selection (drag completed)
            const minRow = Math.min(marqueeSelection.start.row, marqueeSelection.end.row)
            const maxRow = Math.max(marqueeSelection.start.row, marqueeSelection.end.row)
            const minCol = Math.min(marqueeSelection.start.col, marqueeSelection.end.col)
            const maxCol = Math.max(marqueeSelection.start.col, marqueeSelection.end.col)

            // Find arrows that intersect with the selection box
            const arrowsInBox = generatorOverlays.arrows.filter(arrow => {
                // Check if any cell of the arrow is in the box
                const allCells = arrow.path ? [...arrow.path] : []
                // Include head cell
                allCells.push({ row: arrow.row, col: arrow.col })

                return allCells.some(cell =>
                    cell.row >= minRow && cell.row <= maxRow &&
                    cell.col >= minCol && cell.col <= maxCol
                )
            })

            // Update selection
            if (e.shiftKey) {
                // Add to existing selection
                setSelectedArrows(prev => {
                    const newSet = new Set(prev)
                    arrowsInBox.forEach(arrow => newSet.add(arrow.id))
                    return newSet
                })
            } else {
                // Replace selection
                setSelectedArrows(new Set(arrowsInBox.map(arrow => arrow.id)))
            }
        } else {
            // No drag - this was a click on empty space, deselect all
            if (!e.shiftKey) {
                setSelectedArrows(new Set())
            }
        }

        // Clear marquee
        setMarqueeSelection(null)
        setIsMarqueeDragging(false)

        // Set flag to prevent context menu if marquee was dragged
        if (wasMarqueeDragging) {
            setJustFinishedMarquee(true)
            // Clear flag after a short delay
            setTimeout(() => setJustFinishedMarquee(false), 100)
        }

        setRightClickStart(null)
    }


    const handleCellInteraction = (row: number, col: number, _mode?: 'draw' | 'erase', e?: React.MouseEvent) => {
        if (!gridData || !gridData[row] || gridData[row][col] === undefined) return

        // Selection mode: only allow when NOT actively drawing an arrow/obstacle
        // This prevents accidental selection when mouse moves over existing arrows while drawing
        if (setSelectedArrows && !arrowDragState.isDrawing && !obstacleDragState.isDrawing) {
            // Check if clicked on an arrow (head or path)
            const clickedArrow = generatorOverlays.arrows.find(a => {
                // Check head cell
                if (a.row === row && a.col === col) return true
                // Check path cells
                if (a.path?.some(p => p.row === row && p.col === col)) return true
                return false
            })

            if (clickedArrow) {
                // Clicked on arrow - allow selection regardless of tool
                const isShiftPressed = e?.shiftKey === true
                handleArrowClick(clickedArrow.id, isShiftPressed)
                return
            } else {
                // Clicked on empty space - deselect (regardless of tool, unless shift is held)
                if (!e?.shiftKey && selectedArrows.size > 0) {
                    setSelectedArrows(new Set())
                }
                // Don't return here - allow other tools to continue processing
            }
        }

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

    // Cancel drawing with right-click
    const handleCancelDraw = (e: MouseEvent) => {
        if (e.button === 2) { // Right click
            e.preventDefault()
            setArrowDragState({ isDrawing: false, path: [] })
            setObstacleDragState({ isDrawing: false, cells: [], type: '' })
        }
    }

    // Global mouse up listener
    useEffect(() => {
        if (arrowDragState.isDrawing || obstacleDragState.isDrawing) {
            window.addEventListener('mouseup', handleMouseUp)
            window.addEventListener('mousedown', handleCancelDraw)
            window.addEventListener('contextmenu', (e) => e.preventDefault()) // Prevent context menu while drawing
            return () => {
                window.removeEventListener('mouseup', handleMouseUp)
                window.removeEventListener('mousedown', handleCancelDraw)
            }
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
                selectedArrows={selectedArrows}
                marqueeSelection={marqueeSelection}
                onRightMouseDown={handleRightMouseDown}
                onRightMouseMove={handleRightMouseMove}
                onRightMouseUp={handleRightMouseUp}
                justFinishedMarquee={justFinishedMarquee}
                editingArrowId={editingArrowId}
                editingEnd={editingEnd}
                editingPath={editingPath}
                onNodeHandleClick={handleNodeHandleClick}
                onPathEditMove={handlePathEditMove}
                onPathEditCommit={handlePathEditCommit}
                checkerboardView={checkerboardView}
                onItemContextMenu={(e, item) => {
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        type: item.type,
                        data: item.type === 'bulk'
                            ? item.data
                            : {
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
                    {/* Item ID Header - only show for single items */}
                    {contextMenu.type !== 'bulk' && (
                        <div className="px-4 py-2 border-b border-gray-700 bg-gray-900/50 rounded-t-lg">
                            <span className="text-xs font-mono text-gray-400">{t('itemId')}: {contextMenu.data.id}</span>
                        </div>
                    )}

                    {/* Bulk Operations Header */}
                    {contextMenu.type === 'bulk' && (
                        <div className="px-4 py-2 border-b border-gray-700 bg-gray-900/50 rounded-t-lg">
                            <span className="text-xs font-mono text-gray-400">{contextMenu.data.selectedCount} arrows selected</span>
                        </div>
                    )}

                    {/* Delete - always available */}
                    <button
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-red-600/30 flex items-center gap-2"
                        onClick={() => {
                            if (contextMenu.type === 'bulk') {
                                // Delete all selected arrows
                                if (onDeleteSelectedArrows) {
                                    onDeleteSelectedArrows()
                                }
                            } else if (contextMenu.type === 'arrow') {
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
                        <Trash2 size={14} /> {contextMenu.type === 'bulk' ? `Delete ${contextMenu.data.selectedCount} arrows` : t('delete')}
                    </button>

                    {/* Bulk Operations */}
                    {contextMenu.type === 'bulk' && (
                        <>
                            <div className="border-t border-gray-700 my-1" />
                            <button
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                                onClick={() => handleFlipSelected()}
                            >
                                <RotateCcw size={14} /> Flip Selected ({contextMenu.data.selectedCount})
                            </button>
                            <div className="px-4 py-2 text-sm text-gray-400 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Palette size={14} /> Recolor Selected:
                                </div>
                                <ColorDropdown
                                    color={snakePalette[0] || '#ffffff'}
                                    palette={snakePalette}
                                    onChange={(color) => handleRecolorSelected(color)}
                                />
                            </div>
                        </>
                    )}

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
