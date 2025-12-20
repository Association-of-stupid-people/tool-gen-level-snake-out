import { Grid, Wand2, Settings, Plus, X, ChevronDown, FileJson, Sliders, Package, Ban, Palette } from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
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
        <div className="relative w-24">
            <button
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white flex items-center justify-between hover:border-gray-500 transition-colors"
                style={{ borderLeft: `8px solid ${color}` }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">Color {index !== -1 ? index + 1 : '?'}</span>
                <ChevronDown size={12} className="text-gray-400" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 w-48 bg-gray-800 border border-gray-600 rounded mt-1 z-20 shadow-xl max-h-48 overflow-y-auto">
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
                    </div>
                </>
            )}
        </div>
    )
}

export function LeftSidebar({ activePanel, onPanelChange, onGenerate, isGenerating, jsonInput = '', setJsonInput = () => { }, onObstacleTypeUsed, onObstacleUpdate, onObstacleDelete, nextItemId, setNextItemId, onDataUpdate, onObstacleAdd }: LeftSidebarProps) {
    const {
        gridSize, setGridSize,
        backgroundColor, setBackgroundColor,
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

    const { addNotification } = useNotification()

    const handleGenerateClick = () => {
        if (onGenerate) {
            if (jsonInput.trim()) {
                try {
                    const parsed = JSON.parse(jsonInput)
                    if (Array.isArray(parsed)) {
                        // Logic handled in App.tsx mainly
                    }
                    onGenerate({
                        arrowCount,
                        minLen: lengthRange.min,
                        maxLen: lengthRange.max,
                        minBends: bendsRange.min,
                        maxBends: bendsRange.max,
                        obstacles,
                        palette: snakePalette,
                        customInput: jsonInput
                    })
                    return;
                } catch (e) {
                    addNotification('error', 'Invalid JSON Input')
                    return
                }
            }

            onGenerate({
                arrowCount,
                minLen: lengthRange.min,
                maxLen: lengthRange.max,
                minBends: bendsRange.min,
                maxBends: bendsRange.max,
                obstacles,
                palette: snakePalette
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
                flex-1 flex flex-col items-center justify-center p-2 rounded-lg gap-1 transition-all
                ${isActive
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white'
                                }
              `}
                        >
                            <Icon size={20} />
                            <span className="text-xs font-medium">{panel.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {activePanel === 'panel1' && (
                    <div className="text-center text-gray-500 mt-4">
                        <p className="text-sm">Select tools from the right sidebar to draw on the grid.</p>
                    </div>
                )}

                {activePanel === 'panel2' && (
                    <div className="space-y-6">
                        <button
                            onClick={handleGenerateClick}
                            disabled={isGenerating}
                            className={`w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-bold shadow-lg 
                            ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-purple-900/50 transform hover:scale-[1.02] transition-all'} flex items-center justify-center gap-2`}
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
                        </button>

                        {/* JSON Input */}
                        <div className="bg-gray-700/50 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-white border-b border-gray-600 pb-2 flex items-center gap-2">
                                <FileJson size={16} /> JSON Input
                            </h3>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder='Paste grid JSON...'
                                    className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="bg-gray-700/50 rounded-xl p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-white border-b border-gray-600 pb-2 flex items-center gap-2">
                                <Settings size={16} /> Basic Settings
                            </h3>

                            <div className="flex items-center justify-between gap-4">
                                <label className="text-xs text-gray-400 whitespace-nowrap">Arrow Count</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="2000"
                                    value={arrowCount}
                                    onChange={e => setArrowCount(Math.max(1, parseInt(e.target.value) || 0))}
                                    className="w-32 bg-gray-900/50 border border-gray-600/50 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-all font-mono text-left"
                                />
                            </div>
                        </div>

                        <div className="bg-gray-700/50 rounded-xl p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-white border-b border-gray-600 pb-2 flex items-center gap-2">
                                <Sliders size={16} /> Complexity
                            </h3>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-400">Length Range ({lengthRange.min} - {lengthRange.max})</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number" min="2" max="20" value={lengthRange.min}
                                        onChange={e => setLengthRange({ ...lengthRange, min: Number(e.target.value) })}
                                        className="w-full bg-gray-900/50 text-white text-xs px-2 py-1 rounded border border-gray-600"
                                    />
                                    <input
                                        type="number" min="2" max="30" value={lengthRange.max}
                                        onChange={e => setLengthRange({ ...lengthRange, max: Number(e.target.value) })}
                                        className="w-full bg-gray-900/50 text-white text-xs px-2 py-1 rounded border border-gray-600"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-400">Bends Range ({bendsRange.min} - {bendsRange.max})</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number" min="0" max="10" value={bendsRange.min}
                                        onChange={e => setBendsRange({ ...bendsRange, min: Number(e.target.value) })}
                                        className="w-full bg-gray-900/50 text-white text-xs px-2 py-1 rounded border border-gray-600"
                                    />
                                    <input
                                        type="number" min="0" max="10" value={bendsRange.max}
                                        onChange={e => setBendsRange({ ...bendsRange, max: Number(e.target.value) })}
                                        className="w-full bg-gray-900/50 text-white text-xs px-2 py-1 rounded border border-gray-600"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Obstacles List */}
                        <div className="bg-gray-700/50 rounded-xl p-4 space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-600 pb-2">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <Ban size={16} /> Obstacles
                                </h3>
                                <span className="text-xs font-mono text-purple-300 bg-purple-900/50 px-2 py-0.5 rounded-full">
                                    {obstacles.length} Items
                                </span>
                            </div>

                            {/* Add Obstacle Control */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <select
                                        value={selectedObstacleType}
                                        onChange={(e) => setSelectedObstacleType(e.target.value as ObstacleType)}
                                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white appearance-none focus:outline-none focus:border-purple-400 cursor-pointer"
                                    >
                                        <option value="wall">Wall</option>
                                        <option value="wall_break">Wall Break</option>
                                        <option value="hole">Hole</option>
                                        <option value="tunnel">Tunnel</option>
                                        <option value="iced_snake">Iced Snake</option>
                                        <option value="key_snake">Key Snake</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                                <button
                                    onClick={() => addObstacle(selectedObstacleType)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold text-white transition-colors shadow-lg shadow-purple-900/50"
                                >
                                    Add
                                </button>
                            </div>

                            {/* List Items */}
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                                {obstacles.length === 0 && (
                                    <div className="text-center py-6 border-2 border-dashed border-gray-700 rounded-lg">
                                        <p className="text-xs text-gray-500">No obstacles added yet</p>
                                    </div>
                                )}
                                {obstacles.map((obs, index) => (
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
                                                    <select
                                                        value={obs.direction || 'right'}
                                                        onChange={(e) => updateObstacle(obs.id, { direction: e.target.value })}
                                                        className="w-26 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                                                    >
                                                        <option value="up">↑ Up</option>
                                                        <option value="down">↓ Down</option>
                                                        <option value="left">← Left</option>
                                                        <option value="right">→ Right</option>
                                                    </select>
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
