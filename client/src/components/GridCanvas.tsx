import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { useNotification } from '../contexts/NotificationContext'

interface GridCanvasProps {
    gridData: boolean[][]
    onCellToggle: (row: number, col: number, mode?: 'draw' | 'erase') => void
    onBulkCellToggle: (updates: { row: number, col: number }[], mode?: 'draw' | 'erase') => void
    rows: number
    cols: number
    currentTool: 'pen' | 'eraser' | 'shape'
    currentShape: 'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'frame'
    readOnlyGrid?: boolean
    overlays?: {
        arrows: { id: number, row: number, col: number, direction: string, color: string, path?: { row: number, col: number }[], type?: string, keyId?: number, lockId?: number }[],
        obstacles: { id: number, row: number, col: number, type: string, color?: string, count?: number, cells?: { row: number, col: number }[], direction?: string, snakeId?: number, keySnakeId?: number, lockedSnakeId?: number, countdown?: number }[]
    }
    previewPath?: { row: number, col: number }[]
    previewObstacle?: { cells: { row: number, col: number }[], type: string, color?: string }
    onItemContextMenu?: (e: React.MouseEvent, item: { type: 'arrow' | 'obstacle', data: any, index: number }) => void
    onValidate?: () => Promise<{ is_solvable: boolean, stuck_count?: number }>
}

const CELL_SIZE = 25

