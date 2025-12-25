import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSettings } from '../stores'
import { isAdjacent, validatePath as validatePathUtil } from '../utils/pathUtils'

// Types for the hook
export interface GeneratorOverlays {
    arrows: {
        id: number
        row: number
        col: number
        direction: string
        color: string
        path?: { row: number; col: number }[]
        type?: string
        keyId?: number
        lockId?: number
    }[]
    obstacles: {
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
    }[]
}

export interface GeneratorSettings {
    arrowColor: string
    obstacleType: string
    obstacleColor: string
    obstacleCount: number
    tunnelDirection: string
}

export interface UseGeneratorInteractionProps {
    gridData: boolean[][] | null
    generatorTool: 'none' | 'arrow' | 'obstacle' | 'eraser'
    generatorSettings: GeneratorSettings
    generatorOverlays: GeneratorOverlays
    setGeneratorOverlays: (data: GeneratorOverlays | ((prev: GeneratorOverlays) => GeneratorOverlays)) => void
    setGridData?: (data: boolean[][] | ((prev: boolean[][]) => boolean[][])) => void
    nextItemId: number
    setNextItemId: React.Dispatch<React.SetStateAction<number>>
    selectedArrows: Set<number>
    setSelectedArrows?: React.Dispatch<React.SetStateAction<Set<number>>>
    onObstacleTypeUsed?: (data: any) => void
}

