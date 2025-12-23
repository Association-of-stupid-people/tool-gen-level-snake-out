import { useEffect, useRef, useState, useCallback } from 'react'
import { X, RotateCcw, Play, Square } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLanguage } from '../i18n'
import { useNotification } from '../contexts/NotificationContext'

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
    animationProgress?: number // 0-1 for smooth interpolation
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
    const { t } = useLanguage()
    const { addNotification } = useNotification()

    // Autoplay State
    const [isAutoPlaying, setIsAutoPlaying] = useState(false)
    const autoPlayIntervalRef = useRef<number>(0)

    // Zoom & Pan State
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
    const [isInitialized, setIsInitialized] = useState(false)

    // Keep gameState ref in sync for animation loops
    const gameStateRef = useRef<GameState>(gameState)
    useEffect(() => {
        gameStateRef.current = gameState
    }, [gameState])

    // Initialize Game State & Center Grid
    useEffect(() => {
        if (isOpen) {
            resetGame()
            setIsInitialized(false) // Trigger centering on next render/effect
            setIsAutoPlaying(false) // Stop autoplay when modal opens
        }
    }, [isOpen, snakes])

    // Cleanup autoplay on unmount
    useEffect(() => {
        return () => {
            if (autoPlayIntervalRef.current) {
                clearInterval(autoPlayIntervalRef.current)
            }
        }
    }, [])

    // Center Grid Effect
    useEffect(() => {
        if (isOpen && !isInitialized && canvasRef.current) {
            const canvas = canvasRef.current
            const gridW = cols * CELL_SIZE
            const gridH = rows * CELL_SIZE
            // Center roughly
            setPan({
                x: (canvas.width - gridW) / 2,
                y: (canvas.height - gridH) / 2
            })
            setZoom(1)
            setIsInitialized(true)
        }
    }, [isOpen, isInitialized, rows, cols, CELL_SIZE])

    const resetGame = useCallback(() => {
        gameIdRef.current++ // Invalidate old animations
        console.log('Input snakes:', snakes)
        animatingSnakesRef.current.clear() // Clear animating state
        setIsAutoPlaying(false) // Stop autoplay on reset
        if (autoPlayIntervalRef.current) {
            clearInterval(autoPlayIntervalRef.current)
            autoPlayIntervalRef.current = 0
        }

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
    }, [snakes])

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
            // Check self-collision: snake's own body blocks its path
            const selfBlocked = snake.dots.some(dot =>
                dot.row === checkRow && dot.col === checkCol
            )
            if (selfBlocked) {
                console.log(`Snake ${snake.id} blocked by OWN BODY at ${checkRow},${checkCol}`)
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

    // Get all movable snakes
    const getMovableSnakes = useCallback((snakesArray: Snake[]): Snake[] => {
        return snakesArray.filter(snake => {
            if (snake.exited) return false
            const visibleDots = snake.dots.filter(dot =>
                dot.row >= 0 && dot.row < rows && dot.col >= 0 && dot.col < cols
            )
            return visibleDots.length > 0 && isSnakeMovableCheck(snake, snakesArray)
        })
    }, [rows, cols])

    // Autoplay step - pick random movable snake and animate
    const autoPlayStep = useCallback(() => {
        const currentState = gameStateRef.current

        // Check if complete
        if (currentState.isComplete) {
            setIsAutoPlaying(false)
            if (autoPlayIntervalRef.current) {
                clearInterval(autoPlayIntervalRef.current)
                autoPlayIntervalRef.current = 0
            }
            return
        }

        // Check if all snakes exited (but isComplete not yet updated)
        const allExited = currentState.snakes.every(s => s.exited)
        if (allExited) {
            setIsAutoPlaying(false)
            if (autoPlayIntervalRef.current) {
                clearInterval(autoPlayIntervalRef.current)
                autoPlayIntervalRef.current = 0
            }
            return
        }

        // Get movable snakes (excludes those already animating via animatingSnakesRef check below)
        const movableSnakes = getMovableSnakes(currentState.snakes)

        if (movableSnakes.length === 0) {
            // Check if any snakes are currently animating - if so, just wait
            const anyAnimating = currentState.snakes.some(s =>
                !s.exited && animatingSnakesRef.current.has(s.id)
            )
            if (anyAnimating) {
                return // Still animating, wait for next interval
            }

            // Check if there are non-exited snakes that can't move = actually stuck
            const nonExitedSnakes = currentState.snakes.filter(s => !s.exited)
            if (nonExitedSnakes.length > 0) {
                // Level is actually stuck
                setIsAutoPlaying(false)
                if (autoPlayIntervalRef.current) {
                    clearInterval(autoPlayIntervalRef.current)
                    autoPlayIntervalRef.current = 0
                }
                addNotification('error', t('levelStuck'))
            }
            return
        }

        // Pick random movable snake
        const randomSnake = movableSnakes[Math.floor(Math.random() * movableSnakes.length)]

        // Check if not already animating
        if (!animatingSnakesRef.current.has(randomSnake.id)) {
            setGameState(prev => ({ ...prev, moveCount: prev.moveCount + 1 }))
            animateSnakeExit(randomSnake.id)
        }
    }, [getMovableSnakes, addNotification, t])

    // Start autoplay
    const startAutoPlay = useCallback(() => {
        setIsAutoPlaying(true)
        // Run autoplay step every 300ms
        autoPlayIntervalRef.current = window.setInterval(() => {
            autoPlayStep()
        }, 300)
    }, [autoPlayStep])

    // Stop autoplay
    const stopAutoPlay = useCallback(() => {
        setIsAutoPlaying(false)
        if (autoPlayIntervalRef.current) {
            clearInterval(autoPlayIntervalRef.current)
            autoPlayIntervalRef.current = 0
        }
    }, [])

    // Toggle autoplay
    const toggleAutoPlay = useCallback(() => {
        if (isAutoPlaying) {
            stopAutoPlay()
        } else {
            startAutoPlay()
        }
    }, [isAutoPlaying, startAutoPlay, stopAutoPlay])

    // Canvas click handler
    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        // Disable clicks during autoplay
        if (isAutoPlaying) return

        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()

        // Account for CSS scaling (canvas internal size vs displayed size)
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height

        const clickX = (e.clientX - rect.left) * scaleX
        const clickY = (e.clientY - rect.top) * scaleY

        // Calculate grid position (Inverse Transform: (Screen - Pan) / Zoom)
        const gridX = (clickX - pan.x) / zoom
        const gridY = (clickY - pan.y) / zoom

        const mapWidth = cols * CELL_SIZE
        const mapHeight = rows * CELL_SIZE

        console.log('Click:', { clickX, clickY, gridX, gridY, pan, zoom })

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
    }, [isAutoPlaying, pan, zoom, cols, rows, gameState.snakes])

    // Animate snake continuously until it exits or is blocked
    const animateSnakeExit = (snakeId: number) => {
        const startGeneration = gameIdRef.current

        // Prevent duplicate animations on same snake
        if (animatingSnakesRef.current.has(snakeId)) {
            console.log('[ANIM] Snake already animating, skipping:', snakeId)
            return
        }

        // First check if snake is actually movable BEFORE starting animation
        const initialState = gameStateRef.current
        const initialSnake = initialState.snakes.find(s => s.id === snakeId)
        if (!initialSnake || initialSnake.exited) {
            return
        }

        // Check if blocked at start
        const visibleDots = initialSnake.dots.filter(dot =>
            dot.row >= 0 && dot.row < rows && dot.col >= 0 && dot.col < cols
        )
        if (visibleDots.length > 0 && !isSnakeMovableCheck(initialSnake, initialState.snakes)) {
            console.log('[ANIM] Snake is blocked, not starting animation')
            return
        }

        animatingSnakesRef.current.add(snakeId)

        const MOVE_DURATION = 40 // ms for one cell movement
        let animationStartTime = Date.now()
        let shouldContinue = true

        console.log('[ANIM] Starting animation for snake:', snakeId)

        const animationLoop = () => {
            // Stop conditions
            if (gameIdRef.current !== startGeneration) {
                animatingSnakesRef.current.delete(snakeId)
                return
            }
            if (!shouldContinue) {
                animatingSnakesRef.current.delete(snakeId)
                return
            }

            const elapsed = Date.now() - animationStartTime
            const progress = Math.min(elapsed / MOVE_DURATION, 1)

            // Single atomic state update
            setGameState(prev => {
                const snakeIndex = prev.snakes.findIndex(s => s.id === snakeId)
                if (snakeIndex === -1) {
                    shouldContinue = false
                    return prev
                }

                const snake = prev.snakes[snakeIndex]
                if (snake.exited) {
                    shouldContinue = false
                    return prev
                }

                const newSnakes = [...prev.snakes]

                if (progress < 1) {
                    // Still animating - just update progress
                    newSnakes[snakeIndex] = {
                        ...snake,
                        animationProgress: progress
                    }
                } else {
                    // Animation complete - move to next cell
                    const head = snake.dots[snake.dots.length - 1]
                    const dirVec = getDirectionVector(snake.direction)
                    const newHead = { row: head.row + dirVec.row, col: head.col + dirVec.col }

                    const newDots = [...snake.dots, newHead]
                    newDots.shift()

                    // Check if TAIL is far enough outside canvas
                    const MARGIN_CELLS = 15
                    const newTail = newDots[0]
                    const tailTooFar = newTail.row < -MARGIN_CELLS || newTail.row >= rows + MARGIN_CELLS ||
                        newTail.col < -MARGIN_CELLS || newTail.col >= cols + MARGIN_CELLS

                    const exited = tailTooFar

                    newSnakes[snakeIndex] = {
                        ...snake,
                        dots: newDots,
                        exited: exited,
                        animationProgress: 0 // Reset for next move
                    }

                    if (exited) {
                        shouldContinue = false
                    } else {
                        // Check if next move is blocked
                        const newVisibleDots = newDots.filter(dot =>
                            dot.row >= 0 && dot.row < rows && dot.col >= 0 && dot.col < cols
                        )
                        const tempSnake = { ...snake, dots: newDots }
                        if (newVisibleDots.length > 0 && !isSnakeMovableCheck(tempSnake, newSnakes)) {
                            shouldContinue = false
                        }
                    }

                    // Reset timer for next move
                    animationStartTime = Date.now()
                }

                const allExited = newSnakes.every(s => s.exited)
                return {
                    snakes: newSnakes,
                    moveCount: prev.moveCount,
                    isComplete: allExited
                }
            })

            // Continue animation if not stopped
            if (shouldContinue) {
                requestAnimationFrame(animationLoop)
            } else {
                animatingSnakesRef.current.delete(snakeId)
            }
        }

        // Start animation
        requestAnimationFrame(animationLoop)
    }

    // Canvas hover handler (throttled to prevent flicker) - memoized
    const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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

        const gridX = (mouseX - pan.x) / zoom
        const gridY = (mouseY - pan.y) / zoom

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
    }, [pan, zoom, cols, rows, gameState.snakes])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {  // Middle click or Shift+Click
            setIsDragging(true)
            setLastPos({ x: e.clientX, y: e.clientY })
            e.preventDefault()
        }
    }, [])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    const handleMouseMoveCombined = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDragging) {
            const dx = e.clientX - lastPos.x
            const dy = e.clientY - lastPos.y
            setPan(p => ({ x: p.x + dx, y: p.y + dy }))
            setLastPos({ x: e.clientX, y: e.clientY })
        } else {
            handleCanvasMove(e)
        }
    }, [isDragging, lastPos, handleCanvasMove])

    const handleWheel = useCallback((e: React.WheelEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return

        // Only zoom if canvas is hovered? (Implicit since event is on canvas)
        e.preventDefault()

        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // World before zoom
        const worldX = (mouseX - pan.x) / zoom
        const worldY = (mouseY - pan.y) / zoom

        const delta = e.deltaY > 0 ? 0.9 : 1.1
        const newZoom = Math.max(0.1, Math.min(5, zoom * delta))

        // New Pan to keep world point under mouse
        const newPanX = mouseX - worldX * newZoom
        const newPanY = mouseY - worldY * newZoom

        setZoom(newZoom)
        setPan({ x: newPanX, y: newPanY })
    }, [pan, zoom])

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
        // Centering
        const mapWidth = cols * CELL_SIZE
        const mapHeight = rows * CELL_SIZE

        // Initial centering is handled by state logic now
        // const offsetX = (canvas.width - mapWidth) / 2
        // const offsetY = (canvas.height - mapHeight) / 2

        ctx.save()
        // ctx.translate(offsetX, offsetY)
        ctx.translate(pan.x, pan.y)
        ctx.scale(zoom, zoom)

        // Draw Grid Walls (REMOVED per user request - Simulation mode doesn't show valid area background)
        /*
        ctx.fillStyle = '#374151' // Gray-700
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (gridData[r][c]) {
                    ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                }
            }
        }
        */

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

            // Get animation progress (0-1) for smooth interpolation
            const progress = snake.animationProgress || 0
            const dir = getDirectionVector(snake.direction)

            // For smooth animation that preserves corners:
            // - Head extends in direction
            // - Tail shrinks (interpolates toward next dot)
            // - Middle body segments stay at their grid positions
            const interpolatedDots = snake.dots.map((dot, index) => {
                // Only interpolate if animating (0 < progress < 1)
                if (progress > 0 && progress < 1) {
                    if (index === snake.dots.length - 1) {
                        // HEAD: extends in direction
                        return {
                            row: dot.row + dir.row * progress,
                            col: dot.col + dir.col * progress
                        }
                    } else if (index === 0) {
                        // TAIL: shrinks toward the next segment
                        const nextDot = snake.dots[1]
                        return {
                            row: dot.row + (nextDot.row - dot.row) * progress,
                            col: dot.col + (nextDot.col - dot.col) * progress
                        }
                    }
                    // BODY: stays at exact grid position (preserves corners)
                }
                return dot
            })

            // Draw path line - ALL dots including outside grid
            if (interpolatedDots.length > 1) {
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

                const start = interpolatedDots[0]
                ctx.moveTo(start.col * CELL_SIZE + CELL_SIZE / 2, start.row * CELL_SIZE + CELL_SIZE / 2)

                for (let i = 1; i < interpolatedDots.length; i++) {
                    const dot = interpolatedDots[i]
                    ctx.lineTo(dot.col * CELL_SIZE + CELL_SIZE / 2, dot.row * CELL_SIZE + CELL_SIZE / 2)
                }
                ctx.stroke()

                ctx.shadowBlur = 0
            }

            // Draw arrowhead at interpolated head position
            const head = interpolatedDots[interpolatedDots.length - 1]
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

        ctx.restore()

    }, [isOpen, gameState, gridData, obstacles, rows, cols, hoveredSnake, zoom, pan])

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden max-w-[90vw] max-h-[90vh]"
                    >

                        {/* Header */}
                        <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
                            <h2 className="text-white font-bold text-lg flex items-center gap-2">
                                <span className="text-2xl">🎮</span> <span className="translate-y-[1px]">{t('simulationMode')}</span>
                            </h2>

                            <div className="flex items-center gap-4">
                                <div className="text-gray-400 text-sm">
                                    {t('moves')}: <span className="text-white font-mono">{gameState.moveCount}</span>
                                </div>

                                <div className="h-6 w-px bg-gray-700 mx-2" />

                                {/* Zoom Slider */}
                                <div className="flex items-center gap-2 mr-2">
                                    <span className="text-xs text-gray-400">{t('zoom')}</span>
                                    <input
                                        type="range"
                                        min="10"
                                        max="300"
                                        value={Math.round(zoom * 100)}
                                        onChange={(e) => setZoom(Number(e.target.value) / 100)}
                                        className="w-24 accent-purple-500"
                                    />
                                    <span className="text-xs text-gray-500 w-8">{Math.round(zoom * 100)}%</span>
                                </div>

                                <div className="h-6 w-px bg-gray-700 mx-2" />

                                <button onClick={resetGame} className="p-2 hover:bg-gray-700 rounded text-yellow-400 transition-colors" title={t('reset')}>
                                    <RotateCcw size={18} />
                                </button>

                                <button
                                    onClick={toggleAutoPlay}
                                    className={`p-2 rounded transition-colors ${isAutoPlaying
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                        }`}
                                    title={isAutoPlaying ? t('stopAutoPlay') : t('autoPlay')}
                                >
                                    {isAutoPlaying ? <Square size={18} /> : <Play size={18} />}
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
                                onMouseMove={handleMouseMoveCombined}
                                onMouseDown={handleMouseDown}
                                onMouseUp={handleMouseUp}
                                onWheel={handleWheel}
                                onMouseLeave={() => {
                                    setHoveredSnake(null)
                                    setIsDragging(false)
                                }}
                            />

                            {/* Win Overlay */}
                            <AnimatePresence>
                                {gameState.isComplete && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                                    >
                                        <div className="bg-green-500/20 border-2 border-green-500 rounded-xl p-8 text-center">
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                                                transition={{ delay: 0.2 }}
                                                className="text-6xl mb-4"
                                            >
                                                🎉
                                            </motion.div>
                                            <div className="text-3xl font-bold text-green-400 mb-2">{t('levelComplete')}</div>
                                            <div className="text-gray-300">{t('moves')}: {gameState.moveCount}</div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Instructions */}
                            <div className="absolute bottom-6 left-6 bg-gray-800/80 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300">
                                {isAutoPlaying ? (
                                    <div className="flex items-center gap-2">
                                        <span className="animate-pulse">🤖</span>
                                        <span>{t('autoPlayActive')}</span>
                                    </div>
                                ) : (
                                    <>
                                        <div>💡 {t('tapToMove')}</div>
                                        <div className="mt-1">{t('movableGlow')}</div>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
