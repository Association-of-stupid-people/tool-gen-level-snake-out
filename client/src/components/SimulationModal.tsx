import { useEffect, useRef, useState } from 'react'
import { X, RotateCcw } from 'lucide-react'

// --- Types ---
interface SimulationModalProps {
    isOpen: boolean
    onClose: () => void
    rows: number
    cols: number
    gridData: boolean[][] // Walls/Grid
    snakes: { id: number, row: number, col: number, direction: string, color: string, path?: { row: number, col: number }[] }[]
    obstacles: { id: number, row: number, col: number, type: string, cells?: { row: number, col: number }[], direction?: string, color?: string, count?: number }[]
}

interface Snake {
    id: number
    dots: { row: number, col: number }[]  // tail to head
    direction: 'up' | 'down' | 'left' | 'right'
    color: string
    exited: boolean
}

interface GameState {
    snakes: Snake[]
    moveCount: number
    isComplete: boolean
}

// --- Constants ---
const CELL_SIZE = 20

export function SimulationModal({ isOpen, onClose, rows, cols, gridData, snakes, obstacles }: SimulationModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [gameState, setGameState] = useState<GameState>({ snakes: [], moveCount: 0, isComplete: false })
    const [hoveredSnake, setHoveredSnake] = useState<number | null>(null)
    const hoverTimeoutRef = useRef<number>(0)
    const animatingSnakesRef = useRef<Set<number>>(new Set()) // Track snakes currently animating
    const gameIdRef = useRef(0) // Track game generation to stop old animations

    // Keep gameState ref in sync for animation loops
    const gameStateRef = useRef<GameState>(gameState)
    useEffect(() => {
        gameStateRef.current = gameState
    }, [gameState])

    // Initialize Game State
    useEffect(() => {
        if (isOpen) {
            resetGame()
        }
    }, [isOpen, snakes])

    const resetGame = () => {
        gameIdRef.current++ // Invalidate old animations
        console.log('Input snakes:', snakes)
        animatingSnakesRef.current.clear() // Clear animating state


        const initialSnakes: Snake[] = snakes.map((s, index) => {
            // Path is tail to head
            let dots = s.path ? [...s.path] : [{ row: s.row, col: s.col }]

            const snake = {
                id: s.id !== undefined ? s.id : index, // Auto-generate ID if missing
                dots: dots,
                direction: s.direction as 'up' | 'down' | 'left' | 'right',
                color: s.color,
                exited: false
            }

            console.log('Created snake:', snake)
            return snake
        })

        console.log('Initial snakes:', initialSnakes)

        setGameState({
            snakes: JSON.parse(JSON.stringify(initialSnakes)), // Deep copy
            moveCount: 0,
            isComplete: false
        })
    }

    // Get direction vector
    const getDirectionVector = (dir: 'up' | 'down' | 'left' | 'right'): { row: number, col: number } => {
        switch (dir) {
            case 'up': return { row: -1, col: 0 }
            case 'down': return { row: 1, col: 0 }
            case 'left': return { row: 0, col: -1 }
            case 'right': return { row: 0, col: 1 }
        }
    }

    // Check if cell is occupied by any snake
    const isCellOccupied = (row: number, col: number, excludeSnakeId?: number, snakesArray?: Snake[]): boolean => {
        const snakes = snakesArray || gameState.snakes
        for (const snake of snakes) {
            if (snake.exited) continue
            if (excludeSnakeId !== undefined && snake.id === excludeSnakeId) continue

            // Only check visible dots (in bounds)
            const visibleDots = snake.dots.filter(dot =>
                dot.row >= 0 && dot.row < rows && dot.col >= 0 && dot.col < cols
            )
            if (visibleDots.some(dot => dot.row === row && dot.col === col)) {
                return true
            }
        }
        return false
    }

    // Check if cell is an obstacle (wall)
    const isWall = (row: number, col: number): boolean => {
        // Grid walls check REMOVED as per user request
        // Simulation only cares about explicit obstacles, not grid color/paint.


        // Obstacle walls
        for (const obs of obstacles) {
            if (obs.type === 'wall' || obs.type === 'wall_break') {
                const cells = obs.cells || [{ row: obs.row, col: obs.col }]
                if (cells.some(c => c.row === row && c.col === col)) {
                    console.log(`[BLOCK] Blocked by OBSTACLE ${obs.type} (ID ${obs.id}) at ${row},${col}`)
                    return true
                }
            }
        }
        return false
    }

    // Check if snake can REACH the edge (not just check next cell)
    // Unmovable = any obstacle between current head and grid edge
    const isSnakeMovableCheck = (snake: Snake, snakesArray?: Snake[]): boolean => {
        if (snake.exited) return false
        if (snake.dots.length === 0) return false

        // Get the actual head (last dot that's in bounds, or last dot if all out)
        const visibleDots = snake.dots.filter(dot =>
            dot.row >= 0 && dot.row < rows && dot.col >= 0 && dot.col < cols
        )
        if (visibleDots.length === 0) return false

        const head = visibleDots[visibleDots.length - 1]
        const dir = getDirectionVector(snake.direction)

        // Check ALL cells from head to grid edge
        let checkRow = head.row + dir.row
        let checkCol = head.col + dir.col

        while (checkRow >= 0 && checkRow < rows && checkCol >= 0 && checkCol < cols) {
            // Wall in the way
            if (isWall(checkRow, checkCol)) {
                console.log(`Snake ${snake.id} blocked by wall at ${checkRow},${checkCol}`)
                return false
            }
            // Other snake in the way
            if (isCellOccupied(checkRow, checkCol, snake.id, snakesArray)) {
                console.log(`Snake ${snake.id} blocked by other snake at ${checkRow},${checkCol}`)
                return false
            }
            checkRow += dir.row
            checkCol += dir.col
        }

        // Can reach edge = movable
        return true
    }

    // Wrapper for rendering (uses current state)
    const isSnakeMovable = (snake: Snake): boolean => isSnakeMovableCheck(snake)

    // Canvas click handler
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()

        // Account for CSS scaling (canvas internal size vs displayed size)
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height

        const clickX = (e.clientX - rect.left) * scaleX
        const clickY = (e.clientY - rect.top) * scaleY

        // Calculate grid position
        const mapWidth = cols * CELL_SIZE
        const mapHeight = rows * CELL_SIZE
        const offsetX = (canvas.width - mapWidth) / 2
        const offsetY = (canvas.height - mapHeight) / 2

        const gridX = clickX - offsetX
        const gridY = clickY - offsetY

        console.log('Click:', { clickX, clickY, gridX, gridY, offsetX, offsetY, scaleX, scaleY })

        if (gridX < 0 || gridY < 0 || gridX >= mapWidth || gridY >= mapHeight) {
            console.log('Click outside grid')
            return
        }

        const col = Math.floor(gridX / CELL_SIZE)
        const row = Math.floor(gridY / CELL_SIZE)

        console.log('Grid cell:', { row, col })

        // Find clicked snake - check visible dots only
        let foundSnake = false
        for (const snake of gameState.snakes) {
            if (snake.exited) continue

            const visibleDots = snake.dots.filter(dot =>
                dot.row >= 0 && dot.row < rows && dot.col >= 0 && dot.col < cols
            )

            // Debug click search
            // console.log(`Checking snake ${snake.id} dots:`, visibleDots)

            if (visibleDots.some(dot => dot.row === row && dot.col === col)) {
                console.log('Found snake:', snake.id, 'at', row, col)
                foundSnake = true

                // Check if already animating to avoid double clicks
                if (!animatingSnakesRef.current.has(snake.id)) {
                    // Increment move count on click (valid or blocked)
                    setGameState(prev => ({ ...prev, moveCount: prev.moveCount + 1 }))

                    // Start continuous movement animation
                    animateSnakeExit(snake.id)
                } else {
                    console.log('[CLICK] Snake is already animating, ignoring click for stats')
                }
                return
            }
        }
        if (!foundSnake) {
            console.log('No snake found at position', row, col, '- Checked against', gameState.snakes.length, 'snakes')
        }
    }

    // Animate snake continuously until it exits or is blocked
    // Animate snake continuously until it exits or is blocked
    const animateSnakeExit = (snakeId: number) => {
        const startGeneration = gameIdRef.current

        // Prevent duplicate animations on same snake
        if (animatingSnakesRef.current.has(snakeId)) {
            console.log('[ANIM] Snake already animating, skipping:', snakeId)
            return
        }
        animatingSnakesRef.current.add(snakeId)

        const MOVE_INTERVAL = 50 // ms between moves

        console.log('[ANIM] Starting animation for snake:', snakeId)

        const moveLoop = () => {
            // Stop if game was reset
            if (gameIdRef.current !== startGeneration) return

            // Use Ref to access latest state without being inside setGameState callback
            const currentState = gameStateRef.current
            const snakeIndex = currentState.snakes.findIndex(s => s.id === snakeId)

            if (snakeIndex === -1) {
                console.log('[ANIM] Snake not found, stopping')
                animatingSnakesRef.current.delete(snakeId)
                return
            }

            const snake = currentState.snakes[snakeIndex]

            // Already fully exited - stop animation
            if (snake.exited) {
                console.log('[ANIM] Snake already exited, stopping')
                animatingSnakesRef.current.delete(snakeId)
                return
            }

            // Get visible dots
            const visibleDots = snake.dots.filter(dot =>
                dot.row >= 0 && dot.row < rows && dot.col >= 0 && dot.col < cols
            )

            // Check if movable (only when still has visible dots in grid)
            if (visibleDots.length > 0 && !isSnakeMovableCheck(snake, currentState.snakes)) {
                console.log('[ANIM] Snake blocked, stopping animation')
                animatingSnakesRef.current.delete(snakeId)
                return
            }

            // Move snake one step
            const head = snake.dots[snake.dots.length - 1]
            const dir = getDirectionVector(snake.direction)
            const newHead = { row: head.row + dir.row, col: head.col + dir.col }

            const newDots = [...snake.dots, newHead]
            newDots.shift()

            // Check if TAIL is far enough outside canvas
            const MARGIN_CELLS = 15
            const newTail = newDots[0]
            const tailTooFar = newTail.row < -MARGIN_CELLS || newTail.row >= rows + MARGIN_CELLS ||
                newTail.col < -MARGIN_CELLS || newTail.col >= cols + MARGIN_CELLS

            // Mark as exited when tail is far enough outside
            const shouldExit = tailTooFar

            // Update State
            setGameState(prev => {
                const newSnakes = [...prev.snakes]
                newSnakes[snakeIndex] = {
                    ...snake,
                    dots: newDots,
                    exited: shouldExit
                }
                const allExited = newSnakes.every(s => s.exited)

                return {
                    snakes: newSnakes,
                    moveCount: prev.moveCount,
                    isComplete: allExited
                }
            })




            // Schedule next move if NOT exiting
            if (!shouldExit) {
                setTimeout(moveLoop, MOVE_INTERVAL)
            } else {
                console.log('[ANIM] Animation complete, snake exited')
                animatingSnakesRef.current.delete(snakeId)
            }
        }

        // Start animation
        moveLoop()
    }

    // Canvas hover handler (throttled to prevent flicker)
    const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return

        // Throttle updates
        if (hoverTimeoutRef.current) return
        hoverTimeoutRef.current = window.setTimeout(() => {
            hoverTimeoutRef.current = 0
        }, 50) // 50ms throttle

        const rect = canvas.getBoundingClientRect()

        // Account for CSS scaling
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height

        const mouseX = (e.clientX - rect.left) * scaleX
        const mouseY = (e.clientY - rect.top) * scaleY

        const mapWidth = cols * CELL_SIZE
        const mapHeight = rows * CELL_SIZE
        const offsetX = (canvas.width - mapWidth) / 2
        const offsetY = (canvas.height - mapHeight) / 2

        const gridX = mouseX - offsetX
        const gridY = mouseY - offsetY

        if (gridX < 0 || gridY < 0 || gridX >= mapWidth || gridY >= mapHeight) {
            setHoveredSnake(null)
            return
        }

        const col = Math.floor(gridX / CELL_SIZE)
        const row = Math.floor(gridY / CELL_SIZE)

        // Find hovered snake - check visible dots only
        for (const snake of gameState.snakes) {
            if (snake.exited) continue
            const visibleDots = snake.dots.filter(dot =>
                dot.row >= 0 && dot.row < rows && dot.col >= 0 && dot.col < cols
            )
            if (visibleDots.some(dot => dot.row === row && dot.col === col)) {
                setHoveredSnake(snake.id)
                return
            }
        }
        setHoveredSnake(null)
    }

    // Render Canvas
    useEffect(() => {
        if (!isOpen) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Fill Background
        ctx.fillStyle = '#111827' // Gray-900
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Centering
        const mapWidth = cols * CELL_SIZE
        const mapHeight = rows * CELL_SIZE
        const offsetX = (canvas.width - mapWidth) / 2
        const offsetY = (canvas.height - mapHeight) / 2

        ctx.save()
        ctx.translate(offsetX, offsetY)

        // Draw Grid Walls
        ctx.fillStyle = '#374151' // Gray-700
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (gridData[r][c]) {
                    ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                }
            }
        }

        // Draw Grid Lines (Subtle)
        ctx.strokeStyle = '#1f2937' // Gray-800
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let r = 0; r <= rows; r++) {
            ctx.moveTo(0, r * CELL_SIZE)
            ctx.lineTo(mapWidth, r * CELL_SIZE)
        }
        for (let c = 0; c <= cols; c++) {
            ctx.moveTo(c * CELL_SIZE, 0)
            ctx.lineTo(c * CELL_SIZE, mapHeight)
        }
        ctx.stroke()

        // Draw Obstacles
        obstacles.forEach(obs => {
            const cells = obs.cells || [{ row: obs.row, col: obs.col }]

            if (obs.type === 'wall' || obs.type === 'wall_break') {
                ctx.fillStyle = obs.type === 'wall' ? '#6b7280' : '#9ca3af' // Gray-500/400
                cells.forEach(c => {
                    ctx.fillRect(c.col * CELL_SIZE, c.row * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                })

                // Draw counter for wall_break
                if (obs.type === 'wall_break' && obs.count) {
                    const firstCell = cells[0]
                    ctx.fillStyle = '#000'
                    ctx.font = 'bold 10px monospace'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.fillText(obs.count.toString(), firstCell.col * CELL_SIZE + CELL_SIZE / 2, firstCell.row * CELL_SIZE + CELL_SIZE / 2)
                }
            } else if (obs.type === 'hole') {
                const c = cells[0]
                const cx = c.col * CELL_SIZE + CELL_SIZE / 2
                const cy = c.row * CELL_SIZE + CELL_SIZE / 2
                const holeRadius = CELL_SIZE / 3

                // Dark center
                ctx.fillStyle = '#1f2937'
                ctx.beginPath()
                ctx.arc(cx, cy, holeRadius, 0, Math.PI * 2)
                ctx.fill()

                // Colored ring
                ctx.strokeStyle = obs.color || '#ffffff'
                ctx.lineWidth = 3
                ctx.stroke()
            } else if (obs.type === 'tunnel') {
                const c = cells[0]
                const size = CELL_SIZE * 0.7
                const offset = (CELL_SIZE - size) / 2

                ctx.fillStyle = obs.color || '#10b981'
                ctx.fillRect(c.col * CELL_SIZE + offset, c.row * CELL_SIZE + offset, size, size)
            }
        })

        // Draw Snakes (Arrow Style) - including dots outside grid for exit animation
        gameState.snakes.forEach(snake => {
            if (snake.exited) return

            // Calculate visible dots for hover/interaction only (not for rendering)
            const visibleDots = snake.dots.filter(dot =>
                dot.row >= 0 && dot.row < rows && dot.col >= 0 && dot.col < cols
            )

            const isHovered = hoveredSnake === snake.id
            const isMovable = visibleDots.length > 0 ? isSnakeMovable(snake) : false

            // Draw path line - ALL dots including outside grid
            if (snake.dots.length > 1) {
                ctx.beginPath()
                ctx.strokeStyle = snake.color
                ctx.lineWidth = 4
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'

                // Glow effect for movable hovered snakes
                if (isHovered && isMovable) {
                    ctx.shadowColor = snake.color
                    ctx.shadowBlur = 10
                }

                const start = snake.dots[0]
                ctx.moveTo(start.col * CELL_SIZE + CELL_SIZE / 2, start.row * CELL_SIZE + CELL_SIZE / 2)

                for (let i = 1; i < snake.dots.length; i++) {
                    const dot = snake.dots[i]
                    ctx.lineTo(dot.col * CELL_SIZE + CELL_SIZE / 2, dot.row * CELL_SIZE + CELL_SIZE / 2)
                }
                ctx.stroke()

                ctx.shadowBlur = 0
            }

            // Draw arrowhead at actual head (possibly outside grid)
            const head = snake.dots[snake.dots.length - 1]
            const headX = head.col * CELL_SIZE + CELL_SIZE / 2
            const headY = head.row * CELL_SIZE + CELL_SIZE / 2

            ctx.save()
            ctx.translate(headX, headY)

            // Rotate based on direction
            let rotation = 0
            if (snake.direction === 'right') rotation = Math.PI / 2
            if (snake.direction === 'down') rotation = Math.PI
            if (snake.direction === 'left') rotation = -Math.PI / 2
            ctx.rotate(rotation)

            ctx.fillStyle = snake.color
            ctx.beginPath()
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

            // Draw preview line (alpha 50%) when hovered - extend beyond grid
            if (isHovered && isMovable) {
                const dir = getDirectionVector(snake.direction)
                ctx.strokeStyle = snake.color
                ctx.globalAlpha = 0.5
                ctx.lineWidth = 2
                ctx.setLineDash([4, 4])

                ctx.beginPath()
                ctx.moveTo(headX, headY)

                // Draw line forward beyond grid edge - extend very far
                let previewRow = head.row
                let previewCol = head.col
                const extendDistance = 50 // Extend across entire popup

                for (let i = 0; i < extendDistance; i++) {
                    previewRow += dir.row
                    previewCol += dir.col

                    ctx.lineTo(previewCol * CELL_SIZE + CELL_SIZE / 2, previewRow * CELL_SIZE + CELL_SIZE / 2)
                }

                ctx.stroke()
                ctx.globalAlpha = 1
                ctx.setLineDash([])
            }
        })

        ctx.restore()

    }, [isOpen, gameState, gridData, obstacles, rows, cols, hoveredSnake])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden max-w-[90vw] max-h-[90vh]">

                {/* Header */}
                <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <span className="text-2xl">🎮</span> <span className="translate-y-[1px]">Simulation Mode</span>
                    </h2>

                    <div className="flex items-center gap-4">
                        <div className="text-gray-400 text-sm">
                            Moves: <span className="text-white font-mono">{gameState.moveCount}</span>
                        </div>

                        <div className="h-6 w-px bg-gray-700 mx-2" />

                        <button onClick={resetGame} className="p-2 hover:bg-gray-700 rounded text-yellow-400 transition-colors" title="Reset">
                            <RotateCcw size={18} />
                        </button>

                        <button onClick={onClose} className="p-2 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Game Canvas */}
                <div className="flex-1 bg-black relative p-4 flex items-center justify-center overflow-auto">
                    <canvas
                        ref={canvasRef}
                        width={Math.min(1200, window.innerWidth - 100)}
                        height={Math.min(800, window.innerHeight - 200)}
                        className="max-w-full max-h-full cursor-pointer"
                        onClick={handleCanvasClick}
                        onMouseMove={handleCanvasMove}
                        onMouseLeave={() => setHoveredSnake(null)}
                    />

                    {/* Win Overlay */}
                    {gameState.isComplete && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                            <div className="bg-green-500/20 border-2 border-green-500 rounded-xl p-8 text-center">
                                <div className="text-6xl mb-4">🎉</div>
                                <div className="text-3xl font-bold text-green-400 mb-2">Level Complete!</div>
                                <div className="text-gray-300">Moves: {gameState.moveCount}</div>
                            </div>
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="absolute bottom-6 left-6 bg-gray-800/80 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300">
                        <div>💡 <strong>Tap</strong> any snake to move it</div>
                        <div className="mt-1">Movable snakes will <span className="text-green-400">glow</span> on hover</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