export function GridCanvas({
    gridData,
    onCellToggle,
    onBulkCellToggle,
    rows,
    cols,
    currentTool,
    currentShape,
    readOnlyGrid = false,
    overlays,
    previewPath,
    previewObstacle,
    onItemContextMenu,
    onValidate
}: GridCanvasProps) {
    const { addNotification } = useNotification()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [isDrawing, setIsDrawing] = useState(false)
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
    const hasCenteredRef = useRef(false)

    // Shape drawing state
    const [shapeStart, setShapeStart] = useState<{ row: number; col: number } | null>(null)
    const [shapePreview, setShapePreview] = useState<{ row: number; col: number } | null>(null)

    // Validation State
    const [validationStatus, setValidationStatus] = useState<'idle' | 'loading' | 'success' | 'stuck'>('idle')
    const [showOverlays, setShowOverlays] = useState(true)
    const prevOverlaysRef = useRef(overlays)

    // Reset validation state on overlay content change (not just on mount)
    useEffect(() => {
        // Skip if overlays didn't actually change (same reference or both undefined)
        if (prevOverlaysRef.current === overlays) return
        prevOverlaysRef.current = overlays

        // Only reset if we have overlays (i.e., Generator mode)
        if (overlays) {
            setValidationStatus('idle')
        }
    }, [overlays])

    // Resize canvas to fill container
    // Resize canvas to fill container
    useLayoutEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                setCanvasSize({ width: rect.width, height: rect.height })
            }
        }

        updateSize()
        window.addEventListener('resize', updateSize)
        return () => window.removeEventListener('resize', updateSize)
    }, [])

    // Center grid on load - only once per mount, not on container resize
    useEffect(() => {
        // Skip if already centered or canvas not measured yet
        if (hasCenteredRef.current || canvasSize.width === 0) return

        const gridWidth = cols * CELL_SIZE
        const gridHeight = rows * CELL_SIZE
        setPan({
            x: (canvasSize.width - gridWidth) / 2,
            y: (canvasSize.height - gridHeight) / 2
        })
        hasCenteredRef.current = true
    }, [canvasSize, cols, rows])

    // Reset centering flag when grid dimensions change
    useEffect(() => {
        hasCenteredRef.current = false
    }, [rows, cols])

    // Helper: Check if cell is in shape preview
    const isInShapePreview = (r: number, c: number, start: { row: number, col: number }, end: { row: number, col: number }, shape: string) => {
        const minRow = Math.min(start.row, end.row)
        const maxRow = Math.max(start.row, end.row)
        const minCol = Math.min(start.col, end.col)
        const maxCol = Math.max(start.col, end.col)

        if (shape === 'rectangle') {
            return r >= minRow && r <= maxRow && c >= minCol && c <= maxCol
        } else if (shape === 'frame') {
            // Hollow rectangle (border only)
            return (r >= minRow && r <= maxRow && c >= minCol && c <= maxCol) &&
                (r === minRow || r === maxRow || c === minCol || c === maxCol)
        } else if (shape === 'circle') {
            // Simple circle approximation
            const centerR = (start.row + end.row) / 2
            const centerC = (start.col + end.col) / 2
            const radiusR = Math.abs(end.row - start.row) / 2
            const radiusC = Math.abs(end.col - start.col) / 2
            // Using ellipse equation
            if (radiusR === 0 || radiusC === 0) return r === Math.round(centerR) && c === Math.round(centerC)
            const normalized = ((r - centerR) / (radiusR || 1)) ** 2 + ((c - centerC) / (radiusC || 1)) ** 2
            return normalized <= 1.2 // slightly lenient
        } else if (shape === 'diamond') {
            // Rhombus / Diamond
            const centerR = (start.row + end.row) / 2
            const centerC = (start.col + end.col) / 2
            const radiusR = Math.max(1, Math.abs(end.row - start.row) / 2)
            const radiusC = Math.max(1, Math.abs(end.col - start.col) / 2)
            // Manhattan distance equation: |x/a| + |y/b| <= 1
            const normalized = Math.abs((r - centerR) / radiusR) + Math.abs((c - centerC) / radiusC)
            return normalized <= 1.1 // Slightly lenient to fill gaps
        } else if (shape === 'triangle') {
            // Bounds check first
            if (r < minRow || r > maxRow || c < minCol || c > maxCol) return false

            // Triangle
            const width = maxCol - minCol
            const height = maxRow - minRow
            if (height === 0 || width === 0) return r === minRow && c === minCol

            const peakC = minCol + width / 2
            // Normalized coordinates 0..1 (Y from top to bottom)
            const relY = (r - minRow) / height
            // |c - peakC| <= (relY * width / 2)
            const triangleWidthAtThisRow = relY * width
            return Math.abs(c - peakC) <= (triangleWidthAtThisRow / 2) + 0.5

        } else if (shape === 'line') {
            // Bresenham's line algo
            let x0 = start.col, y0 = start.row
            let x1 = end.col, y1 = end.row
            const dx = Math.abs(x1 - x0)
            const dy = Math.abs(y1 - y0)
            const sx = x0 < x1 ? 1 : -1
            const sy = y0 < y1 ? 1 : -1
            let err = dx - dy

            while (true) {
                if (r === y0 && c === x0) return true
                if (x0 === x1 && y0 === y1) break
                const e2 = 2 * err
                if (e2 > -dy) { err -= dy; x0 += sx }
                if (e2 < dx) { err += dx; y0 += sy }
            }
        }
        return false
    }

    // Draw grid
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.save()

        // Apply zoom and pan
        ctx.translate(pan.x, pan.y)
        ctx.scale(zoom, zoom)

        // Draw grid cells
        // 1. Fill active cells and previews (Batch operations where possible)
        // Optimization: Only loop to fill, don't stroke every cell
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = c * CELL_SIZE
                const y = r * CELL_SIZE

                let isActive = gridData[r]?.[c]
                let isPreview = false

                // Check preview overlays
                if (isDrawing && currentTool === 'shape' && shapeStart && shapePreview) {
                    if (isInShapePreview(r, c, shapeStart, shapePreview, currentShape)) {
                        isPreview = true
                    }
                }

                // Hide grid data if overlays exist (Generator Mode) and visuals are toggled off
                if (isActive && (!overlays || showOverlays)) {
                    ctx.fillStyle = '#8b5cf6' // Purple
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
                }

                if (isPreview) {
                    ctx.fillStyle = 'rgba(139, 92, 246, 0.5)' // Semi-transparent purple
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
                }
            }
        }

        // 2. Draw Grid Lines Efficiently (O(Rows + Cols) instead of O(Rows * Cols))
        ctx.strokeStyle = '#374151'
        ctx.lineWidth = 0.5
        ctx.beginPath()

        const gridWidth = cols * CELL_SIZE
        const gridHeight = rows * CELL_SIZE

        // Vertical Lines
        for (let c = 0; c <= cols; c++) {
            const x = c * CELL_SIZE
            ctx.moveTo(x, 0)
            ctx.lineTo(x, gridHeight)
        }

        // Horizontal Lines
        for (let r = 0; r <= rows; r++) {
            const y = r * CELL_SIZE
            ctx.moveTo(0, y)
            ctx.lineTo(gridWidth, y)
        }

        ctx.stroke()

        // Draw Overlays (Generator Mode) - Always show overlays regardless of toggle
        if (overlays) {
            // Draw Obstacles
            const drawObstacleItem = (obs: any, isPreview: boolean = false) => {
                const cells = obs.cells || [{ row: obs.row, col: obs.col }]

                cells.forEach((cell: any) => {
                    const x = cell.col * CELL_SIZE
                    const y = cell.row * CELL_SIZE
                    const cx = x + CELL_SIZE / 2
                    const cy = y + CELL_SIZE / 2

                    if (isPreview) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
                        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
                    } else {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)' // Dim the cell
                        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
                    }

                    // Icon based on type
                    if (obs.type === 'wall' || obs.type === 'wall_break') {
                        const pad = 2

                        // Check which neighbors are part of this wall (for connected look)
                        const hasTop = cells.some((c: any) => c.row === cell.row - 1 && c.col === cell.col)
                        const hasBottom = cells.some((c: any) => c.row === cell.row + 1 && c.col === cell.col)
                        const hasLeft = cells.some((c: any) => c.row === cell.row && c.col === cell.col - 1)
                        const hasRight = cells.some((c: any) => c.row === cell.row && c.col === cell.col + 1)

                        // Calculate draw rect with padding only on outer edges
                        const drawX = hasLeft ? x : x + pad
                        const drawY = hasTop ? y : y + pad
                        const drawW = CELL_SIZE - (hasLeft ? 0 : pad) - (hasRight ? 0 : pad)
                        const drawH = CELL_SIZE - (hasTop ? 0 : pad) - (hasBottom ? 0 : pad)

                        // Fill color based on type
                        if (obs.type === 'wall') {
                            ctx.fillStyle = isPreview ? 'rgba(156, 163, 175, 0.6)' : '#9ca3af'
                        } else {
                            ctx.fillStyle = isPreview ? 'rgba(209, 213, 219, 0.6)' : '#d1d5db'
                        }
                        ctx.fillRect(drawX, drawY, drawW, drawH)

                        // Draw border only on outer edges
                        ctx.lineWidth = 1
                        ctx.strokeStyle = isPreview ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
                        ctx.beginPath()
                        if (!hasTop) {
                            ctx.moveTo(drawX, drawY)
                            ctx.lineTo(drawX + drawW, drawY)
                        }
                        if (!hasRight) {
                            ctx.moveTo(drawX + drawW, drawY)
                            ctx.lineTo(drawX + drawW, drawY + drawH)
                        }
                        if (!hasBottom) {
                            ctx.moveTo(drawX + drawW, drawY + drawH)
                            ctx.lineTo(drawX, drawY + drawH)
                        }
                        if (!hasLeft) {
                            ctx.moveTo(drawX, drawY + drawH)
                            ctx.lineTo(drawX, drawY)
                        }
                        ctx.stroke()

                        // Wall break specific visuals - show X and count on EVERY cell
                        if (obs.type === 'wall_break' && !isPreview) {
                            // Add crack visual on every cell
                            ctx.beginPath()
                            ctx.strokeStyle = '#4b5563'
                            ctx.lineWidth = 2
                            ctx.moveTo(x + 4, y + 4)
                            ctx.lineTo(x + CELL_SIZE - 4, y + CELL_SIZE - 4)
                            ctx.stroke()
                            ctx.beginPath()
                            ctx.moveTo(x + CELL_SIZE - 4, y + 4)
                            ctx.lineTo(x + 4, y + CELL_SIZE - 4)
                            ctx.stroke()

                            // Draw count on every cell
                            if (obs.count) {
                                ctx.fillStyle = '#000000'
                                ctx.font = 'bold 12px monospace'
                                ctx.textAlign = 'center'
                                ctx.textBaseline = 'middle'
                                ctx.strokeStyle = '#d1d5db'
                                ctx.lineWidth = 3
                                const textY = cy + 2 // Offset down slightly for better centering
                                ctx.strokeText(obs.count.toString(), cx, textY)
                                ctx.fillText(obs.count.toString(), cx, textY)
                            }
                        }
                    } else if (obs.type === 'tunnel') {
                        // Tunnel: Square with rounded corners + directional arrow
                        const size = CELL_SIZE * 0.7
                        const offset = (CELL_SIZE - size) / 2
                        const radius = 4

                        // Filled square
                        ctx.fillStyle = obs.color || '#10b981'
                        if (isPreview) ctx.fillStyle = 'rgba(16, 185, 129, 0.5)'
                        ctx.beginPath()
                        ctx.roundRect(x + offset, y + offset, size, size, radius)
                        ctx.fill()

                        // White border
                        ctx.strokeStyle = 'rgba(255,255,255,0.4)'
                        ctx.lineWidth = 2
                        ctx.stroke()

                        // Draw directional arrow
                        const dir = obs.direction || 'right'
                        ctx.strokeStyle = '#ffffff'
                        ctx.lineWidth = 2
                        ctx.lineCap = 'round'
                        ctx.lineJoin = 'round'

                        const arrowLen = 6
                        const headLen = 4

                        ctx.beginPath()
                        if (dir === 'right') {
                            ctx.moveTo(cx - arrowLen, cy)
                            ctx.lineTo(cx + arrowLen, cy)
                            ctx.moveTo(cx + arrowLen - headLen, cy - headLen)
                            ctx.lineTo(cx + arrowLen, cy)
                            ctx.lineTo(cx + arrowLen - headLen, cy + headLen)
                        } else if (dir === 'left') {
                            ctx.moveTo(cx + arrowLen, cy)
                            ctx.lineTo(cx - arrowLen, cy)
                            ctx.moveTo(cx - arrowLen + headLen, cy - headLen)
                            ctx.lineTo(cx - arrowLen, cy)
                            ctx.lineTo(cx - arrowLen + headLen, cy + headLen)
                        } else if (dir === 'up') {
                            ctx.moveTo(cx, cy + arrowLen)
                            ctx.lineTo(cx, cy - arrowLen)
                            ctx.moveTo(cx - headLen, cy - arrowLen + headLen)
                            ctx.lineTo(cx, cy - arrowLen)
                            ctx.lineTo(cx + headLen, cy - arrowLen + headLen)
                        } else if (dir === 'down') {
                            ctx.moveTo(cx, cy - arrowLen)
                            ctx.lineTo(cx, cy + arrowLen)
                            ctx.moveTo(cx - headLen, cy + arrowLen - headLen)
                            ctx.lineTo(cx, cy + arrowLen)
                            ctx.lineTo(cx + headLen, cy + arrowLen - headLen)
                        }
                        ctx.stroke()
                    } else if (obs.type === 'hole') {
                        // Hole: Circle with colored outline (vs Tunnel which is filled circle)
                        const holeRadius = CELL_SIZE / 3

                        // Dark filled center
                        ctx.fillStyle = '#1f2937'
                        ctx.beginPath()
                        ctx.arc(cx, cy, holeRadius, 0, Math.PI * 2)
                        ctx.fill()

                        // Colored outline ring
                        ctx.strokeStyle = obs.color || '#ffffff'
                        if (isPreview) ctx.strokeStyle = 'rgba(255,255,255,0.5)'
                        ctx.lineWidth = 3
                        ctx.stroke()

                        // Inner dark dot
                        ctx.fillStyle = '#000000'
                        ctx.beginPath()
                        ctx.arc(cx, cy, 3, 0, Math.PI * 2)
                        ctx.fill()
                    } else {
                        ctx.fillStyle = '#ef4444' // Red default
                        ctx.fillRect(x + 6, y + 6, CELL_SIZE - 12, CELL_SIZE - 12)
                    }
                })
            }

            // Draw Existing Obstacles (skip config-only types like iced_snake and key_snake)
            overlays.obstacles
                .filter(obs => obs.type !== 'iced_snake' && obs.type !== 'key_snake')
                .forEach(obs => drawObstacleItem(obs, false))

            // Draw Preview Obstacle
            if (previewObstacle) {
                drawObstacleItem(previewObstacle, true)
            }

            // Draw Arrows (with connected paths)
            overlays.arrows.forEach(arrow => {
                const endX = arrow.col * CELL_SIZE + CELL_SIZE / 2
                const endY = arrow.row * CELL_SIZE + CELL_SIZE / 2

                // Draw path line if path exists
                if (arrow.path && arrow.path.length > 1) {
                    ctx.beginPath()
                    ctx.strokeStyle = arrow.color
                    ctx.lineWidth = 4
                    ctx.lineCap = 'round'
                    ctx.lineJoin = 'round'

                    const startX = arrow.path[0].col * CELL_SIZE + CELL_SIZE / 2
                    const startY = arrow.path[0].row * CELL_SIZE + CELL_SIZE / 2
                    ctx.moveTo(startX, startY)

                    for (let i = 1; i < arrow.path.length; i++) {
                        const px = arrow.path[i].col * CELL_SIZE + CELL_SIZE / 2
                        const py = arrow.path[i].row * CELL_SIZE + CELL_SIZE / 2
                        ctx.lineTo(px, py)
                    }
                    ctx.stroke()
                }

                // Draw arrowhead at end cell
                ctx.fillStyle = arrow.color
                ctx.strokeStyle = '#000000'
                ctx.lineWidth = 1
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'

                ctx.save()
                ctx.translate(endX, endY)

                // Rotate based on direction
                let rotation = 0
                if (arrow.direction === 'right') rotation = Math.PI / 2
                if (arrow.direction === 'down') rotation = Math.PI
                if (arrow.direction === 'left') rotation = -Math.PI / 2
                ctx.rotate(rotation)

                ctx.beginPath()
                // Draw filled arrowhead
                ctx.moveTo(0, -9)  // Top tip
                ctx.lineTo(6, 4)   // Right wing
                ctx.lineTo(2, 4)   // Right stem
                ctx.lineTo(2, 9)   // Right bottom
                ctx.lineTo(-2, 9)  // Left bottom
                ctx.lineTo(-2, 4)  // Left stem
                ctx.lineTo(-6, 4)  // Left wing
                ctx.closePath()

                ctx.fill()

                ctx.restore()

                // Draw Icon for Special Types (Iced/Key/Lock) based on ID config
                // Icons are drawn on the 2nd cell (neck) as per request
                if (arrow.path && arrow.path.length >= 2) {
                    // Find config
                    const icedConfig = overlays.obstacles.find(o => o.type === 'iced_snake' && o.snakeId === arrow.id)
                    const keyConfig = overlays.obstacles.find(o => o.type === 'key_snake' && o.keySnakeId === arrow.id)
                    const lockConfig = overlays.obstacles.find(o => o.type === 'key_snake' && o.lockedSnakeId === arrow.id)

                    if (icedConfig || keyConfig || lockConfig) {
                        const targetCell = arrow.path[arrow.path.length - 2]
                        const tx = targetCell.col * CELL_SIZE + CELL_SIZE / 2
                        const ty = targetCell.row * CELL_SIZE + CELL_SIZE / 2

                        ctx.save()
                        ctx.translate(tx, ty)
                        ctx.font = 'bold 14px serif' // Larger font
                        ctx.textAlign = 'center'
                        ctx.textBaseline = 'middle'
                        // Add shadow for visibility
                        ctx.shadowColor = 'black'
                        ctx.shadowBlur = 4
                        ctx.shadowOffsetX = 1
                        ctx.shadowOffsetY = 1

                        if (icedConfig) {
                            ctx.fillStyle = '#00FFFF'
                            ctx.fillText('I', 0, 0)
                            ctx.restore()

                            // Draw countdown on 3rd cell if path is long enough
                            if (arrow.path.length >= 3 && icedConfig.countdown !== undefined) {
                                const countdownCell = arrow.path[arrow.path.length - 3]
                                const cx = countdownCell.col * CELL_SIZE + CELL_SIZE / 2
                                const cy = countdownCell.row * CELL_SIZE + CELL_SIZE / 2

                                ctx.save()
                                ctx.translate(cx, cy)
                                ctx.font = 'bold 14px monospace'
                                ctx.textAlign = 'center'
                                ctx.textBaseline = 'middle'
                                ctx.shadowColor = 'black'
                                ctx.shadowBlur = 3
                                ctx.fillStyle = '#00FFFF'
                                ctx.fillText(icedConfig.countdown.toString(), 0, 0)
                                ctx.restore()
                            }
                        } else if (keyConfig) {
                            ctx.fillStyle = '#FFD700'
                            ctx.fillText('K', 0, 0)
                            ctx.restore()
                        } else if (lockConfig) {
                            ctx.fillStyle = '#FFD700'
                            ctx.fillText('L', 0, 0)
                            ctx.restore()
                        }
                    }
                }
            })

            // Draw Preview Path
            if (previewPath && previewPath.length > 0) {
                // Highlight cells - More opaque purple
                ctx.fillStyle = 'rgba(168, 85, 247, 0.5)' // Increased opacity (0.3 -> 0.5)
                previewPath.forEach(cell => {
                    const x = cell.col * CELL_SIZE
                    const y = cell.row * CELL_SIZE
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
                })

                // Draw connecting line
                if (previewPath.length > 1) {
                    ctx.beginPath()
                    ctx.strokeStyle = '#000000ff' // Purple-500
                    ctx.lineWidth = 4 // Thicker (2 -> 4)
                    ctx.lineCap = 'round'
                    ctx.lineJoin = 'round'

                    const startX = previewPath[0].col * CELL_SIZE + CELL_SIZE / 2
                    const startY = previewPath[0].row * CELL_SIZE + CELL_SIZE / 2
                    ctx.moveTo(startX, startY)

                    for (let i = 1; i < previewPath.length; i++) {
                        const px = previewPath[i].col * CELL_SIZE + CELL_SIZE / 2
                        const py = previewPath[i].row * CELL_SIZE + CELL_SIZE / 2
                        ctx.lineTo(px, py)
                    }
                    ctx.stroke()

                    // Draw dots at nodes for clarity
                    ctx.fillStyle = '#000000ff'
                    previewPath.forEach(cell => {
                        const px = cell.col * CELL_SIZE + CELL_SIZE / 2
                        const py = cell.row * CELL_SIZE + CELL_SIZE / 2
                        ctx.beginPath()
                        ctx.arc(px, py, 2, 0, Math.PI * 2)
                        ctx.fill()
                    })
                }
            }
        }

        ctx.restore()
    }, [gridData, rows, cols, zoom, pan, currentTool, isDrawing, shapeStart, shapePreview, currentShape, overlays, readOnlyGrid, previewPath, previewObstacle, showOverlays])

    // Get grid coordinates from mouse event
    const getGridCoords = (e: React.MouseEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return null
        const rect = canvas.getBoundingClientRect()
        // Calculate world position
        const worldX = (e.clientX - rect.left - pan.x) / zoom
        const worldY = (e.clientY - rect.top - pan.y) / zoom

        const col = Math.floor(worldX / CELL_SIZE)
        const row = Math.floor(worldY / CELL_SIZE)
        return { row, col }
    }

    // Handle right-click context menu
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        if (!overlays || !onItemContextMenu) return

        const coords = getGridCoords(e)
        if (!coords) return

        const { row, col } = coords

        // Check if clicked on an arrow (including path cells)
        const arrowIndex = overlays.arrows.findIndex(a =>
            (a.row === row && a.col === col) ||
            a.path?.some(p => p.row === row && p.col === col)
        )
        if (arrowIndex !== -1) {
            onItemContextMenu(e, { type: 'arrow', data: overlays.arrows[arrowIndex], index: arrowIndex })
            return
        }

        // Check if clicked on an obstacle (including multi-cell obstacles)
        const obstacleIndex = overlays.obstacles.findIndex(o =>
            (o.row === row && o.col === col) ||
            o.cells?.some(c => c.row === row && c.col === col)
        )
        if (obstacleIndex !== -1) {
            onItemContextMenu(e, { type: 'obstacle', data: overlays.obstacles[obstacleIndex], index: obstacleIndex })
            return
        }
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        const coords = getGridCoords(e)

        // Pan (Middle click or Shift+Left)
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            setIsDragging(true)
            setLastPos({ x: e.clientX, y: e.clientY })
            return
        }

        if (!coords || coords.row < 0 || coords.row >= rows || coords.col < 0 || coords.col >= cols) return

        if (e.button === 2) {
            // Right click - only erase if NOT readOnlyGrid (readOnlyGrid uses context menu)
            if (readOnlyGrid) return // Let context menu handle it
            e.preventDefault()
            setIsDrawing(true)
            // Just toggle directly to false
            onCellToggle(coords.row, coords.col, 'erase')
            return
        }

        if (e.button === 0) {
            if (currentTool === 'shape') {
                setIsDrawing(true)
                setShapeStart(coords)
                setShapePreview(coords)
            } else {
                // Pen or Eraser
                setIsDrawing(true)
                onCellToggle(coords.row, coords.col, 'draw')
            }
        }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            const dx = e.clientX - lastPos.x
            const dy = e.clientY - lastPos.y
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }))
            setLastPos({ x: e.clientX, y: e.clientY })
        } else if (isDrawing) {
            const coords = getGridCoords(e)
            if (!coords) return

            // Handle Right Click Drag (Erase)
            if (e.buttons === 2) {
                if (coords.row >= 0 && coords.row < rows && coords.col >= 0 && coords.col < cols) {
                    onCellToggle(coords.row, coords.col, 'erase')
                }
                return
            }

            // Handle Shape Preview
            if (currentTool === 'shape' && shapeStart) {
                // Constrain to grid bounds
                const r = Math.max(0, Math.min(rows - 1, coords.row))
                const c = Math.max(0, Math.min(cols - 1, coords.col))
                setShapePreview({ row: r, col: c })
                return
            }

            // Handle Standard Drawing (Pen/Eraser)
            if (coords.row >= 0 && coords.row < rows && coords.col >= 0 && coords.col < cols) {
                if (currentTool !== 'shape') {
                    onCellToggle(coords.row, coords.col, 'draw')
                }
            }
        }
    }

    const handleMouseUp = () => {
        // Commit Shape
        if (isDrawing && currentTool === 'shape' && shapeStart && shapePreview) {
            const updates: { row: number, col: number }[] = []

            const minRow = Math.min(shapeStart.row, shapePreview.row)
            const maxRow = Math.max(shapeStart.row, shapePreview.row)
            const minCol = Math.min(shapeStart.col, shapePreview.col)
            const maxCol = Math.max(shapeStart.col, shapePreview.col)

            // Optimize iteration bounds based on shape type if possible, but bounding box is safe
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    if (isInShapePreview(r, c, shapeStart, shapePreview, currentShape)) {
                        updates.push({ row: r, col: c })
                    }
                }
            }

            if (updates.length > 0) {
                onBulkCellToggle(updates, 'draw')
            }
        }

        setIsDragging(false)
        setIsDrawing(false)
        setShapeStart(null)
        setShapePreview(null)
    }

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // Calculate world position before zoom
        const worldX = (mouseX - pan.x) / zoom
        const worldY = (mouseY - pan.y) / zoom

        // Apply zoom
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        const newZoom = Math.max(0.1, Math.min(5, zoom * delta))

        // Calculate new pan to keep mouse position steady
        const newPanX = mouseX - worldX * newZoom
        const newPanY = mouseY - worldY * newZoom

        setZoom(newZoom)
        setPan({ x: newPanX, y: newPanY })
    }

    return (
        <div className="flex flex-col h-full bg-gray-900">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-800 border-b border-gray-700 h-10">
                <span className="text-xs font-medium text-gray-400">Zoom</span>

                {/* Slider */}
                <input
                    type="range"
                    min="10"
                    max="500"
                    value={Math.round(zoom * 100)}
                    onChange={(e) => setZoom(Number(e.target.value) / 100)}
                    className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
                />

                {/* Custom Spinner Input Cluster */}
                <div className="flex items-center bg-gray-900 border border-gray-600 hover:border-gray-500 focus-within:border-purple-500 rounded px-1.5 py-0.5 transition-colors group">
                    <input
                        id="zoom-input"
                        type="number"
                        min="10"
                        max="500"
                        value={Math.round(zoom * 100)}
                        onChange={(e) => {
                            const val = Math.max(10, Math.min(500, Number(e.target.value) || 100))
                            setZoom(val / 100)
                        }}
                        className="w-7 bg-transparent text-xs text-left text-white font-medium focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-xs text-gray-500 select-none mr-1">%</span>

                    {/* Custom Spinners */}
                    <div className="flex flex-col border-l border-gray-700 pl-1 ml-1 h-5 justify-between">
                        <button
                            onClick={() => setZoom(prev => Math.min(5, prev + 0.1))}
                            className="h-2 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-sm transition-colors"
                        >
                            <ChevronUp size={10} />
                        </button>
                        <button
                            onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
                            className="h-2 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-sm transition-colors"
                        >
                            <ChevronDown size={10} />
                        </button>
                    </div>
                </div>


                <div className="flex-1" />

                {/* Show/Hide Overlays Toggle - Only for Generator Mode (when overlays exist) */}
                {overlays && (
                    <div className="flex items-center gap-2 mr-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors">
                        <span className="text-[10px] text-gray-300 font-medium select-none">Visuals</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showOverlays}
                                onChange={() => setShowOverlays(prev => !prev)}
                                className="sr-only peer"
                            />
                            <div className="w-7 h-4 bg-gray-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500"></div>
                        </label>
                    </div>
                )}

                {/* Validate Button - always rendered but invisible when not in Generator mode */}
                <button
                    onClick={async () => {
                        if (!onValidate || !overlays) return
                        if (validationStatus === 'loading') return
                        setValidationStatus('loading')
                        try {
                            const result = await onValidate()
                            if (result.is_solvable) {
                                setValidationStatus('success')
                                addNotification('success', 'Level is solvable!')
                            } else {
                                setValidationStatus('stuck')
                                addNotification('error', `Level is stuck!`)
                            }
                        } catch (e) {
                            setValidationStatus('idle')
                            addNotification('error', 'Validation failed')
                        }
                    }}
                    className={`mr-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-[10px] text-gray-300 transition-colors flex items-center gap-2 ${!(onValidate && overlays) ? 'invisible' : ''}`}
                >
                    Validate
                    {validationStatus === 'loading' ? (
                        <Loader2 size={10} className="animate-spin text-gray-400" />
                    ) : (
                        <div className={`w-2.5 h-2.5 rounded-full border border-gray-500/50 ${validationStatus === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                            validationStatus === 'stuck' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                                'bg-gray-500' // idle
                            }`} />
                    )}
                </button>


                {/* Reset Button */}
                <button onClick={() => {
                    setZoom(1)
                    const gridWidth = cols * CELL_SIZE
                    const gridHeight = rows * CELL_SIZE
                    setPan({
                        x: (canvasSize.width - gridWidth) / 2,
                        y: (canvasSize.height - gridHeight) / 2
                    })
                }}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-[10px] text-gray-300 transition-colors flex items-center justify-center">
                    Reset
                </button>
            </div>
            <div ref={containerRef} className="flex-1 overflow-hidden">
                {canvasSize.width > 0 && (
                    <canvas
                        ref={canvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        className="cursor-crosshair w-full h-full"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                        onContextMenu={handleContextMenu}
                    />
                )}
            </div>
        </div >
    )
}
