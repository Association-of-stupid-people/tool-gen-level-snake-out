import { useEffect, useRef, useState } from 'react'

interface GridCanvasProps {
    gridData: boolean[][]
    onCellToggle: (row: number, col: number, mode?: 'draw' | 'erase') => void
    onBulkCellToggle: (updates: { row: number, col: number }[], mode?: 'draw' | 'erase') => void
    rows: number
    cols: number
    currentTool: 'pen' | 'eraser' | 'shape'
    currentShape: 'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'frame'
}

const CELL_SIZE = 25

export function GridCanvas({ gridData, onCellToggle, onBulkCellToggle, rows, cols, currentTool, currentShape }: GridCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [isDrawing, setIsDrawing] = useState(false)
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

    // Shape drawing state
    const [shapeStart, setShapeStart] = useState<{ row: number; col: number } | null>(null)
    const [shapePreview, setShapePreview] = useState<{ row: number; col: number } | null>(null)

    // Resize canvas to fill container
    useEffect(() => {
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

    // Center grid on load
    useEffect(() => {
        const gridWidth = cols * CELL_SIZE
        const gridHeight = rows * CELL_SIZE
        setPan({
            x: (canvasSize.width - gridWidth) / 2,
            y: (canvasSize.height - gridHeight) / 2
        })
    }, [rows, cols, canvasSize])

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

                // Fill logic
                if (isActive) {
                    ctx.fillStyle = '#8b5cf6' // Purple
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
                }

                if (isPreview) {
                    ctx.fillStyle = 'rgba(139, 92, 246, 0.5)' // Semi-transparent purple
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
                }

                // Draw grid lines
                ctx.strokeStyle = '#374151'
                ctx.lineWidth = 0.5
                ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE)
            }
        }

        ctx.restore()
    }, [gridData, rows, cols, zoom, pan, canvasSize, shapeStart, shapePreview, isDrawing, currentTool, currentShape])

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
            // Right click = FORCE ERASE
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
            <div className="flex items-center gap-4 p-3 bg-gray-800 border-b border-gray-700">
                <button onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
                    className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600">+</button>
                <span className="text-sm text-gray-400">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
                    className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600">-</button>
                <button onClick={() => {
                    setZoom(1)
                    const gridWidth = cols * CELL_SIZE
                    const gridHeight = rows * CELL_SIZE
                    setPan({
                        x: (canvasSize.width - gridWidth) / 2,
                        y: (canvasSize.height - gridHeight) / 2
                    })
                }}
                    className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs">Reset</button>
            </div>
            <div ref={containerRef} className="flex-1 overflow-hidden">
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
                    onContextMenu={(e) => e.preventDefault()}
                />
            </div>
        </div>
    )
}
