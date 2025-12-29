import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNotification } from '../stores'

interface GridCanvasProps {
    gridData: boolean[][]
    onCellToggle: (row: number, col: number, mode?: 'draw' | 'erase', e?: React.MouseEvent) => void
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
    onItemContextMenu?: (e: React.MouseEvent, item: { type: 'arrow' | 'obstacle' | 'bulk', data: any, index: number }) => void
    onValidate?: () => Promise<{ is_solvable: boolean, stuck_count?: number }>
    selectedArrows?: Set<number>
    marqueeSelection?: { start: { row: number, col: number }, end: { row: number, col: number }, arrowCells?: { row: number, col: number }[] } | null
    onRightMouseDown?: (row: number, col: number, e: React.MouseEvent) => void
    onRightMouseMove?: (row: number, col: number, e: React.MouseEvent) => void
    onRightMouseUp?: (row: number, col: number, e: React.MouseEvent) => void
    justFinishedMarquee?: boolean
    editingArrowId?: number | null
    editingEnd?: 'head' | 'tail' | null
    editingPath?: { row: number, col: number }[] | null
    onNodeHandleClick?: (arrowId: number, end: 'head' | 'tail', row: number, col: number, e: React.MouseEvent) => void
    onPathEditMove?: (row: number, col: number) => void
    onPathEditCommit?: () => void
    // View State
    zoom: number
    setZoom: (zoom: number) => void
    pan: { x: number, y: number }
    setPan: (pan: { x: number, y: number }) => void
    isZoomInitialized: boolean
    setIsZoomInitialized: (initialized: boolean) => void
    checkerboardView?: boolean
    overlayMode?: 'editor' | 'generator'
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
    onValidate,
    selectedArrows = new Set(),
    marqueeSelection = null,
    onRightMouseDown,
    onRightMouseMove,
    onRightMouseUp,
    justFinishedMarquee = false,
    editingArrowId = null,
    editingEnd = null,
    editingPath = null,
    onNodeHandleClick,
    onPathEditMove,
    onPathEditCommit,
    zoom,
    setZoom,
    pan,
    setPan,
    isZoomInitialized,
    setIsZoomInitialized,
    checkerboardView = false,
    overlayMode = 'editor'
}: GridCanvasProps) {
    const { addNotification } = useNotification()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    // Local state removed in favor of props
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
    const prevGridDataRef = useRef(gridData)

    // Animation state for overlay fade
    const overlayOpacityRef = useRef(overlayMode === 'generator' ? 1 : 0)
    const [animFrame, setAnimFrame] = useState(0)

    // Animate overlay opacity when mode changes
    useEffect(() => {
        const target = overlayMode === 'generator' ? 1 : 0
        // If close enough, snap to target
        if (Math.abs(overlayOpacityRef.current - target) < 0.01) {
            overlayOpacityRef.current = target
            setAnimFrame(f => f + 1)
            return
        }

        let animationFrameId: number
        const animate = () => {
            const current = overlayOpacityRef.current
            const diff = target - current

            if (Math.abs(diff) < 0.01) {
                overlayOpacityRef.current = target
                setAnimFrame(f => f + 1)
                return
            }

            // Lerp opacity - fast fade (0.3)
            overlayOpacityRef.current += diff * 0.3
            setAnimFrame(f => f + 1)
            animationFrameId = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animationFrameId)
    }, [overlayMode])

    // Reset validation state on overlay or grid content change
    useEffect(() => {
        // Skip if nothing actually changed (same references)
        if (prevOverlaysRef.current === overlays && prevGridDataRef.current === gridData) return

        prevOverlaysRef.current = overlays
        prevGridDataRef.current = gridData

        // Only reset if we are in Generator mode (which has overlays or could have)
        if (overlayMode === 'generator') {
            setValidationStatus('idle')
        }
    }, [overlays, gridData, overlayMode])

    // Resize canvas to fill container
    // Resize canvas to fill container
    // Use ResizeObserver to handle container size changes (better than window resize)
    useLayoutEffect(() => {
        if (!containerRef.current) return

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect
                setCanvasSize({ width, height })
            }
        })

        resizeObserver.observe(containerRef.current)

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    // Center grid on load - only once, unless already initialized
    useEffect(() => {
        // Skip if already centered or canvas not measured yet
        if (isZoomInitialized || canvasSize.width === 0) return

        const gridWidth = cols * CELL_SIZE
        const gridHeight = rows * CELL_SIZE
        setPan({
            x: (canvasSize.width - gridWidth) / 2,
            y: (canvasSize.height - gridHeight) / 2
        })
        setIsZoomInitialized(true)
    }, [canvasSize, cols, rows, isZoomInitialized, setPan, setIsZoomInitialized])

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

        // Calculate visible cell range for viewport culling
        const visibleMinX = -pan.x / zoom
        const visibleMinY = -pan.y / zoom
        const visibleMaxX = (canvas.width - pan.x) / zoom
        const visibleMaxY = (canvas.height - pan.y) / zoom

        const visibleMinCol = Math.max(0, Math.floor(visibleMinX / CELL_SIZE) - 1)
        const visibleMaxCol = Math.min(cols - 1, Math.ceil(visibleMaxX / CELL_SIZE) + 1)
        const visibleMinRow = Math.max(0, Math.floor(visibleMinY / CELL_SIZE) - 1)
        const visibleMaxRow = Math.min(rows - 1, Math.ceil(visibleMaxY / CELL_SIZE) + 1)

        // Helper: check if arrow is visible in viewport
        const isArrowVisible = (arrow: typeof overlays extends undefined ? never : NonNullable<typeof overlays>['arrows'][0]) => {
            if (!arrow.path) {
                return arrow.row >= visibleMinRow && arrow.row <= visibleMaxRow &&
                    arrow.col >= visibleMinCol && arrow.col <= visibleMaxCol
            }
            return arrow.path.some(cell =>
                cell.row >= visibleMinRow && cell.row <= visibleMaxRow &&
                cell.col >= visibleMinCol && cell.col <= visibleMaxCol
            )
        }


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
                if (isActive && (overlayMode !== 'generator' || showOverlays)) {
                    ctx.fillStyle = '#8b5cf6' // Purple
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
                }

                if (isPreview) {
                    ctx.fillStyle = 'rgba(139, 92, 246, 0.5)' // Semi-transparent purple
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
                }
            }
        }

        // 2. Draw checkerboard pattern if enabled (draw after colored cells so it shows on top)
        if (checkerboardView) {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    // Checkerboard pattern: alternate based on (row + col) % 2
                    const isAlternate = (r + c) % 2 === 1
                    if (isAlternate) {
                        const x = c * CELL_SIZE
                        const y = r * CELL_SIZE
                        const isActive = gridData[r]?.[c]

                        // For colored cells, use lighter overlay; for empty cells, use darker
                        if (isActive && (overlayMode !== 'generator' || showOverlays)) {
                            // Colored cell: use lighter overlay to maintain color visibility
                            ctx.fillStyle = 'rgba(0, 0, 0, 0.08)' // Very subtle darkening on colored cells
                        } else {
                            // Empty cell: use slightly darker overlay (reduced from 0.15 to 0.1)
                            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)' // Subtle darkening on empty cells
                        }
                        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
                    }
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

        // Draw Overlays with Fade Animation (based on opacity ref)
        const currentOpacity = overlayOpacityRef.current
        if (overlays && currentOpacity > 0) {
            ctx.save()
            ctx.globalAlpha = currentOpacity

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

            // Draw Arrows (with connected paths) - only render visible arrows
            overlays.arrows.filter(isArrowVisible).forEach(arrow => {
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

                // Draw selection highlight for selected arrows
                if (selectedArrows.has(arrow.id)) {
                    // Highlight path cells
                    const allCells = arrow.path ? [...arrow.path] : []
                    // Include head cell if not in path
                    if (!allCells.some(c => c.row === arrow.row && c.col === arrow.col)) {
                        allCells.push({ row: arrow.row, col: arrow.col })
                    }

                    allCells.forEach(cell => {
                        const x = cell.col * CELL_SIZE
                        const y = cell.row * CELL_SIZE
                        // Draw semi-transparent blue fill (same as marquee selection)
                        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)' // Blue tint
                        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
                    })
                }
            })

            // Draw node handles for path editing (only when exactly 1 arrow is selected)
            if (readOnlyGrid && selectedArrows.size === 1 && overlays) {
                const selectedArrow = overlays.arrows.find(a => selectedArrows.has(a.id))
                if (selectedArrow && selectedArrow.path && selectedArrow.path.length > 0) {
                    // Head node (start cell)
                    const headCell = selectedArrow.path[0]
                    // Tail node (end cell)
                    const tailCell = { row: selectedArrow.row, col: selectedArrow.col }

                    // Calculate handle positions
                    let headHandleCell = headCell
                    let tailHandleCell = tailCell

                    // Head handle: cell đầu + 1 theo direction ngược lại từ segment đầu (từ path[1] đến path[0])
                    if (selectedArrow.path.length >= 2) {
                        const firstCell = selectedArrow.path[0]
                        const secondCell = selectedArrow.path[1]
                        const dr = firstCell.row - secondCell.row // Direction ngược lại: từ secondCell đến firstCell
                        const dc = firstCell.col - secondCell.col
                        // Áp dụng direction này từ head
                        if (dr === -1) headHandleCell = { row: headCell.row - 1, col: headCell.col } // Going up
                        else if (dr === 1) headHandleCell = { row: headCell.row + 1, col: headCell.col } // Going down
                        else if (dc === -1) headHandleCell = { row: headCell.row, col: headCell.col - 1 } // Going left
                        else if (dc === 1) headHandleCell = { row: headCell.row, col: headCell.col + 1 } // Going right
                    } else {
                        // Fallback: use arrow direction
                        const dir = selectedArrow.direction
                        if (dir === 'up') headHandleCell = { row: headCell.row - 1, col: headCell.col }
                        else if (dir === 'down') headHandleCell = { row: headCell.row + 1, col: headCell.col }
                        else if (dir === 'left') headHandleCell = { row: headCell.row, col: headCell.col - 1 }
                        else if (dir === 'right') headHandleCell = { row: headCell.row, col: headCell.col + 1 }
                    }

                    // Tail handle: cell cuối + 1 theo direction từ segment cuối (từ path[path.length-2] đến path[path.length-1])
                    if (selectedArrow.path.length >= 2) {
                        const prevToLast = selectedArrow.path[selectedArrow.path.length - 2]
                        const lastPathCell = selectedArrow.path[selectedArrow.path.length - 1]
                        const dr = lastPathCell.row - prevToLast.row // Direction từ prevToLast đến lastPathCell
                        const dc = lastPathCell.col - prevToLast.col
                        // Áp dụng direction này từ tail
                        if (dr === -1) tailHandleCell = { row: tailCell.row - 1, col: tailCell.col } // Going up
                        else if (dr === 1) tailHandleCell = { row: tailCell.row + 1, col: tailCell.col } // Going down
                        else if (dc === -1) tailHandleCell = { row: tailCell.row, col: tailCell.col - 1 } // Going left
                        else if (dc === 1) tailHandleCell = { row: tailCell.row, col: tailCell.col + 1 } // Going right
                    } else {
                        // Fallback: use arrow direction
                        const dir = selectedArrow.direction
                        if (dir === 'up') tailHandleCell = { row: tailCell.row - 1, col: tailCell.col }
                        else if (dir === 'down') tailHandleCell = { row: tailCell.row + 1, col: tailCell.col }
                        else if (dir === 'left') tailHandleCell = { row: tailCell.row, col: tailCell.col - 1 }
                        else if (dir === 'right') tailHandleCell = { row: tailCell.row, col: tailCell.col + 1 }
                    }

                    // Position handles at center of cells
                    const headX = headHandleCell.col * CELL_SIZE + CELL_SIZE / 2
                    const headY = headHandleCell.row * CELL_SIZE + CELL_SIZE / 2
                    const tailX = tailHandleCell.col * CELL_SIZE + CELL_SIZE / 2
                    const tailY = tailHandleCell.row * CELL_SIZE + CELL_SIZE / 2

                    // Draw handles (simple circle with + sign)
                    const handleRadius = 7
                    const isEditingHead = editingArrowId === selectedArrow.id && editingEnd === 'head'
                    const isEditingTail = editingArrowId === selectedArrow.id && editingEnd === 'tail'

                    // Helper function to draw handle with + sign
                    const drawHandle = (x: number, y: number, isActive: boolean) => {
                        // Circle
                        ctx.fillStyle = isActive ? '#3b82f6' : '#6b7280'
                        ctx.strokeStyle = '#ffffff'
                        ctx.lineWidth = 2
                        ctx.beginPath()
                        ctx.arc(x, y, handleRadius, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.stroke()

                        // Draw + sign
                        ctx.strokeStyle = '#ffffff'
                        ctx.lineWidth = 2
                        ctx.lineCap = 'round'
                        // Horizontal line
                        ctx.beginPath()
                        ctx.moveTo(x - 4, y)
                        ctx.lineTo(x + 4, y)
                        ctx.stroke()
                        // Vertical line
                        ctx.beginPath()
                        ctx.moveTo(x, y - 4)
                        ctx.lineTo(x, y + 4)
                        ctx.stroke()
                    }

                    // Head handle
                    drawHandle(headX, headY, isEditingHead)

                    // Tail handle
                    drawHandle(tailX, tailY, isEditingTail)
                }
            }

            // Draw editing path preview
            if (editingPath && editingPath.length > 0) {
                ctx.beginPath()
                ctx.strokeStyle = '#00ff00'
                ctx.lineWidth = 3
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'
                ctx.setLineDash([5, 5])

                const startX = editingPath[0].col * CELL_SIZE + CELL_SIZE / 2
                const startY = editingPath[0].row * CELL_SIZE + CELL_SIZE / 2
                ctx.moveTo(startX, startY)

                for (let i = 1; i < editingPath.length; i++) {
                    const px = editingPath[i].col * CELL_SIZE + CELL_SIZE / 2
                    const py = editingPath[i].row * CELL_SIZE + CELL_SIZE / 2
                    ctx.lineTo(px, py)
                }
                ctx.stroke()
                ctx.setLineDash([]) // Reset
            }

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

            // Draw Preview Obstacle
            if (previewObstacle && previewObstacle.cells && previewObstacle.cells.length > 0) {
                ctx.fillStyle = '#9ca3af' // Gray-400 for walls
                if (previewObstacle.type === 'hole') ctx.fillStyle = '#000000' // Black for holes
                else if (previewObstacle.type === 'tunnel') ctx.fillStyle = '#8b5cf6' // Violet for tunnels

                previewObstacle.cells.forEach(cell => {
                    const x = cell.col * CELL_SIZE
                    const y = cell.row * CELL_SIZE
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)

                    // Add slight border for visibility
                    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
                    ctx.lineWidth = 1
                    ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE)
                })
            }
            ctx.restore()
        }

        // Draw Marquee Selection Box
        if (marqueeSelection && readOnlyGrid) {
            const minRow = Math.min(marqueeSelection.start.row, marqueeSelection.end.row)
            const maxRow = Math.max(marqueeSelection.start.row, marqueeSelection.end.row)
            const minCol = Math.min(marqueeSelection.start.col, marqueeSelection.end.col)
            const maxCol = Math.max(marqueeSelection.start.col, marqueeSelection.end.col)

            // Draw selection box border (preview)
            const x = minCol * CELL_SIZE
            const y = minRow * CELL_SIZE
            const width = (maxCol - minCol + 1) * CELL_SIZE
            const height = (maxRow - minRow + 1) * CELL_SIZE

            ctx.strokeStyle = '#3b82f6' // Blue
            ctx.lineWidth = 2
            ctx.setLineDash([5, 5])
            ctx.strokeRect(x, y, width, height)
            ctx.setLineDash([]) // Reset

            // Draw highlight only on cells that contain arrows (if arrowCells exists)
            if (marqueeSelection.arrowCells && marqueeSelection.arrowCells.length > 0) {
                marqueeSelection.arrowCells.forEach(cell => {
                    const cellX = cell.col * CELL_SIZE
                    const cellY = cell.row * CELL_SIZE

                    // Draw semi-transparent fill
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)' // Blue tint
                    ctx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE)
                })
            }
        }

        ctx.restore()
        ctx.restore()
    }, [gridData, rows, cols, zoom, pan, currentTool, isDrawing, shapeStart, shapePreview, currentShape, overlays, readOnlyGrid, previewPath, previewObstacle, showOverlays, canvasSize, selectedArrows, marqueeSelection, editingArrowId, editingEnd, editingPath, overlayMode, animFrame])

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
        // Prevent context menu if marquee is active or was just finished
        if (marqueeSelection || justFinishedMarquee) {
            e.preventDefault()
            return
        }

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

        // Check if clicked on empty space with multiple arrows selected (bulk operations)
        if (selectedArrows && selectedArrows.size > 1) {
            onItemContextMenu(e, { type: 'bulk', data: { selectedCount: selectedArrows.size }, index: -1 })
            return
        }
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        const coords = getGridCoords(e)

        // Pan (Middle click)
        if (e.button === 1) {
            setIsDragging(true)
            setLastPos({ x: e.clientX, y: e.clientY })
            return
        }

        // Check if clicking on node handle (for path editing)
        if (readOnlyGrid && e.button === 0 && coords && overlays && selectedArrows.size === 1 && onNodeHandleClick) {
            const selectedArrow = overlays.arrows.find(a => selectedArrows.has(a.id))
            if (selectedArrow && selectedArrow.path && selectedArrow.path.length > 0) {
                const headCell = selectedArrow.path[0]
                const tailCell = { row: selectedArrow.row, col: selectedArrow.col }

                // Calculate handle positions: place at center of next cell in path direction
                let headHandleCell = headCell
                let tailHandleCell = tailCell

                // Head handle: cell đầu + 1 theo direction ngược lại từ segment đầu (từ path[1] đến path[0])
                if (selectedArrow.path.length >= 2) {
                    const firstCell = selectedArrow.path[0]
                    const secondCell = selectedArrow.path[1]
                    const dr = firstCell.row - secondCell.row // Direction ngược lại: từ secondCell đến firstCell
                    const dc = firstCell.col - secondCell.col
                    // Áp dụng direction này từ head
                    if (dr === -1) headHandleCell = { row: headCell.row - 1, col: headCell.col } // Going up
                    else if (dr === 1) headHandleCell = { row: headCell.row + 1, col: headCell.col } // Going down
                    else if (dc === -1) headHandleCell = { row: headCell.row, col: headCell.col - 1 } // Going left
                    else if (dc === 1) headHandleCell = { row: headCell.row, col: headCell.col + 1 } // Going right
                } else {
                    // Fallback: use arrow direction
                    const dir = selectedArrow.direction
                    if (dir === 'up') headHandleCell = { row: headCell.row - 1, col: headCell.col }
                    else if (dir === 'down') headHandleCell = { row: headCell.row + 1, col: headCell.col }
                    else if (dir === 'left') headHandleCell = { row: headCell.row, col: headCell.col - 1 }
                    else if (dir === 'right') headHandleCell = { row: headCell.row, col: headCell.col + 1 }
                }

                // Tail handle: cell cuối + 1 theo direction từ segment cuối (từ path[path.length-2] đến path[path.length-1])
                if (selectedArrow.path.length >= 2) {
                    const prevToLast = selectedArrow.path[selectedArrow.path.length - 2]
                    const lastPathCell = selectedArrow.path[selectedArrow.path.length - 1]
                    const dr = lastPathCell.row - prevToLast.row // Direction từ prevToLast đến lastPathCell
                    const dc = lastPathCell.col - prevToLast.col
                    // Áp dụng direction này từ tail
                    if (dr === -1) tailHandleCell = { row: tailCell.row - 1, col: tailCell.col } // Going up
                    else if (dr === 1) tailHandleCell = { row: tailCell.row + 1, col: tailCell.col } // Going down
                    else if (dc === -1) tailHandleCell = { row: tailCell.row, col: tailCell.col - 1 } // Going left
                    else if (dc === 1) tailHandleCell = { row: tailCell.row, col: tailCell.col + 1 } // Going right
                } else {
                    // Fallback: use arrow direction
                    const dir = selectedArrow.direction
                    if (dir === 'up') tailHandleCell = { row: tailCell.row - 1, col: tailCell.col }
                    else if (dir === 'down') tailHandleCell = { row: tailCell.row + 1, col: tailCell.col }
                    else if (dir === 'left') tailHandleCell = { row: tailCell.row, col: tailCell.col - 1 }
                    else if (dir === 'right') tailHandleCell = { row: tailCell.row, col: tailCell.col + 1 }
                }

                // Calculate handle positions at center of cells
                const handleRadius = 7
                const headHandleX = headHandleCell.col * CELL_SIZE + CELL_SIZE / 2
                const headHandleY = headHandleCell.row * CELL_SIZE + CELL_SIZE / 2
                const tailHandleX = tailHandleCell.col * CELL_SIZE + CELL_SIZE / 2
                const tailHandleY = tailHandleCell.row * CELL_SIZE + CELL_SIZE / 2

                // Get mouse position in canvas coordinates
                const canvas = canvasRef.current
                if (canvas) {
                    const rect = canvas.getBoundingClientRect()
                    const worldX = (e.clientX - rect.left - pan.x) / zoom
                    const worldY = (e.clientY - rect.top - pan.y) / zoom

                    // Check if clicked on head handle (within handle radius) - prioritize handle clicks
                    const distToHead = Math.sqrt(Math.pow(worldX - headHandleX, 2) + Math.pow(worldY - headHandleY, 2))
                    if (distToHead <= handleRadius + 5) { // +5 for easier clicking
                        e.preventDefault()
                        e.stopPropagation()
                        setIsDrawing(true)
                        onNodeHandleClick(selectedArrow.id, 'head', headCell.row, headCell.col, e)
                        return
                    }

                    // Check if clicked on tail handle (within handle radius) - prioritize handle clicks
                    const distToTail = Math.sqrt(Math.pow(worldX - tailHandleX, 2) + Math.pow(worldY - tailHandleY, 2))
                    if (distToTail <= handleRadius + 5) { // +5 for easier clicking
                        e.preventDefault()
                        e.stopPropagation()
                        setIsDrawing(true)
                        onNodeHandleClick(selectedArrow.id, 'tail', tailCell.row, tailCell.col, e)
                        return
                    }
                }
            }
        }

        if (!coords || coords.row < 0 || coords.row >= rows || coords.col < 0 || coords.col >= cols) return

        // Check if clicking on arrow in readOnlyGrid mode (for selection)
        // Only check if we didn't already handle a handle click (handles are checked above)
        if (readOnlyGrid && e.button === 0 && overlays) {
            const clickedArrow = overlays.arrows.find(a => {
                // Check head cell
                if (a.row === coords.row && a.col === coords.col) return true
                // Check path cells
                if (a.path?.some(p => p.row === coords.row && p.col === coords.col)) return true
                return false
            })

            // If clicking on arrow, allow selection (don't pan)
            if (clickedArrow) {
                setIsDrawing(true)
                onCellToggle(coords.row, coords.col, 'draw', e)
                return
            }
        }

        // Pan (Shift+Left) - only when not clicking on arrow
        if (e.button === 0 && e.shiftKey) {
            setIsDragging(true)
            setLastPos({ x: e.clientX, y: e.clientY })
            return
        }

        if (e.button === 2) {
            // Right click
            if (readOnlyGrid) {
                // In Generator mode, handle marquee selection
                if (onRightMouseDown && coords) {
                    setIsDrawing(true) // Enable drag tracking for right-click drag
                    onRightMouseDown(coords.row, coords.col, e)
                }
                return
            }
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
                // Pen or Eraser, or Selection mode (readOnlyGrid)
                setIsDrawing(true)
                onCellToggle(coords.row, coords.col, 'draw', e)
            }
        }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            const dx = e.clientX - lastPos.x
            const dy = e.clientY - lastPos.y
            setPan({ x: pan.x + dx, y: pan.y + dy })
            setLastPos({ x: e.clientX, y: e.clientY })
        } else if (isDrawing) {
            const coords = getGridCoords(e)
            if (!coords) return

            // Handle path editing drag
            if (readOnlyGrid && editingArrowId && onPathEditMove) {
                onPathEditMove(coords.row, coords.col)
                return
            }

            // Handle Right Click Drag
            if (e.buttons === 2) {
                if (readOnlyGrid && onRightMouseMove && coords) {
                    // Marquee selection in Generator mode
                    onRightMouseMove(coords.row, coords.col, e)
                } else if (!readOnlyGrid && coords.row >= 0 && coords.row < rows && coords.col >= 0 && coords.col < cols) {
                    // Erase in Grid Editor mode
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
                    onCellToggle(coords.row, coords.col, 'draw', e)
                }
            }
        }
    }

    const handleMouseUp = (e?: React.MouseEvent) => {
        // Handle path editing commit
        if (readOnlyGrid && editingArrowId && onPathEditCommit) {
            onPathEditCommit()
            setIsDrawing(false) // End drag tracking
        }

        // Handle right-click up for marquee
        if (readOnlyGrid && e && e.button === 2 && onRightMouseUp) {
            const coords = getGridCoords(e)
            if (coords) {
                onRightMouseUp(coords.row, coords.col, e)
            }
            setIsDrawing(false) // End drag tracking
            return
        }

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
                    className="w-24 accent-purple-500"
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
                            onClick={() => setZoom(Math.min(5, zoom + 0.1))}
                            className="h-2 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-sm transition-colors"
                        >
                            <ChevronUp size={10} />
                        </button>
                        <button
                            onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
                            className="h-2 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-sm transition-colors"
                        >
                            <ChevronDown size={10} />
                        </button>
                    </div>
                </div>


                <div className="flex-1" />

                <div className="flex items-center gap-3">
                    <AnimatePresence>
                        {overlayMode === 'generator' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center gap-3 overflow-hidden whitespace-nowrap"
                            >
                                {/* Show/Hide Overlays Toggle */}
                                <div className="flex items-center gap-2 px-2 h-6 bg-gray-700 hover:bg-gray-600 rounded transition-colors">
                                    <span className="text-[10px] text-gray-300 font-medium select-none">Visuals</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showOverlays}
                                            onChange={() => setShowOverlays(prev => !prev)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-7 h-4 bg-gray-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1.5px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500"></div>
                                    </label>
                                </div>

                                {/* Validate Button */}
                                <button
                                    onClick={async () => {
                                        if (!onValidate) return
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
                                    className="px-2 h-6 bg-gray-700 hover:bg-gray-600 rounded text-[10px] text-gray-300 transition-colors flex items-center gap-2"
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
                            </motion.div>
                        )}
                    </AnimatePresence>

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
                        className="px-2 h-6 bg-gray-700 hover:bg-gray-600 rounded text-[10px] text-gray-300 transition-colors flex items-center justify-center">
                        Reset
                    </button>
                </div>
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
                        onMouseUp={(e) => handleMouseUp(e)}
                        onMouseLeave={() => handleMouseUp()}
                        onWheel={handleWheel}
                        onContextMenu={handleContextMenu}
                    />
                )}
            </div>
        </div >
    )
}