export function useGeneratorInteraction({
    gridData,
    generatorTool,
    generatorSettings,
    generatorOverlays,
    setGeneratorOverlays,
    setGridData,
    nextItemId,
    setNextItemId,
    selectedArrows,
    setSelectedArrows,
    onObstacleTypeUsed,
}: UseGeneratorInteractionProps) {
    const { restrictDrawToColored, snakePalette, lengthRange, bendsRange } = useSettings()

    // Arrow drag state for path-based drawing
    const [arrowDragState, setArrowDragState] = useState<{
        isDrawing: boolean
        path: { row: number; col: number }[]
    }>({ isDrawing: false, path: [] })

    // Marquee selection state
    const [marqueeSelection, setMarqueeSelection] = useState<{
        start: { row: number; col: number }
        end: { row: number; col: number }
        arrowCells?: { row: number; col: number }[]
    } | null>(null)
    const [isMarqueeDragging, setIsMarqueeDragging] = useState(false)
    const [rightClickStart, setRightClickStart] = useState<{
        row: number
        col: number
        clientX: number
        clientY: number
    } | null>(null)
    const [justFinishedMarquee, setJustFinishedMarquee] = useState(false)
    const MARQUEE_DRAG_THRESHOLD = 5

    // Path editing state
    const [editingArrowId, setEditingArrowId] = useState<number | null>(null)
    const [editingEnd, setEditingEnd] = useState<'head' | 'tail' | null>(null)
    const [_isDraggingNode, setIsDraggingNode] = useState(false)
    const [editingPath, setEditingPath] = useState<{ row: number; col: number }[] | null>(null)

    // Obstacle drag state for wall/wallbreak drawing
    const [obstacleDragState, setObstacleDragState] = useState<{
        isDrawing: boolean
        cells: { row: number; col: number }[]
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

    // Wrapper for validatePath with current settings
    const validatePath = useCallback(
        (path: { row: number; col: number }[]): boolean => {
            return validatePathUtil(path, lengthRange, bendsRange)
        },
        [lengthRange, bendsRange]
    )

    // Bulk operations handlers
    const handleRecolorSelected = useCallback(
        (newColor: string) => {
            if (!setSelectedArrows || selectedArrows.size === 0) return
            setGeneratorOverlays((prev) => ({
                ...prev,
                arrows: prev.arrows.map((a) =>
                    selectedArrows.has(a.id) ? { ...a, color: newColor } : a
                ),
            }))
            setContextMenu(null)
        },
        [selectedArrows, setSelectedArrows, setGeneratorOverlays]
    )

    const handleFlipSelected = useCallback(() => {
        if (!setSelectedArrows || selectedArrows.size === 0) return
        setGeneratorOverlays((prev) => ({
            ...prev,
            arrows: prev.arrows.map((a) => {
                if (!selectedArrows.has(a.id)) return a
                if (!a.path || a.path.length < 2) return a

                const reversedPath = [...a.path].reverse()
                const newEnd = reversedPath[reversedPath.length - 1]
                const prevCell = reversedPath[reversedPath.length - 2]

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
                    path: reversedPath,
                }
            }),
        }))
        setContextMenu(null)
    }, [selectedArrows, setSelectedArrows, setGeneratorOverlays])

    // Handle node handle click for path editing
    const handleNodeHandleClick = useCallback(
        (arrowId: number, end: 'head' | 'tail', _row: number, _col: number, _e: React.MouseEvent) => {
            if (selectedArrows.size !== 1) return

            const arrow = generatorOverlays.arrows.find((a) => a.id === arrowId)
            if (!arrow || !arrow.path || arrow.path.length === 0) return

            setEditingArrowId(arrowId)
            setEditingEnd(end)
            setIsDraggingNode(true)

            if (end === 'head') {
                setEditingPath([...arrow.path].reverse())
            } else {
                setEditingPath([...arrow.path])
            }
        },
        [selectedArrows, generatorOverlays.arrows]
    )

    // Handle path editing drag
    const handlePathEditMove = useCallback(
        (row: number, col: number) => {
            if (!editingArrowId || !editingEnd || !editingPath || editingPath.length === 0) return

            const arrow = generatorOverlays.arrows.find((a) => a.id === editingArrowId)
            if (!arrow) return

            let newPath = [...editingPath]
            const lastCell = newPath[newPath.length - 1]

            if (isAdjacent(lastCell, { row, col })) {
                const indexInPath = newPath.findIndex((p) => p.row === row && p.col === col)
                if (indexInPath >= 0 && indexInPath < newPath.length - 1) {
                    newPath = newPath.slice(0, indexInPath + 1)
                } else {
                    const isSelfIntersecting = newPath.slice(0, -1).some((p) => p.row === row && p.col === col)
                    const isCollidingWithOtherArrow = generatorOverlays.arrows.some((otherArrow) => {
                        if (otherArrow.id === editingArrowId) return false
                        if (otherArrow.row === row && otherArrow.col === col) return true
                        if (otherArrow.path?.some((p) => p.row === row && p.col === col)) return true
                        return false
                    })

                    if (!isSelfIntersecting && !isCollidingWithOtherArrow) {
                        newPath = [...newPath, { row, col }]
                    }
                }
            }

            setEditingPath(newPath)
        },
        [editingArrowId, editingEnd, editingPath, generatorOverlays.arrows]
    )

    // Commit path editing
    const handlePathEditCommit = useCallback(() => {
        if (!editingArrowId || !editingEnd || !editingPath || editingPath.length === 0) {
            setEditingArrowId(null)
            setEditingEnd(null)
            setIsDraggingNode(false)
            setEditingPath(null)
            return
        }

        const arrow = generatorOverlays.arrows.find((a) => a.id === editingArrowId)
        if (!arrow) return

        let finalPath = [...editingPath]
        if (editingEnd === 'head') {
            finalPath = finalPath.reverse()
        }

        if (validatePath(finalPath)) {
            if (editingEnd === 'tail') {
                const newEndCell = finalPath[finalPath.length - 1]
                let newDirection = arrow.direction

                if (finalPath.length >= 2) {
                    const prevCell = finalPath[finalPath.length - 2]
                    const dr = newEndCell.row - prevCell.row
                    const dc = newEndCell.col - prevCell.col
                    if (dr === -1) newDirection = 'up'
                    else if (dr === 1) newDirection = 'down'
                    else if (dc === -1) newDirection = 'left'
                    else if (dc === 1) newDirection = 'right'
                }

                setGeneratorOverlays((prev) => ({
                    ...prev,
                    arrows: prev.arrows.map((a) => {
                        if (a.id !== editingArrowId) return a
                        return {
                            ...a,
                            row: newEndCell.row,
                            col: newEndCell.col,
                            direction: newDirection,
                            path: finalPath,
                        }
                    }),
                }))
            } else {
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

                setGeneratorOverlays((prev) => ({
                    ...prev,
                    arrows: prev.arrows.map((a) => {
                        if (a.id !== editingArrowId) return a
                        return {
                            ...a,
                            direction: newDirection,
                            path: finalPath,
                        }
                    }),
                }))
            }
        }

        setEditingArrowId(null)
        setEditingEnd(null)
        setIsDraggingNode(false)
        setEditingPath(null)
    }, [editingArrowId, editingEnd, editingPath, generatorOverlays.arrows, validatePath, setGeneratorOverlays])

    // Auto-set editing state when exactly 1 arrow is selected
    useEffect(() => {
        if (selectedArrows.size === 1 && !editingArrowId) {
            const selectedArrow = generatorOverlays.arrows.find((a) => selectedArrows.has(a.id))
            if (!selectedArrow || !selectedArrow.path || selectedArrow.path.length === 0) {
                setEditingArrowId(null)
                setEditingEnd(null)
                setIsDraggingNode(false)
                setEditingPath(null)
            }
        } else if (selectedArrows.size !== 1) {
            if (editingArrowId) {
                setEditingArrowId(null)
                setEditingEnd(null)
                setIsDraggingNode(false)
                setEditingPath(null)
            }
        }

        if (editingArrowId) {
            const editingArrow = generatorOverlays.arrows.find((a) => a.id === editingArrowId)
            if (!editingArrow) {
                setEditingArrowId(null)
                setEditingEnd(null)
                setIsDraggingNode(false)
                setEditingPath(null)
            }
        }
    }, [selectedArrows, generatorOverlays.arrows, editingArrowId])

    // Handle arrow click for selection
    const handleArrowClick = useCallback(
        (arrowId: number, shiftKey: boolean) => {
            if (!setSelectedArrows) return

            if (shiftKey === true) {
                setSelectedArrows((prev) => {
                    const newSet = new Set(prev)
                    newSet.add(arrowId)
                    return newSet
                })
            } else {
                setSelectedArrows(new Set([arrowId]))
            }
        },
        [setSelectedArrows]
    )

    // Handle right-click mouse events for marquee selection
    const handleRightMouseDown = useCallback(
        (row: number, col: number, e: React.MouseEvent) => {
            if (!gridData || !gridData[row] || !setSelectedArrows) return

            const clickedArrow = generatorOverlays.arrows.find((a) => {
                if (a.row === row && a.col === col) return true
                if (a.path?.some((p) => p.row === row && p.col === col)) return true
                return false
            })
            const clickedObstacle = generatorOverlays.obstacles.find((o) => {
                if (o.row === row && o.col === col) return true
                if (o.cells?.some((c) => c.row === row && c.col === col)) return true
                return false
            })

            if (clickedArrow || clickedObstacle) {
                return
            }

            setRightClickStart({ row, col, clientX: e.clientX, clientY: e.clientY })
            setMarqueeSelection({ start: { row, col }, end: { row, col } })
            setIsMarqueeDragging(false)
        },
        [gridData, generatorOverlays, setSelectedArrows]
    )

    const handleRightMouseMove = useCallback(
        (row: number, col: number, e: React.MouseEvent) => {
            if (!rightClickStart || !setSelectedArrows) return

            const minRow = Math.min(rightClickStart.row, row)
            const maxRow = Math.max(rightClickStart.row, row)
            const minCol = Math.min(rightClickStart.col, col)
            const maxCol = Math.max(rightClickStart.col, col)

            const dx = e.clientX - rightClickStart.clientX
            const dy = e.clientY - rightClickStart.clientY
            const distance = Math.sqrt(dx * dx + dy * dy)

            let arrowCells: { row: number; col: number }[] | undefined = undefined
            if (distance > MARQUEE_DRAG_THRESHOLD) {
                setIsMarqueeDragging(true)

                arrowCells = []
                generatorOverlays.arrows.forEach((arrow) => {
                    const allCells = arrow.path ? [...arrow.path] : []
                    allCells.push({ row: arrow.row, col: arrow.col })

                    allCells.forEach((cell) => {
                        if (
                            cell.row >= minRow &&
                            cell.row <= maxRow &&
                            cell.col >= minCol &&
                            cell.col <= maxCol
                        ) {
                            if (!arrowCells!.some((c) => c.row === cell.row && c.col === cell.col)) {
                                arrowCells!.push(cell)
                            }
                        }
                    })
                })
            }

            setMarqueeSelection((prev) => ({
                start: prev ? prev.start : { row: rightClickStart.row, col: rightClickStart.col },
                end: { row, col },
                arrowCells,
            }))
        },
        [rightClickStart, generatorOverlays.arrows, setSelectedArrows]
    )

    const handleRightMouseUp = useCallback(
        (_row: number, _col: number, e: React.MouseEvent) => {
            if (!rightClickStart || !setSelectedArrows) {
                setRightClickStart(null)
                return
            }

            const wasMarqueeDragging = isMarqueeDragging

            if (isMarqueeDragging && marqueeSelection) {
                const minRow = Math.min(marqueeSelection.start.row, marqueeSelection.end.row)
                const maxRow = Math.max(marqueeSelection.start.row, marqueeSelection.end.row)
                const minCol = Math.min(marqueeSelection.start.col, marqueeSelection.end.col)
                const maxCol = Math.max(marqueeSelection.start.col, marqueeSelection.end.col)

                const arrowsInBox = generatorOverlays.arrows.filter((arrow) => {
                    const allCells = arrow.path ? [...arrow.path] : []
                    allCells.push({ row: arrow.row, col: arrow.col })

                    return allCells.some(
                        (cell) =>
                            cell.row >= minRow &&
                            cell.row <= maxRow &&
                            cell.col >= minCol &&
                            cell.col <= maxCol
                    )
                })

                if (e.shiftKey) {
                    setSelectedArrows((prev) => {
                        const newSet = new Set(prev)
                        arrowsInBox.forEach((arrow) => newSet.add(arrow.id))
                        return newSet
                    })
                } else {
                    setSelectedArrows(new Set(arrowsInBox.map((arrow) => arrow.id)))
                }
            } else {
                if (!e.shiftKey) {
                    setSelectedArrows(new Set())
                }
            }

            setMarqueeSelection(null)
            setIsMarqueeDragging(false)

            if (wasMarqueeDragging) {
                setJustFinishedMarquee(true)
                setTimeout(() => setJustFinishedMarquee(false), 100)
            }

            setRightClickStart(null)
        },
        [rightClickStart, isMarqueeDragging, marqueeSelection, generatorOverlays.arrows, setSelectedArrows]
    )

    // Main cell interaction handler
    const handleCellInteraction = useCallback(
        (row: number, col: number, _mode?: 'draw' | 'erase', e?: React.MouseEvent) => {
            if (!gridData || !gridData[row] || gridData[row][col] === undefined) return

            // Selection mode
            if (setSelectedArrows && !arrowDragState.isDrawing && !obstacleDragState.isDrawing) {
                const clickedArrow = generatorOverlays.arrows.find((a) => {
                    if (a.row === row && a.col === col) return true
                    if (a.path?.some((p) => p.row === row && p.col === col)) return true
                    return false
                })

                if (clickedArrow) {
                    const isShiftPressed = e?.shiftKey === true
                    handleArrowClick(clickedArrow.id, isShiftPressed)
                    return
                } else {
                    if (!e?.shiftKey && selectedArrows.size > 0) {
                        setSelectedArrows(new Set())
                    }
                }
            }

            if (restrictDrawToColored && !gridData[row][col]) return

            if (setGridData && !gridData[row][col] && (generatorTool === 'arrow' || generatorTool === 'obstacle')) {
                setGridData((prev: boolean[][]) => {
                    const newGrid = prev.map((r: boolean[]) => [...r])
                    newGrid[row][col] = true
                    return newGrid
                })
            }

            if (generatorTool === 'arrow') {
                const existingArrow = generatorOverlays.arrows.find(
                    (a) =>
                        (a.row === row && a.col === col) ||
                        a.path?.some((p) => p.row === row && p.col === col)
                )
                const existingObstacle = generatorOverlays.obstacles.find(
                    (o) => o.row === row && o.col === col
                )

                if (existingArrow || existingObstacle) {
                    return
                }

                if (!arrowDragState.isDrawing) {
                    setArrowDragState({ isDrawing: true, path: [{ row, col }] })
                } else {
                    const lastCell = arrowDragState.path[arrowDragState.path.length - 1]

                    if (arrowDragState.path.length > 1) {
                        const prevCell = arrowDragState.path[arrowDragState.path.length - 2]
                        if (prevCell.row === row && prevCell.col === col) {
                            setArrowDragState((prev) => ({
                                ...prev,
                                path: prev.path.slice(0, -1),
                            }))
                            return
                        }
                    }

                    const isSelfIntersecting = arrowDragState.path.some(
                        (p) => p.row === row && p.col === col
                    )
                    if (isSelfIntersecting) {
                        return
                    }

                    if (isAdjacent(lastCell, { row, col })) {
                        setArrowDragState((prev) => ({
                            ...prev,
                            path: [...prev.path, { row, col }],
                        }))
                    }
                }
            } else if (generatorTool === 'obstacle') {
                const obstacleType = generatorSettings.obstacleType

                const existingObstacle = generatorOverlays.obstacles.find(
                    (o) =>
                        (o.row === row && o.col === col) ||
                        o.cells?.some((c) => c.row === row && c.col === col)
                )
                const existingArrow = generatorOverlays.arrows.find(
                    (a) =>
                        (a.row === row && a.col === col) ||
                        a.path?.some((p) => p.row === row && p.col === col)
                )

                if (existingObstacle || existingArrow) {
                    return
                }

                if (obstacleType === 'wall' || obstacleType === 'wall_break') {
                    if (!obstacleDragState.isDrawing) {
                        setObstacleDragState({ isDrawing: true, cells: [{ row, col }], type: obstacleType })
                    } else if (obstacleDragState.type === obstacleType) {
                        setObstacleDragState((prev) => {
                            const isSelfIntersecting = prev.cells.some(
                                (c) => c.row === row && c.col === col
                            )
                            if (isSelfIntersecting) return prev
                            return { ...prev, cells: [...prev.cells, { row, col }] }
                        })
                    }
                } else {
                    let resolvedColor = generatorSettings.obstacleColor
                    if (resolvedColor && resolvedColor.startsWith('Color ')) {
                        const colorIndex = parseInt(resolvedColor.replace('Color ', '')) - 1
                        if (snakePalette[colorIndex]) {
                            resolvedColor = snakePalette[colorIndex]
                        }
                    }
                    if (!resolvedColor || resolvedColor === '') {
                        resolvedColor = snakePalette[0] || '#ffffff'
                    }

                    if (obstacleType === 'tunnel') {
                        const existingTunnelsWithColor = generatorOverlays.obstacles.filter(
                            (o) => o.type === 'tunnel' && o.color === resolvedColor
                        )
                        if (existingTunnelsWithColor.length >= 2) {
                            return
                        }
                    }

                    const newObs = {
                        row,
                        col,
                        type: obstacleType,
                        color: resolvedColor,
                        count: undefined,
                        direction: obstacleType === 'tunnel' ? generatorSettings.tunnelDirection : undefined,
                    }

                    setGeneratorOverlays((prev) => ({
                        ...prev,
                        obstacles: [...prev.obstacles, { ...newObs, id: nextItemId }],
                    }))
                    setNextItemId((prev) => prev + 1)

                    if (onObstacleTypeUsed) {
                        onObstacleTypeUsed({ ...newObs, id: nextItemId })
                    }
                }
            } else if (generatorTool === 'eraser') {
                setGeneratorOverlays((prev) => ({
                    arrows: prev.arrows.filter((a) => a.row !== row || a.col !== col),
                    obstacles: prev.obstacles.filter((o) => o.row !== row || o.col !== col),
                }))
            }
        },
        [
            gridData,
            generatorTool,
            generatorSettings,
            generatorOverlays,
            setGeneratorOverlays,
            setGridData,
            nextItemId,
            setNextItemId,
            selectedArrows,
            setSelectedArrows,
            onObstacleTypeUsed,
            arrowDragState,
            obstacleDragState,
            handleArrowClick,
            restrictDrawToColored,
            snakePalette,
        ]
    )

    // Mouse up handler to finalize arrow/obstacle placement
    const handleMouseUp = useCallback(() => {
        if (generatorTool === 'arrow' && arrowDragState.isDrawing) {
            const path = arrowDragState.path

            if (validatePath(path)) {
                const hasCollision = path.some((cell) => {
                    const existingArrow = generatorOverlays.arrows.find(
                        (a) =>
                            (a.row === cell.row && a.col === cell.col) ||
                            a.path?.some((p) => p.row === cell.row && p.col === cell.col)
                    )
                    const existingObstacle = generatorOverlays.obstacles.find(
                        (o) => o.row === cell.row && o.col === cell.col
                    )
                    return existingArrow || existingObstacle
                })

                if (!hasCollision) {
                    let resolvedColor = generatorSettings.arrowColor
                    if (resolvedColor === 'random') {
                        const randomIndex = Math.floor(Math.random() * snakePalette.length)
                        resolvedColor = snakePalette[randomIndex] || '#ffffff'
                    } else if (!resolvedColor || resolvedColor === '') {
                        resolvedColor = snakePalette[0] || '#ffffff'
                    }

                    const endCell = path[path.length - 1]
                    let direction = 'up'
                    if (path.length >= 2) {
                        const prevCell = path[path.length - 2]
                        if (prevCell.row > endCell.row) direction = 'up'
                        else if (prevCell.row < endCell.row) direction = 'down'
                        else if (prevCell.col < endCell.col) direction = 'right'
                        else if (prevCell.col > endCell.col) direction = 'left'
                    }

                    setGeneratorOverlays((prev) => ({
                        ...prev,
                        arrows: [
                            ...prev.arrows,
                            {
                                row: endCell.row,
                                col: endCell.col,
                                direction,
                                color: resolvedColor,
                                path: [...path],
                                id: nextItemId,
                            },
                        ],
                    }))

                    setNextItemId((prev) => prev + 1)
                }
            }
        }

        const currentObstacleDrag = obstacleDragStateRef.current
        if (generatorTool === 'obstacle' && currentObstacleDrag.isDrawing) {
            const cells = currentObstacleDrag.cells

            if (cells.length > 0) {
                const firstCell = cells[0]

                const newObs = {
                    row: firstCell.row,
                    col: firstCell.col,
                    type: currentObstacleDrag.type,
                    color: undefined,
                    count:
                        currentObstacleDrag.type === 'wall_break'
                            ? generatorSettings.obstacleCount
                            : undefined,
                    cells: [...cells],
                }

                setGeneratorOverlays((prev) => ({
                    ...prev,
                    obstacles: [...prev.obstacles, { ...newObs, id: nextItemId }],
                }))
                setNextItemId((prev) => prev + 1)

                if (onObstacleTypeUsed) {
                    onObstacleTypeUsed({
                        ...newObs,
                        id: nextItemId,
                        cells: cells,
                    })
                }
            }
        }

        setArrowDragState({ isDrawing: false, path: [] })
        setObstacleDragState({ isDrawing: false, cells: [], type: '' })
    }, [
        generatorTool,
        arrowDragState,
        generatorSettings,
        generatorOverlays,
        setGeneratorOverlays,
        nextItemId,
        setNextItemId,
        onObstacleTypeUsed,
        validatePath,
        snakePalette,
    ])

    // Cancel drawing with right-click
    const handleCancelDraw = useCallback((e: MouseEvent) => {
        if (e.button === 2) {
            e.preventDefault()
            setArrowDragState({ isDrawing: false, path: [] })
            setObstacleDragState({ isDrawing: false, cells: [], type: '' })
        }
    }, [])

    // Global mouse up listener
    useEffect(() => {
        if (arrowDragState.isDrawing || obstacleDragState.isDrawing) {
            window.addEventListener('mouseup', handleMouseUp)
            window.addEventListener('mousedown', handleCancelDraw)
            const preventContext = (e: Event) => e.preventDefault()
            window.addEventListener('contextmenu', preventContext)
            return () => {
                window.removeEventListener('mouseup', handleMouseUp)
                window.removeEventListener('mousedown', handleCancelDraw)
                window.removeEventListener('contextmenu', preventContext)
            }
        }
    }, [arrowDragState.isDrawing, obstacleDragState.isDrawing, handleMouseUp, handleCancelDraw])

    // Preview state for GridCanvas
    const previewPath = useMemo(
        () => (arrowDragState.isDrawing ? arrowDragState.path : undefined),
        [arrowDragState]
    )

    const previewObstacle = useMemo(
        () =>
            obstacleDragState.isDrawing
                ? { cells: obstacleDragState.cells, type: obstacleDragState.type }
                : undefined,
        [obstacleDragState]
    )

    return {
        // State for GridCanvas props
        previewPath,
        previewObstacle,
        marqueeSelection,
        editingArrowId,
        editingEnd,
        editingPath,
        justFinishedMarquee,
        contextMenu,

        // Handlers for GridCanvas
        handleCellInteraction,
        handleRightMouseDown,
        handleRightMouseMove,
        handleRightMouseUp,
        handleNodeHandleClick,
        handlePathEditMove,
        handlePathEditCommit,

        // Context menu handlers
        setContextMenu,
        handleRecolorSelected,
        handleFlipSelected,

        // Flags
        isDrawing: arrowDragState.isDrawing || obstacleDragState.isDrawing,
    }
}
