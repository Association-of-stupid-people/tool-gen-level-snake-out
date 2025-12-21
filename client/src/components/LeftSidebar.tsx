import { Grid, Wand2, Settings, Plus, X, ChevronDown, Sliders, Package, Ban, Palette, FileJson, Copy, Code, AlertTriangle, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '../contexts/SettingsContext'
import { AnimatedButton } from './AnimatedButton'
import { CustomSelect } from './CustomSelect'
import { CompactSelect } from './CompactSelect'
import { useNotification } from '../contexts/NotificationContext'
import { useState, useEffect } from 'react'

interface LeftSidebarProps {
    activePanel: 'panel1' | 'panel2' | 'settings'
    onPanelChange: (panel: 'panel1' | 'panel2' | 'settings') => void
    onGenerate?: (params: any) => void
    isGenerating?: boolean
    jsonInput?: string
    setJsonInput?: (value: string) => void
    onObstacleTypeUsed?: (handler: (data: { id?: number, type: string, row: number, col: number, color?: string, count?: number, cells?: { row: number, col: number }[], keyId?: number, lockId?: number }) => void) => void
    onObstacleUpdate?: (handler: (row: number, col: number, updates: any) => void) => void
    onObstacleDelete?: (handler: (row: number, col: number) => void) => void
    nextItemId: number
    setNextItemId: React.Dispatch<React.SetStateAction<number>>
    onDataUpdate?: (id: string | number, updates: any) => void
    onObstacleAdd?: (data: { id?: number, type: string, row: number, col: number, color?: string, count?: number, cells?: { row: number, col: number }[], keyId?: number, lockId?: number, snakeId?: number, keySnakeId?: number, lockedSnakeId?: number, countdown?: number }) => void
    // Grid Data props for JSON Editor
    gridData?: boolean[][]
    setGridData?: (data: boolean[][]) => void
}

interface ColorDropdownProps {
    color: string
    palette: string[]
    onChange: (color: string) => void
}

function ColorDropdown({ color, palette, onChange }: ColorDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const index = palette.indexOf(color)

    return (
        <div className="relative">
            <button
                className="w-24 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white flex items-center justify-between hover:border-gray-500 transition-colors"
                style={{ borderLeft: `8px solid ${color}` }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">Color {index !== -1 ? index + 1 : '?'}</span>
                <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute top-full right-0 w-48 bg-gray-800 border border-gray-600 rounded mt-1 z-20 shadow-xl max-h-48 overflow-y-auto origin-top-right"
                        >
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
                                    <span className="text-xs text-gray-200">Color {i + 1} <span className="text-gray-500 font-mono ml-1">({c})</span></span>
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}

// JSON Editor Section Component for Grid Panel - Shows gridData (true/false array)
interface JsonEditorSectionProps {
    gridData?: boolean[][]
    onGridDataChange?: (data: boolean[][]) => void
}

function JsonEditorSection({ gridData, onGridDataChange }: JsonEditorSectionProps) {
    const { addNotification } = useNotification()

    const [jsonText, setJsonText] = useState('')
    const [isValid, setIsValid] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')
    const [isUserEditing, setIsUserEditing] = useState(false)

    // Helper: Convert boolean grid to Integer Matrix (0/1) for clean formatting
    const formatGrid = (data: boolean[][]) => {
        // Map boolean to 0/1
        const matrix = data.map(row => row.map(cell => cell ? 1 : 0))

        // Format as JSON with one row per line, with spaces for better readability
        const rows = matrix.map(row => `[${row.join(', ')}]`)
        return '[\n  ' + rows.join(',\n  ') + '\n]'
    }

    // Helper: Parse valid JSON (Integer Matrix or Boolean) to boolean grid
    const parseAndValidate = (text: string): boolean[][] => {
        try {
            const parsed = JSON.parse(text)

            // Validate it's a 2D array
            if (!Array.isArray(parsed) || !parsed.every(row => Array.isArray(row))) {
                throw new Error('Must be a 2D array')
            }

            // Convert values to boolean
            // Support: 1/0, true/false
            const grid = parsed.map(row => row.map((cell: any) => {
                if (typeof cell === 'number') return cell !== 0
                if (typeof cell === 'boolean') return cell
                if (typeof cell === 'string') return cell === '1' || cell === 'true'
                return !!cell
            }))

            // Validate rectangle shape
            if (grid.length > 0) {
                const width = grid[0].length
                if (!grid.every(row => row.length === width)) {
                    throw new Error('Rows must have equal length')
                }
            }

            return grid
        } catch (e: any) {
            throw new Error(e.message || 'Invalid JSON format')
        }
    }

    // Sync gridData to JSON text
    useEffect(() => {
        if (!isUserEditing && gridData) {
            setJsonText(formatGrid(gridData))
            setIsValid(true)
            setErrorMessage('')
        }
    }, [gridData, isUserEditing])

    const handleJsonChange = (value: string) => {
        setJsonText(value)
        setIsUserEditing(true)
        try {
            parseAndValidate(value)
            setIsValid(true)
            setErrorMessage('')
        } catch (e: any) {
            setIsValid(false)
            setErrorMessage(e.message || 'Invalid Format')
        }
    }

    const handleApplyJson = () => {
        if (!isValid) return
        try {
            const parsedGrid = parseAndValidate(jsonText)
            onGridDataChange?.(parsedGrid)
            setIsUserEditing(false)
            setJsonText(formatGrid(parsedGrid)) // Reformat properly
            addNotification('success', 'Grid updated')
        } catch (e) {
            addNotification('error', 'Failed to parse Grid')
        }
    }

    const handleFormat = () => {
        try {
            const parsedGrid = parseAndValidate(jsonText)
            setJsonText(formatGrid(parsedGrid))
            setIsValid(true)
        } catch (e: any) {
            setIsValid(false)
            setErrorMessage(e.message)
        }
    }

    const handleCopy = async () => {
        await navigator.clipboard.writeText(jsonText)
        addNotification('success', 'Copied!')
    }

    const handleClear = () => {
        const rows = gridData?.length || 10
        const cols = gridData?.[0]?.length || 10
        const empty = Array(rows).fill(null).map(() => Array(cols).fill(false))
        setJsonText(formatGrid(empty))
        setIsUserEditing(true)
        onGridDataChange?.(empty)
    }

    const cellCount = gridData ? gridData.flat().filter(Boolean).length : 0
    const totalCells = gridData ? gridData.length * (gridData[0]?.length || 0) : 0

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="bg-gray-700/50 rounded-xl p-4 flex-1 flex flex-col">
                <h3 className="text-sm font-semibold text-white border-b border-gray-600 pb-2 mb-3 flex items-center gap-2">
                    <FileJson size={16} className="text-purple-400" /> <span className="translate-y-[1px]">Grid Editor</span>
                </h3>
                <p className="text-xs text-gray-400 mb-3">{cellCount} / {totalCells} cells filled</p>

                <textarea
                    value={jsonText}
                    onChange={(e) => handleJsonChange(e.target.value)}
                    className={`flex-1 min-h-[320px] w-full bg-gray-900/80 rounded-lg p-3 text-xs font-mono text-gray-200 resize-none focus:outline-none scrollbar-hide ${isValid ? 'border border-gray-600/50 focus:border-purple-500' : 'border-2 border-red-500/70'}`}
                    spellCheck={false}
                    placeholder="Row 0: 0, 0, 1..."
                />

                {!isValid && <p className="text-xs text-red-400 mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {errorMessage}</p>}

                {isUserEditing && isValid && (
                    <div className="flex gap-2 mt-3">
                        <button onClick={handleApplyJson} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs py-2 rounded transition-colors">Apply</button>
                        <button onClick={() => setIsUserEditing(false)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 px-3 rounded">Cancel</button>
                    </div>
                )}

                <div className="flex gap-2 mt-3">
                    <button onClick={handleFormat} className="flex-1 flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded"><Code size={12} /> <span className="translate-y-[1px]">Format</span></button>
                    <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded"><Copy size={12} /> <span className="translate-y-[1px]">Copy</span></button>
                    <button onClick={handleClear} className="flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 px-3 rounded"><Trash2 size={12} /></button>
                </div>
            </div>
        </div>
    )
}

export function LeftSidebar({ activePanel, onPanelChange, onGenerate, isGenerating, onObstacleTypeUsed, onObstacleUpdate, onObstacleDelete, nextItemId, setNextItemId, onDataUpdate, onObstacleAdd, gridData, setGridData }: LeftSidebarProps) {
    const {
        gridSize, setGridSize,
        snakePalette, setSnakePalette,
        filenamePrefix, setFilenamePrefix,
        filenameSuffix, setFilenameSuffix,
        restrictDrawToColored, setRestrictDrawToColored,
        lengthRange, setLengthRange,
        bendsRange, setBendsRange
    } = useSettings()

    // Obstacle Types
    type ObstacleType = 'wall' | 'wall_break' | 'hole' | 'tunnel' | 'iced_snake' | 'key_snake'

    interface ObstacleItem {
        id: string | number
        type: ObstacleType
        // Position (optional, for manually drawn obstacles)
        row?: number
        col?: number
        cells?: { row: number, col: number }[]
        // Configs
        wallBreakCounter?: number
        color?: string
        direction?: string // For tunnels
        snakeId?: number
        keySnakeId?: number
        lockedSnakeId?: number
        countdown?: number
        // Calculated
        // cellCount?: number // Could add this or just use cells.length
    }

    const [selectedObstacleType, setSelectedObstacleType] = useState<ObstacleType>('wall')
    const [distributionStrategy, setDistributionStrategy] = useState<string>('SMART_DYNAMIC')

    // Strategy default configs
    const STRATEGY_DEFAULTS: Record<string, Record<string, any>> = {
        SMART_DYNAMIC: {
            depth_priority: 0.7,
            pool_size_percent: 0.25,
        },
        RANDOM_ADAPTIVE: {
            prefer_edges: false,
            avoid_corners: false,
        },
        EDGE_HUGGER: {
            edge_distance_max: 2,
            corner_priority: true,
            wall_follow_strength: 0.8,
        },
        MAX_CLUMP: {
            min_area_size: 4,
            expansion_rate: 0.6,
            avoid_edges: false,
        },
        SPIRAL_FILL: {
            direction: 'random',
            start_from: 'random',
            tightness: 0.7,
        },
        SYMMETRICAL: {
            symmetry_type: 'random',
            strictness: 0.8,
            fallback_strategy: 'random',
        },
    }

    // Strategy config state - starts with SMART_DYNAMIC defaults
    const [strategyConfig, setStrategyConfig] = useState<Record<string, any>>(
        STRATEGY_DEFAULTS.SMART_DYNAMIC
    )

    // Reset config when strategy changes
    useEffect(() => {
        setStrategyConfig(STRATEGY_DEFAULTS[distributionStrategy] || {})
    }, [distributionStrategy])

    const updateConfig = (key: string, value: any) => {
        setStrategyConfig(prev => ({ ...prev, [key]: value }))
    }

    // const [jsonInput, setJsonInput] = useState('') // Lifted to App
    const [arrowCount, setArrowCount] = useState(10)
    // Removed local state for length/bends ranges in favor of SettingsContext

    // Obstacles List
    const [obstacles, setObstacles] = useState<ObstacleItem[]>([])

    const addObstacle = (type: ObstacleType, row?: number, col?: number, color?: string, count?: number, cells?: { row: number, col: number }[], direction?: string, id?: number, skipSync?: boolean) => {
        const newObs: ObstacleItem = {
            id: id !== undefined ? id : nextItemId,
            type,
            row,
            col,
            cells,
            // Defaults
            wallBreakCounter: type === 'wall_break' ? (count || 3) : undefined,
            color: color || (type === 'hole' ? '#0000FF' : type === 'tunnel' ? '#FF00FF' : undefined),
            direction: type === 'tunnel' ? (direction || 'right') : undefined,
            snakeId: type === 'iced_snake' ? 1 : undefined,
            keySnakeId: type === 'key_snake' ? 1 : undefined,
            lockedSnakeId: type === 'key_snake' ? 2 : undefined,
            countdown: type === 'iced_snake' ? 10 : undefined
        }
        setObstacles(prev => [...prev, newObs]) // Use functional update to avoid stale closure
        // Sync all obstacles to grid state (including special configs for icon rendering)
        if (onObstacleAdd && !skipSync) {
            onObstacleAdd({
                ...newObs,
                id: Number(newObs.id),
                row: newObs.row || 0,
                col: newObs.col || 0
            })
        }

        if (id === undefined) {
            setNextItemId(prev => prev + 1)
        }
    }

    const removeObstacle = (id: string | number) => {
        setObstacles(obstacles.filter(obs => obs.id !== id))
    }

    const updateObstacle = (id: string | number, updates: Partial<ObstacleItem>) => {
        setObstacles(obstacles.map(obs => obs.id === id ? { ...obs, ...updates } : obs))
        onDataUpdate?.(id, updates)
    }

    // Auto-add obstacle when drawn manually with full details
    const handleObstacleTypeUsed = (obstacleData: { id?: number, type: string, row: number, col: number, color?: string, count?: number, cells?: { row: number, col: number }[], direction?: string }) => {
        // console.log('Adding obstacle:', obstacleData) // Debug log
        addObstacle(obstacleData.type as ObstacleType, obstacleData.row, obstacleData.col, obstacleData.color, obstacleData.count, obstacleData.cells, obstacleData.direction, obstacleData.id, true)
    }

    // Handle obstacle update from grid context menu
    const handleObstacleUpdateFromGrid = (row: number, col: number, updates: any) => {
        setObstacles(prev => prev.map(obs => {
            // Match by row/col (primary cell)
            if (obs.row === row && obs.col === col) {
                return { ...obs, ...updates }
            }
            return obs
        }))
    }

    // Handle obstacle delete from grid context menu
    const handleObstacleDeleteFromGrid = (row: number, col: number) => {
        setObstacles(prev => prev.filter(obs => !(obs.row === row && obs.col === col)))
    }

    // Register callbacks with parent on mount
    useEffect(() => {
        onObstacleTypeUsed?.(handleObstacleTypeUsed as any)
        onObstacleUpdate?.(handleObstacleUpdateFromGrid)
        onObstacleDelete?.(handleObstacleDeleteFromGrid)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const panels = [
        { id: 'panel1' as const, icon: Grid, label: 'Grid' },
        { id: 'panel2' as const, icon: Wand2, label: 'Generator' },
        { id: 'settings' as const, icon: Settings, label: 'Settings' },
    ]



    const handleGenerateClick = () => {
        if (onGenerate) {
            // Transform gridData to 0/1 Integer Matrix for server
            let customInput = undefined
            if (gridData && gridData.length > 0) {
                const matrix = gridData.map(row => row.map(cell => cell ? 1 : 0))
                customInput = JSON.stringify(matrix)
            }

            onGenerate({
                arrowCount,
                minLen: lengthRange.min,
                maxLen: lengthRange.max,
                minBends: bendsRange.min,
                maxBends: bendsRange.max,
                obstacles,
                palette: snakePalette,
                distributionStrategy,
                strategyConfig,
                customInput // Pass the grid data!
            })
        }
    }

    const handleColorAdd = () => {
        setSnakePalette([...snakePalette, '#000000'])
    }

    const handleColorRemove = (index: number) => {
        setSnakePalette(snakePalette.filter((_, i) => i !== index))
    }

    const handleColorChange = (index: number, color: string) => {
        const newPalette = [...snakePalette]
        newPalette[index] = color
        setSnakePalette(newPalette)
    }

    return (
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col h-full">
            {/* Top Panel Buttons */}
            <div className="flex p-2 gap-2 border-b border-gray-700">
                {panels.map(panel => {
                    const Icon = panel.icon
                    const isActive = activePanel === panel.id
                    return (
                        <button
                            key={panel.id}
                            onClick={() => onPanelChange(panel.id)}
                            className={`
                                relative isolate flex-1 flex flex-col items-center justify-center p-2 rounded-lg gap-1 transition-colors
                                ${isActive ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}
                            `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="sidebar-panel-active"
                                    className="absolute inset-0 bg-purple-600 rounded-lg shadow-lg shadow-purple-900/50 -z-10"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <Icon size={20} className="relative z-10" />
                            <span className="relative z-10 text-xs font-medium">{panel.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                {activePanel === 'panel1' && (
                    <JsonEditorSection
                        gridData={gridData}
                        onGridDataChange={setGridData}
                    />
                )}

                {activePanel === 'panel2' && (
                    <div className="space-y-6">
                        <AnimatedButton
                            onClick={handleGenerateClick}
                            disabled={isGenerating}
                            className={`w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-bold shadow-lg 
                            ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-purple-900/50'} flex items-center justify-center gap-2`}
                        >
                            {isGenerating ? (
                                <>
                                    <Wand2 size={18} className="animate-spin" /> Generating...
                                </>
                            ) : (
                                <>
                                    <Wand2 size={18} /> Generate Level
                                </>
                            )}
                        </AnimatedButton>



                        <div className="bg-gray-700/50 rounded-xl p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-white border-b border-gray-600 pb-2 flex items-center gap-2">
                                <Package size={16} /> <span className="translate-y-[1px]">Distribution Strategy</span>
                            </h3>

                            <div className="flex items-center justify-between gap-4">
                                <label className="text-xs text-gray-400 whitespace-nowrap">Arrow Count</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="2000"
                                    value={arrowCount}
                                    onChange={e => setArrowCount(Math.max(1, parseInt(e.target.value) || 0))}
                                    className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-all font-mono text-left"
                                />
                            </div>

                            <div className="relative">
                                <CustomSelect
                                    value={distributionStrategy}
                                    onChange={(val) => setDistributionStrategy(val)}
                                    options={[
                                        { value: 'SMART_DYNAMIC', label: 'Smart Dynamic' },
                                        { value: 'RANDOM_ADAPTIVE', label: 'Random Adaptive' },
                                        { value: 'EDGE_HUGGER', label: 'Edge Hugger' },
                                        { value: 'MAX_CLUMP', label: 'Max Clump' },
                                        { value: 'SPIRAL_FILL', label: 'Spiral Fill' },
                                        { value: 'SYMMETRICAL', label: 'Symmetrical' },
                                    ]}
                                />
                            </div>

                            {/* Strategy Config */}
                            {distributionStrategy === 'SMART_DYNAMIC' && (
                                <div className="space-y-3 pt-3 border-t border-gray-600/50">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400">Depth Priority ({strategyConfig.depth_priority})</label>
                                        <input
                                            type="range" min="0" max="1" step="0.1"
                                            value={strategyConfig.depth_priority}
                                            onChange={(e) => updateConfig('depth_priority', parseFloat(e.target.value))}
                                            className="w-full accent-purple-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400">Pool Size % ({strategyConfig.pool_size_percent})</label>
                                        <input
                                            type="range" min="0.1" max="0.5" step="0.05"
                                            value={strategyConfig.pool_size_percent}
                                            onChange={(e) => updateConfig('pool_size_percent', parseFloat(e.target.value))}
                                            className="w-full accent-purple-500"
                                        />
                                    </div>
                                </div>
                            )}

                            {distributionStrategy === 'RANDOM_ADAPTIVE' && (
                                <div className="space-y-3 pt-3 border-t border-gray-600/50">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Prefer Edges</label>
                                        <button
                                            onClick={() => updateConfig('prefer_edges', !strategyConfig.prefer_edges)}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${strategyConfig.prefer_edges ? 'bg-purple-600' : 'bg-gray-600'}`}
                                        >
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${strategyConfig.prefer_edges ? 'translate-x-5' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Avoid Corners</label>
                                        <button
                                            onClick={() => updateConfig('avoid_corners', !strategyConfig.avoid_corners)}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${strategyConfig.avoid_corners ? 'bg-purple-600' : 'bg-gray-600'}`}
                                        >
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${strategyConfig.avoid_corners ? 'translate-x-5' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {distributionStrategy === 'EDGE_HUGGER' && (
                                <div className="space-y-3 pt-3 border-t border-gray-600/50">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400">Wall Follow Strength ({strategyConfig.wall_follow_strength})</label>
                                        <input
                                            type="range" min="0" max="1" step="0.1"
                                            value={strategyConfig.wall_follow_strength}
                                            onChange={(e) => updateConfig('wall_follow_strength', parseFloat(e.target.value))}
                                            className="w-full accent-purple-500"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Edge Distance Max</label>
                                        <input
                                            type="number" min="0" max="5"
                                            value={strategyConfig.edge_distance_max}
                                            onChange={(e) => updateConfig('edge_distance_max', parseInt(e.target.value) || 0)}
                                            className="w-16 bg-gray-900/50 text-white text-xs px-2 py-1 rounded border border-gray-600 text-left"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Corner Priority</label>
                                        <button
                                            onClick={() => updateConfig('corner_priority', !strategyConfig.corner_priority)}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${strategyConfig.corner_priority ? 'bg-purple-600' : 'bg-gray-600'}`}
                                        >
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${strategyConfig.corner_priority ? 'translate-x-5' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                </div>
                            )}

                            {distributionStrategy === 'MAX_CLUMP' && (
                                <div className="space-y-3 pt-3 border-t border-gray-600/50">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400">Expansion Rate ({strategyConfig.expansion_rate})</label>
                                        <input
                                            type="range" min="0" max="1" step="0.1"
                                            value={strategyConfig.expansion_rate}
                                            onChange={(e) => updateConfig('expansion_rate', parseFloat(e.target.value))}
                                            className="w-full accent-purple-500"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Min Area Size</label>
                                        <input
                                            type="number" min="1" max="10"
                                            value={strategyConfig.min_area_size}
                                            onChange={(e) => updateConfig('min_area_size', parseInt(e.target.value) || 1)}
                                            className="w-16 bg-gray-900/50 text-white text-xs px-2 py-1 rounded border border-gray-600 text-left"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Avoid Edges</label>
                                        <button
                                            onClick={() => updateConfig('avoid_edges', !strategyConfig.avoid_edges)}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${strategyConfig.avoid_edges ? 'bg-purple-600' : 'bg-gray-600'}`}
                                        >
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${strategyConfig.avoid_edges ? 'translate-x-5' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {distributionStrategy === 'SPIRAL_FILL' && (
                                <div className="space-y-3 pt-3 border-t border-gray-600/50">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400">Tightness ({strategyConfig.tightness})</label>
                                        <input
                                            type="range" min="0" max="1" step="0.1"
                                            value={strategyConfig.tightness}
                                            onChange={(e) => updateConfig('tightness', parseFloat(e.target.value))}
                                            className="w-full accent-purple-500"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Direction</label>
                                        <div className="relative w-32">
                                            <CompactSelect
                                                value={strategyConfig.direction}
                                                onChange={(val) => updateConfig('direction', val)}
                                                options={[
                                                    { value: 'random', label: 'Random' },
                                                    { value: 'clockwise', label: 'Clockwise' },
                                                    { value: 'counter_clockwise', label: 'Counter CW' },
                                                ]}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Start From</label>
                                        <div className="relative w-32">
                                            <CompactSelect
                                                value={strategyConfig.start_from}
                                                onChange={(val) => updateConfig('start_from', val)}
                                                options={[
                                                    { value: 'random', label: 'Random' },
                                                    { value: 'center', label: 'Center' },
                                                    { value: 'corner', label: 'Corner' },
                                                ]}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {distributionStrategy === 'SYMMETRICAL' && (
                                <div className="space-y-3 pt-3 border-t border-gray-600/50">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400">Strictness ({strategyConfig.strictness})</label>
                                        <input
                                            type="range" min="0" max="1" step="0.1"
                                            value={strategyConfig.strictness}
                                            onChange={(e) => updateConfig('strictness', parseFloat(e.target.value))}
                                            className="w-full accent-purple-500"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Symmetry Type</label>
                                        <div className="relative w-32">
                                            <CompactSelect
                                                value={strategyConfig.symmetry_type}
                                                onChange={(val) => updateConfig('symmetry_type', val)}
                                                options={[
                                                    { value: 'random', label: 'Random' },
                                                    { value: 'horizontal', label: 'Horizontal' },
                                                    { value: 'vertical', label: 'Vertical' },
                                                    { value: 'both', label: 'Both' },
                                                    { value: 'radial', label: 'Radial' },
                                                ]}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Fallback</label>
                                        <div className="relative w-32">
                                            <CompactSelect
                                                value={strategyConfig.fallback_strategy}
                                                onChange={(val) => updateConfig('fallback_strategy', val)}
                                                options={[
                                                    { value: 'random', label: 'Random' },
                                                    { value: 'smart_dynamic', label: 'Smart Dynamic' },
                                                    { value: 'edge_hugger', label: 'Edge Hugger' },
                                                ]}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-700/50 rounded-xl p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-white border-b border-gray-600 pb-2 flex items-center gap-2">
                                <Sliders size={16} /> <span className="translate-y-[1px]">Complexity</span>
                            </h3>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-400">Length Range ({lengthRange.min} - {lengthRange.max})</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number" min="2" max="20" value={lengthRange.min}
                                        onChange={e => setLengthRange({ ...lengthRange, min: Number(e.target.value) })}
                                        className="w-full bg-gray-900/50 text-white text-xs px-2 py-1 rounded-lg border border-gray-600"
                                    />
                                    <input
                                        type="number" min="2" max="30" value={lengthRange.max}
                                        onChange={e => setLengthRange({ ...lengthRange, max: Number(e.target.value) })}
                                        className="w-full bg-gray-900/50 text-white text-xs px-2 py-1 rounded-lg border border-gray-600"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-400">Bends Range ({bendsRange.min} - {bendsRange.max})</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number" min="0" max="10" value={bendsRange.min}
                                        onChange={e => setBendsRange({ ...bendsRange, min: Number(e.target.value) })}
                                        className="w-full bg-gray-900/50 text-white text-xs px-2 py-1 rounded-lg border border-gray-600"
                                    />
                                    <input
                                        type="number" min="0" max="10" value={bendsRange.max}
                                        onChange={e => setBendsRange({ ...bendsRange, max: Number(e.target.value) })}
                                        className="w-full bg-gray-900/50 text-white text-xs px-2 py-1 rounded-lg border border-gray-600"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Obstacles List */}
                        <div className="bg-gray-700/50 rounded-xl p-4 space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-600 pb-2">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <Ban size={16} /> <span className="translate-y-[1px]">Obstacles</span>
                                </h3>
                                <span className="text-xs font-mono text-purple-300 bg-purple-900/50 px-2 py-0.5 rounded-full">
                                    {obstacles.length} Items
                                </span>
                            </div>

                            {/* Add Obstacle Control */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <CustomSelect
                                        value={selectedObstacleType}
                                        onChange={(val) => setSelectedObstacleType(val as ObstacleType)}
                                        options={[
                                            { value: 'wall', label: 'Wall' },
                                            { value: 'wall_break', label: 'Wall Break' },
                                            { value: 'hole', label: 'Hole' },
                                            { value: 'tunnel', label: 'Tunnel' },
                                            { value: 'iced_snake', label: 'Iced Snake' },
                                            { value: 'key_snake', label: 'Key Snake' },
                                        ]}
                                    />
                                </div>
                                <AnimatedButton
                                    onClick={() => addObstacle(selectedObstacleType)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold text-white transition-colors shadow-lg shadow-purple-900/50"
                                >
                                    Add
                                </AnimatedButton>
                            </div>

                            {/* List Items */}
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                                {obstacles.length === 0 && (
                                    <div className="text-center py-6 border-2 border-dashed border-gray-700 rounded-lg">
                                        <p className="text-xs text-gray-500">No obstacles added yet</p>
                                    </div>
                                )}
                                {obstacles.map((obs) => (
                                    <div key={obs.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700 shadow-sm space-y-3 hover:border-gray-500 transition-colors">
                                        <div className="flex flex-col gap-2 bg-gray-900/50 -mx-3 -mt-3 p-2 px-3 rounded-t-lg border-b border-gray-700">
                                            <div className="flex justify-between items-center w-full">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${obs.type === 'wall' ? 'bg-purple-500' :
                                                        obs.type === 'hole' ? 'bg-blue-500' :
                                                            obs.type === 'tunnel' ? 'bg-pink-500' :
                                                                obs.type === 'iced_snake' ? 'bg-cyan-500' :
                                                                    obs.type === 'key_snake' ? 'bg-yellow-500' : 'bg-gray-400'
                                                        }`} />
                                                    <span className="font-bold text-gray-300 capitalize text-sm">
                                                        {obs.type.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <button onClick={() => removeObstacle(obs.id)} className="text-gray-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-gray-700">
                                                    <X size={14} />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono">
                                                <span>ID: {obs.id}</span>
                                                {(obs.row !== undefined && obs.col !== undefined) && (
                                                    <span>Pos: ({obs.row}, {obs.col})</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Config Inputs based on Type */}
                                        <div className="px-1 space-y-2">

                                            {/* Position for drawable obstacles */}
                                            {(obs.type === 'wall' || obs.type === 'wall_break' || obs.type === 'hole' || obs.type === 'tunnel') && (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs text-gray-400">Position</span>
                                                    <div className="flex gap-1">
                                                        <input
                                                            type="number"
                                                            className="w-12 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white text-center focus:border-purple-500 focus:outline-none"
                                                            value={obs.row ?? 0}
                                                            onChange={(e) => updateObstacle(obs.id, { row: parseInt(e.target.value) || 0 })}
                                                            placeholder="Y"
                                                        />
                                                        <span className="text-gray-500 text-xs self-center">,</span>
                                                        <input
                                                            type="number"
                                                            className="w-12 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white text-center focus:border-purple-500 focus:outline-none"
                                                            value={obs.col ?? 0}
                                                            onChange={(e) => updateObstacle(obs.id, { col: parseInt(e.target.value) || 0 })}
                                                            placeholder="X"
                                                        />
                                                    </div>
                                                </div>
                                            )}


                                            {/* Cell Size for walls */}
                                            {(obs.type === 'wall' || obs.type === 'wall_break') && (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs text-gray-400">Cell Size</span>
                                                    <input
                                                        type="number" className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white text-left focus:border-purple-500 focus:outline-none"
                                                        value={obs.cells?.length || 1}
                                                        readOnly
                                                    />
                                                </div>
                                            )}

                                            {obs.type === 'wall_break' && (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs text-gray-400">Countdown</span>
                                                    <input
                                                        type="number" className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white text-left focus:border-purple-500 focus:outline-none"
                                                        value={obs.wallBreakCounter}
                                                        onChange={(e) => updateObstacle(obs.id, { wallBreakCounter: parseInt(e.target.value) || 0 })}
                                                    />
                                                </div>
                                            )}

                                            {(obs.type === 'hole' || obs.type === 'tunnel') && (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs text-gray-400">Color</span>
                                                    <ColorDropdown
                                                        color={obs.color || ''}
                                                        palette={snakePalette}
                                                        onChange={(c) => updateObstacle(obs.id, { color: c })}
                                                    />
                                                </div>
                                            )}

                                            {obs.type === 'tunnel' && (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs text-gray-400">Direction</span>
                                                    <div className="w-24">
                                                        <CustomSelect
                                                            value={obs.direction || 'right'}
                                                            onChange={(val) => updateObstacle(obs.id, { direction: val })}
                                                            options={[
                                                                { value: 'up', label: '↑ Up' },
                                                                { value: 'down', label: '↓ Down' },
                                                                { value: 'left', label: '← Left' },
                                                                { value: 'right', label: '→ Right' },
                                                            ]}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {obs.type === 'iced_snake' && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs text-gray-400">Snake ID</span>
                                                        <input
                                                            type="number" className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white text-left focus:border-purple-500 focus:outline-none"
                                                            value={obs.snakeId}
                                                            onChange={(e) => updateObstacle(obs.id, { snakeId: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs text-gray-400">Countdown</span>
                                                        <input
                                                            type="number" className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white text-left focus:border-purple-500 focus:outline-none"
                                                            value={obs.countdown || 0}
                                                            onChange={(e) => updateObstacle(obs.id, { countdown: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {obs.type === 'key_snake' && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs text-gray-400">Key ID</span>
                                                        <input
                                                            type="number" className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white text-left focus:border-purple-500 focus:outline-none"
                                                            value={obs.keySnakeId}
                                                            onChange={(e) => updateObstacle(obs.id, { keySnakeId: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs text-gray-400">Lock ID</span>
                                                        <input
                                                            type="number" className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white text-left focus:border-purple-500 focus:outline-none"
                                                            value={obs.lockedSnakeId}
                                                            onChange={(e) => updateObstacle(obs.id, { lockedSnakeId: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activePanel === 'settings' && (
                    <div className="space-y-6">
                        <h2 className="text-lg font-bold text-white mb-4">Global Settings</h2>

                        {/* Grid Size Controls */}
                        <div className="bg-gray-700/50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Grid size={16} /> Grid Size
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Rows</label>
                                    <input
                                        type="number"
                                        value={gridSize.height}
                                        onChange={(e) => setGridSize({ ...gridSize, height: parseInt(e.target.value) || 1 })}
                                        className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                        min="1"
                                        max="100"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Columns</label>
                                    <input
                                        type="number"
                                        value={gridSize.width}
                                        onChange={(e) => setGridSize({ ...gridSize, width: parseInt(e.target.value) || 1 })}
                                        className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                        min="1"
                                        max="100"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Generator Options */}
                        <div className="bg-gray-700/50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Wand2 size={16} /> Generator Options
                            </h3>
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Drawing to Colored Cells</label>
                                <button
                                    onClick={() => setRestrictDrawToColored(!restrictDrawToColored)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${restrictDrawToColored ? 'bg-purple-600' : 'bg-gray-600'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${restrictDrawToColored ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Export Settings */}
                        <div className="bg-gray-700/50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Package size={16} /> Export Config
                            </h3>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-400 pl-1">Level File Prefix</label>
                                <input
                                    type="text"
                                    value={filenamePrefix}
                                    onChange={(e) => setFilenamePrefix(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                    placeholder="e.g. level"
                                />
                                <label className="text-xs font-medium text-gray-400 pl-1 mt-2">Level File Suffix</label>
                                <input
                                    type="text"
                                    value={filenameSuffix}
                                    onChange={(e) => setFilenameSuffix(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                    placeholder="e.g. _v1"
                                />
                                <p className="text-[10px] text-gray-500 pl-1">Output: {filenamePrefix}_ID{filenameSuffix}.json</p>
                            </div>
                        </div>

                        {/* Snake Palette */}
                        <div className="bg-gray-700/50 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <Palette size={16} /> Snake Palette
                                </h3>
                                <button onClick={handleColorAdd} className="p-1 hover:bg-gray-600 rounded text-purple-400">
                                    <Plus size={16} />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {snakePalette.map((color, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="relative h-8 w-8 rounded-lg overflow-hidden border-0 ring-1 ring-white/20 shrink-0">
                                            <input
                                                type="color"
                                                value={color}
                                                onChange={(e) => handleColorChange(idx, e.target.value)}
                                                className="absolute -top-[50%] -left-[50%] h-[200%] w-[200%] p-0 border-0 cursor-pointer"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value={color}
                                            onChange={(e) => handleColorChange(idx, e.target.value)}
                                            className="flex-1 bg-gray-900/50 border border-gray-600/50 rounded px-2 py-1 text-xs text-white font-mono"
                                        />
                                        <button onClick={() => handleColorRemove(idx)} className="text-gray-500 hover:text-red-400">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    )
}
