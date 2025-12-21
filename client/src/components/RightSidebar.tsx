import { ColorDropdown } from './ColorDropdown'
import { Pencil, Eraser, Shapes, Upload, Trash2, Download, Copy, FileJson, Info, ArrowUpRight, Ban, FileUp, ClipboardPaste, Settings } from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import { useNotification } from '../contexts/NotificationContext'
import { useState } from 'react'

interface RightSidebarProps {
    mode: 'editor' | 'generator'
    // Editor Props
    currentTool: 'pen' | 'eraser' | 'shape'
    onToolChange: (tool: 'pen' | 'eraser' | 'shape') => void
    currentShape: 'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'frame'
    onShapeChange: (shape: 'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'frame') => void
    onImageUpload: (file: File) => void
    onClearGrid: () => void
    // Generator Props
    generatedImage: string | null
    levelJson: any | null
    levelId: number
    onLevelIdChange: (id: number) => void
    onCopyJson?: () => void
    onCopyJsonToGenerator?: () => void
    // Generator Tools Props
    generatorTool?: 'arrow' | 'obstacle' | 'eraser' | 'none'
    setGeneratorTool?: (tool: 'arrow' | 'obstacle' | 'eraser' | 'none') => void
    generatorSettings?: { arrowColor: string, obstacleType: string, obstacleColor: string, obstacleCount: number, tunnelDirection: string }
    setGeneratorSettings?: (settings: { arrowColor: string, obstacleType: string, obstacleColor: string, obstacleCount: number, tunnelDirection: string }) => void
    generatorOverlays?: {
        arrows: { id: number, row: number, col: number, direction: string, color: string, path?: { row: number, col: number }[], type?: string, keyId?: number, lockId?: number, snakeId?: number, countdown?: number }[],
        obstacles: { id: number, row: number, col: number, type: string, color?: string, count?: number, cells?: { row: number, col: number }[], direction?: string, snakeId?: number, keySnakeId?: number, lockedSnakeId?: number, countdown?: number }[]
    }
    onClearOverlays?: () => void
    onImportJson?: (json: string) => void
}

export function RightSidebar({
    mode,
    currentTool,
    onToolChange,
    currentShape,
    onShapeChange,
    onImageUpload,
    onClearGrid,
    levelJson,
    levelId,
    onLevelIdChange,
    onCopyJson,
    onCopyJsonToGenerator,
    generatorTool,
    setGeneratorTool,
    generatorSettings,
    setGeneratorSettings,
    generatorOverlays,
    onClearOverlays,
    onImportJson
}: RightSidebarProps) {
    const { filenamePrefix, filenameSuffix, snakePalette, gridSize } = useSettings()
    const { addNotification } = useNotification()
    const [activeTab, setActiveTab] = useState<'tools' | 'actions'>('tools')

    const tools = [
        { id: 'pen' as const, icon: Pencil, label: 'Pen' },
        { id: 'eraser' as const, icon: Eraser, label: 'Eraser' },
        { id: 'shape' as const, icon: Shapes, label: 'Shape' },
    ]

    const shapes = [
        { id: 'rectangle' as const, label: 'Rect' },
        { id: 'circle' as const, label: 'Circle' },
        { id: 'line' as const, label: 'Line' },
        { id: 'triangle' as const, label: 'Tri' },
        { id: 'diamond' as const, label: 'Diamond' },
        { id: 'frame' as const, label: 'Frame' },
    ]

    // Generator Tools
    const generatorTools = [
        { id: 'none' as const, icon: null, label: 'None' },
        { id: 'arrow' as const, icon: ArrowUpRight, label: 'Arrow' },
        { id: 'obstacle' as const, icon: Ban, label: 'Obstacle' },
        { id: 'eraser' as const, icon: Eraser, label: 'Eraser' },
    ]

    const obstacleTypes = [
        { id: 'wall', label: 'Wall' },
        { id: 'wall_break', label: 'Wall Break' },
        { id: 'hole', label: 'Hole' },
        { id: 'tunnel', label: 'Tunnel' },
    ]

    // Convert overlays to server-compatible JSON format
    const convertOverlaysToJson = () => {
        if (!generatorOverlays) return []

        const { arrows, obstacles } = generatorOverlays
        const levelData: any[] = []

        // Collect all positions for bounding box calculation
        const allPositions: { row: number, col: number }[] = []

        // From arrows
        arrows.forEach(arrow => {
            if (arrow.path) {
                allPositions.push(...arrow.path)
            } else {
                allPositions.push({ row: arrow.row, col: arrow.col })
            }
        })

        // From obstacles (skip config-only types)
        obstacles.forEach(obs => {
            if (obs.type === 'iced_snake' || obs.type === 'key_snake') return
            if (obs.cells && obs.cells.length > 0) {
                allPositions.push(...obs.cells)
            } else if (obs.row !== undefined && obs.col !== undefined) {
                allPositions.push({ row: obs.row, col: obs.col })
            }
        })

        if (allPositions.length === 0) return []

        // Calculate center
        // Calculate center based on Grid Size (fixed center) to preserve absolute position
        // Do NOT use bounding box of items, or re-import will shift if items are off-center via rounding.
        const centerR = Math.floor(gridSize.height / 2)
        const centerC = Math.floor(gridSize.width / 2)

        // Helper to convert position
        const toPos = (r: number, c: number) => ({
            x: c - centerC,
            y: centerR - r
        })

        // Convert arrows (snakes) - each snake is one item with position array
        arrows.forEach(arrow => {
            const path = arrow.path || [{ row: arrow.row, col: arrow.col }]
            // Reverse: position[0] should be the arrowhead (last cell of path)
            const reversedPath = [...path].reverse()
            const positions = reversedPath.map(p => toPos(p.row, p.col))

            // Get colorID from palette
            const colorId = snakePalette.indexOf(arrow.color)

            levelData.push({
                itemID: arrow.id,
                itemType: "snake",
                position: positions,
                itemValueConfig: null,
                colorID: colorId >= 0 ? colorId : null
            })
        })

        // Convert obstacles
        obstacles.forEach(obs => {
            if (obs.type === 'iced_snake') {
                // Config-only: Iced Snake
                levelData.push({
                    itemID: obs.id,
                    itemType: "icedSnake",
                    position: null,
                    itemValueConfig: {
                        snakeID: obs.snakeId || 0,
                        count: obs.countdown || 10
                    },
                    colorID: null
                })
            } else if (obs.type === 'key_snake') {
                // Config-only: Key Snake
                levelData.push({
                    itemID: obs.id,
                    itemType: "keySnake",
                    position: null,
                    itemValueConfig: {
                        keyID: obs.keySnakeId || 0,
                        lockID: obs.lockedSnakeId || 0
                    },
                    colorID: null
                })
            } else if (obs.type === 'hole') {
                const colorId = obs.color ? snakePalette.indexOf(obs.color) : -1
                levelData.push({
                    itemID: obs.id,
                    itemType: "hole",
                    position: [toPos(obs.row, obs.col)],
                    itemValueConfig: null,
                    colorID: colorId >= 0 ? colorId : null
                })
            } else if (obs.type === 'tunnel') {
                // Direction mapping
                const directionMap: { [key: string]: { x: number, y: number } } = {
                    'up': { x: 0, y: 1 },
                    'down': { x: 0, y: -1 },
                    'left': { x: -1, y: 0 },
                    'right': { x: 1, y: 0 }
                }
                const direction = directionMap[obs.direction || 'right'] || { x: 1, y: 0 }
                const colorId = obs.color ? snakePalette.indexOf(obs.color) : -1
                levelData.push({
                    itemID: obs.id,
                    itemType: "tunel",
                    position: [toPos(obs.row, obs.col)],
                    itemValueConfig: {
                        directX: direction.x,
                        directY: direction.y
                    },
                    colorID: colorId >= 0 ? colorId : null
                })
            } else if (obs.type === 'wall') {
                // Wall - all cells as one item
                const cells = obs.cells || [{ row: obs.row, col: obs.col }]
                const positions = cells.map(cell => toPos(cell.row, cell.col))
                levelData.push({
                    itemID: obs.id,
                    itemType: "wall",
                    position: positions,
                    itemValueConfig: null,
                    colorID: null
                })
            } else if (obs.type === 'wall_break') {
                // WallBreak - all cells as one item with count
                const cells = obs.cells || [{ row: obs.row, col: obs.col }]
                const positions = cells.map(cell => toPos(cell.row, cell.col))
                levelData.push({
                    itemID: obs.id,
                    itemType: "wallBreak",
                    position: positions,
                    itemValueConfig: {
                        count: obs.count || 3
                    },
                    colorID: null
                })
            }
        })

        return levelData
    }

    const handleExportDrawnJson = () => {
        const json = convertOverlaysToJson()
        navigator.clipboard.writeText(JSON.stringify(json, null, 2))
        addNotification('success', `Copied ${json.length} items to clipboard!`)
    }

    const handleDownloadDrawnJson = () => {
        const json = convertOverlaysToJson()
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${filenamePrefix}${levelId}${filenameSuffix}.json`
        link.click()
        URL.revokeObjectURL(url)
        addNotification('success', `Downloaded ${json.length} items!`)
    }

    if (mode === 'generator') {
        return (
            <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full">
                {/* Top Toggle Bar */}
                <div className="p-4 border-b border-gray-700">
                    <div className="relative flex w-full h-10 bg-gray-900/50 rounded-lg p-1 isolate">
                        {/* Sliding Background */}
                        <div
                            className={`
                                absolute top-1 bottom-1 w-[calc(50%-4px)] bg-purple-600 rounded-md shadow-sm transition-all duration-300 ease-out z-0
                                ${activeTab === 'tools' ? 'left-1' : 'left-[calc(50%+2px)]'}
                            `}
                        />

                        <button
                            onClick={() => setActiveTab('tools')}
                            className={`
                                relative z-10 flex-1 flex items-center justify-center text-xs font-medium transition-colors duration-200
                                ${activeTab === 'tools' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}
                            `}
                        >
                            <Pencil size={14} className="mr-2" />
                            Tools
                        </button>
                        <button
                            onClick={() => setActiveTab('actions')}
                            className={`
                                relative z-10 flex-1 flex items-center justify-center text-xs font-medium transition-colors duration-200
                                ${activeTab === 'actions' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}
                            `}
                        >
                            <Download size={14} className="mr-2" />
                            Files
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">

                    {/* Tools Tab Content */}
                    <div className={activeTab === 'tools' ? 'block animate-in fade-in duration-300' : 'hidden'}>
                        {/* Tool Selection - Matching Editor Tools Layout */}
                        <div className="relative flex gap-2 mb-6 bg-gray-700/50 p-1.5 rounded-xl isolate">
                            {/* Sliding Background */}
                            {generatorTool !== 'none' && (() => {
                                const toolIndex = generatorTool === 'arrow' ? 0 : generatorTool === 'obstacle' ? 1 : 2
                                return (
                                    <div
                                        className="absolute top-1.5 bottom-1.5 bg-purple-600 rounded-lg shadow-lg transition-all duration-300 ease-out z-0"
                                        style={{
                                            width: 'calc((100% - 12px - 16px) / 3)',
                                            left: `calc(6px + ${toolIndex} * ((100% - 12px - 16px) / 3 + 8px))`
                                        }}
                                    />
                                )
                            })()}
                            {generatorTools.filter(t => t.id !== 'none').map(tool => (
                                <button
                                    key={tool.id}
                                    onClick={() => setGeneratorTool?.(generatorTool === tool.id ? 'none' : tool.id)}
                                    className={`
                                        relative z-10 flex-1 flex flex-col items-center justify-center py-3 rounded-lg gap-1.5
                                        transition-colors duration-200
                                        ${generatorTool === tool.id
                                            ? 'text-white'
                                            : 'text-gray-400 hover:text-white'
                                        }
                                    `}
                                >
                                    {tool.icon && <tool.icon size={20} />}
                                    <span className="text-xs font-medium">{tool.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Contextual Settings */}
                        {generatorTool === 'arrow' && generatorSettings && setGeneratorSettings && (
                            <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <ArrowUpRight size={16} /> Arrow Settings
                                </h3>
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400 block mb-1">Arrow Color</label>
                                    <ColorDropdown
                                        color={generatorSettings.arrowColor === 'random' ? snakePalette[0] : generatorSettings.arrowColor}
                                        palette={snakePalette}
                                        onChange={(color) => setGeneratorSettings({ ...generatorSettings, arrowColor: color })}
                                        showRandomOption={true}
                                        onRandomSelect={() => setGeneratorSettings({ ...generatorSettings, arrowColor: 'random' })}
                                        isRandomSelected={generatorSettings.arrowColor === 'random'}
                                    />
                                </div>
                            </div>
                        )}

                        {generatorTool === 'obstacle' && generatorSettings && setGeneratorSettings && generatorOverlays && (
                            <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Ban size={16} /> Obstacle Settings
                                </h3>
                                <div className="space-y-4">
                                    {/* Obstacle Type Dropdown */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400 block mb-1">Obstacle Type</label>
                                        <div className="relative">
                                            <select
                                                value={generatorSettings.obstacleType}
                                                onChange={(e) => {
                                                    const newType = e.target.value
                                                    // Set default color to Color 1 for hole/tunnel
                                                    if (newType === 'hole' || newType === 'tunnel') {
                                                        setGeneratorSettings({ ...generatorSettings, obstacleType: newType, obstacleColor: 'Color 1' })
                                                    } else {
                                                        setGeneratorSettings({ ...generatorSettings, obstacleType: newType })
                                                    }
                                                }}
                                                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-purple-500"
                                            >
                                                {obstacleTypes.map(type => (
                                                    <option key={type.id} value={type.id}>{type.label}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                <ArrowUpRight size={14} className="rotate-45" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Color Selection for Tunnel & Hole */}
                                    {(generatorSettings.obstacleType === 'tunnel' || generatorSettings.obstacleType === 'hole') && (
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-400 block mb-1">
                                                {generatorSettings.obstacleType === 'tunnel' ? 'Tunnel Color' : 'Hole Color'}
                                            </label>
                                            <ColorDropdown
                                                color={generatorSettings.obstacleColor === 'random' ? snakePalette[0] : generatorSettings.obstacleColor}
                                                palette={snakePalette}
                                                onChange={(color) => setGeneratorSettings({ ...generatorSettings, obstacleColor: color })}
                                                showRandomOption={false}
                                                isRandomSelected={false}
                                            />

                                            {/* Direction Dropdown for Tunnel */}
                                            {generatorSettings.obstacleType === 'tunnel' && (
                                                <div className="space-y-1">
                                                    <label className="text-xs text-gray-400 block mb-1">Direction</label>
                                                    <div className="relative">
                                                        <select
                                                            value={generatorSettings.tunnelDirection}
                                                            onChange={(e) => setGeneratorSettings({ ...generatorSettings, tunnelDirection: e.target.value })}
                                                            className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-purple-500"
                                                        >
                                                            <option value="up">↑ Up</option>
                                                            <option value="down">↓ Down</option>
                                                            <option value="left">← Left</option>
                                                            <option value="right">→ Right</option>
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                            <ArrowUpRight size={14} className="rotate-45" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tunnel Pairing Logic Display */}
                                            {generatorSettings.obstacleType === 'tunnel' && (
                                                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 mt-2">
                                                    {(() => {
                                                        const currentTunnelCount = generatorOverlays.obstacles.filter(
                                                            o => o.type === 'tunnel' && o.color === generatorSettings.obstacleColor
                                                        ).length

                                                        const isComplete = currentTunnelCount >= 2 && currentTunnelCount % 2 === 0
                                                        const remainder = currentTunnelCount % 2

                                                        return (
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-medium text-white">
                                                                        {isComplete
                                                                            ? "Pair check: OK"
                                                                            : "Pair check: Incomplete"
                                                                        }
                                                                    </p>
                                                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                                                        {remainder === 0
                                                                            ? "Place first tunnel to start a pair."
                                                                            : "Place one more tunnel to complete the pair."
                                                                        }
                                                                    </p>
                                                                    {currentTunnelCount > 0 && (
                                                                        <p className="text-[10px] text-gray-500 mt-1">
                                                                            Current count: <span className="text-gray-300">{currentTunnelCount}</span>
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Wall Break Countdown Input */}
                                    {generatorSettings.obstacleType === 'wall_break' && (
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-400 block mb-1">Break Countdown</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="9"
                                                value={generatorSettings.obstacleCount || 3}
                                                onChange={(e) => setGeneratorSettings({ ...generatorSettings, obstacleCount: Math.max(1, Math.min(9, Number(e.target.value))) })}
                                                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Clear Overlays Block */}
                        <div className="bg-gray-700/50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Trash2 size={16} /> Actions
                            </h3>
                            <button
                                onClick={onClearOverlays}
                                className="w-full py-2 bg-red-500/10 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Trash2 size={14} /> Clear All
                            </button>
                        </div>
                    </div>

                    {/* Actions Tab Content */}
                    <div className={activeTab === 'actions' ? 'block animate-in fade-in duration-300' : 'hidden'}>
                        <div className="space-y-4">
                            {/* Level Config */}
                            <div className="bg-gray-700/50 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Settings size={16} /> Export Config
                                </h3>
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400">Level ID</label>
                                    <input
                                        type="number"
                                        value={levelId}
                                        onChange={(e) => onLevelIdChange(Number(e.target.value))}
                                        className="w-full bg-gray-900/50 border border-gray-600/50 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                                    />
                                    <p className="text-[10px] text-gray-500">File: <span className="text-gray-400">{filenamePrefix}{levelId}{filenameSuffix}</span></p>
                                </div>
                            </div>

                            {/* Uploads */}
                            <div className="bg-gray-700/50 rounded-xl p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Upload size={16} /> Import
                                </h3>

                                <button
                                    onClick={() => {
                                        const input = document.createElement('input')
                                        input.type = 'file'
                                        input.accept = '.json'
                                        input.onchange = async (e) => {
                                            const file = (e.target as HTMLInputElement).files?.[0]
                                            if (file) {
                                                try {
                                                    const text = await file.text()
                                                    JSON.parse(text) // Validate JSON
                                                    onImportJson?.(text)
                                                    addNotification('success', 'JSON imported from file!')
                                                } catch {
                                                    addNotification('error', 'Invalid JSON file!')
                                                }
                                            }
                                        }
                                        input.click()
                                    }}
                                    className="w-full py-2 bg-blue-500/10 text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <FileUp size={14} /> Import from File
                                </button>

                                <button
                                    onClick={async () => {
                                        try {
                                            const text = await navigator.clipboard.readText()
                                            JSON.parse(text) // Validate JSON
                                            onImportJson?.(text)
                                            addNotification('success', 'JSON imported from clipboard!')
                                        } catch {
                                            addNotification('error', 'Invalid JSON in clipboard!')
                                        }
                                    }}
                                    className="w-full py-2 bg-green-500/10 text-green-400 border border-green-500/50 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <ClipboardPaste size={14} /> Import from Clipboard
                                </button>
                            </div>

                            {/* Export */}
                            <div className="bg-gray-700/50 rounded-xl p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <FileJson size={16} /> Export
                                </h3>
                                <p className="text-[10px] text-gray-500 -mt-2 mb-2">
                                    Export arrows and obstacles drawn on grid
                                </p>

                                <button
                                    onClick={handleDownloadDrawnJson}
                                    disabled={!generatorOverlays || (generatorOverlays.arrows.length === 0 && generatorOverlays.obstacles.length === 0)}
                                    className={`w-full py-2 bg-purple-500/10 text-purple-400 border border-purple-500/50 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2 ${(!generatorOverlays || (generatorOverlays.arrows.length === 0 && generatorOverlays.obstacles.length === 0))
                                        ? 'opacity-50 cursor-not-allowed'
                                        : ''
                                        }`}
                                >
                                    <Download size={14} /> Download JSON
                                </button>

                                <button
                                    onClick={handleExportDrawnJson}
                                    disabled={!generatorOverlays || (generatorOverlays.arrows.length === 0 && generatorOverlays.obstacles.length === 0)}
                                    className={`w-full py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2 ${(!generatorOverlays || (generatorOverlays.arrows.length === 0 && generatorOverlays.obstacles.length === 0))
                                        ? 'opacity-50 cursor-not-allowed'
                                        : ''
                                        }`}
                                >
                                    <Copy size={14} /> Copy JSON
                                </button>

                                {generatorOverlays && (
                                    <p className="text-[10px] text-gray-400 text-center">
                                        {generatorOverlays.arrows.length} arrows, {generatorOverlays.obstacles.length} obstacles
                                    </p>
                                )}
                            </div>


                            {/* Debug Info */}
                            {levelJson && (
                                <div className="bg-gray-700/50 rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                        <Info size={16} /> Debug Info
                                    </h3>
                                    <div className="text-xs text-gray-400 space-y-1">
                                        <p>Objects: <span className="text-white">{levelJson.length}</span></p>
                                        <p>Generated At: <span className="text-white">{new Date().toLocaleTimeString()}</span></p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        )
    }

    // Default Editor Mode
    return (
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full">
            {/* Top Toggle Bar - Single 'Tools' Tab */}
            <div className="p-4 border-b border-gray-700">
                <div className="relative flex w-full h-10 bg-gray-900/50 rounded-lg p-1 isolate">
                    {/* Background - Full Width for single item */}
                    <div className="absolute top-1 bottom-1 left-1 right-1 bg-purple-600 rounded-md shadow-sm z-0" />

                    <button
                        className="relative z-10 flex-1 flex items-center justify-center text-xs font-medium text-white transition-colors duration-200"
                    >
                        <Pencil size={14} className="mr-2" />
                        Tools
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">

                {/* Tools Content */}
                <div> {/* Wrapper to match structure roughly, though not strictly needed for animation if always visible */}

                    {/* Tool Selection */}
                    <div className="relative flex gap-2 mb-6 bg-gray-700/50 p-1.5 rounded-xl isolate">
                        {/* Sliding Background */}
                        {(() => {
                            const toolIndex = currentTool === 'pen' ? 0 : currentTool === 'eraser' ? 1 : 2
                            return (
                                <div
                                    className="absolute top-1.5 bottom-1.5 bg-purple-600 rounded-lg shadow-lg transition-all duration-300 ease-out z-0"
                                    style={{
                                        width: 'calc((100% - 12px - 16px) / 3)',
                                        left: `calc(6px + ${toolIndex} * ((100% - 12px - 16px) / 3 + 8px))`
                                    }}
                                />
                            )
                        })()}
                        {tools.map(tool => {
                            const Icon = tool.icon
                            const isActive = currentTool === tool.id
                            return (
                                <button
                                    key={tool.id}
                                    onClick={() => onToolChange(tool.id)}
                                    className={`
                                        relative z-10 flex-1 flex flex-col items-center justify-center py-3 rounded-lg gap-1.5
                                        transition-colors duration-200
                                        ${isActive
                                            ? 'text-white'
                                            : 'text-gray-400 hover:text-white'
                                        }
                                    `}
                                >
                                    <Icon size={20} />
                                    <span className="text-xs font-medium">{tool.label}</span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Shape Selector - Show when Shape tool is active */}
                    {currentTool === 'shape' && (
                        <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Shapes size={16} /> Select Shape
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {shapes.map(shape => (
                                    <button
                                        key={shape.id}
                                        onClick={() => onShapeChange(shape.id)}
                                        className={`
                                            p-2 rounded-lg text-xs font-medium transition-all
                                            ${currentShape === shape.id
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                            }
                                        `}
                                    >
                                        {shape.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Parameters Section */}
                    <div className="space-y-6">

                        {/* Image Import */}
                        <div className="bg-gray-700/50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Upload size={16} /> Import Mask
                            </h3>
                            <div className="relative group">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) onImageUpload(file)
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="w-full border-2 border-dashed border-gray-600 rounded-lg p-4 text-center text-gray-400 group-hover:border-purple-500 group-hover:text-purple-400 transition-colors">
                                    <span className="text-xs">Click or Drop Image</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="bg-gray-700/50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Trash2 size={16} /> Actions
                            </h3>
                            <div className="space-y-2">
                                <button
                                    onClick={onClearGrid}
                                    className="w-full py-2 bg-red-500/10 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={14} /> Clear Grid
                                </button>
                                <button
                                    onClick={onCopyJson}
                                    className="w-full py-2 bg-blue-500/10 text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <Copy size={14} /> Copy JSON
                                </button>
                                <button
                                    onClick={onCopyJsonToGenerator}
                                    className="w-full py-2 bg-purple-500/10 text-purple-400 border border-purple-500/50 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <FileJson size={14} /> Copy to Generator
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
