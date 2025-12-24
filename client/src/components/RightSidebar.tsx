import { CustomSelect } from './CustomSelect'
import { ColorSelect } from './ColorSelect'
import { Pencil, Eraser, Shapes, Upload, Trash2, Download, Copy, FileJson, Info, ArrowUpRight, Ban, FileUp, ClipboardPaste, Settings, Play, Calculator, Puzzle } from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import { useNotification } from '../contexts/NotificationContext'
import { AnimatedButton } from './AnimatedButton'
import { motion } from 'framer-motion'
import { useLanguage } from '../i18n'
import { useState, useEffect } from 'react'
import { apiRequest } from '../utils/api'

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
    onSimulate?: () => void
    onFillGaps?: () => Promise<void>
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
    onImportJson,
    onSimulate,
    onFillGaps
}: RightSidebarProps) {
    const { filenamePrefix, filenameSuffix, snakePalette, gridSize } = useSettings()
    const { addNotification } = useNotification()
    const { t } = useLanguage()
    const [activeTab, setActiveTab] = useState<'tools' | 'files'>('tools')
    const [difficultyData, setDifficultyData] = useState<any>(null)
    const [isCalculating, setIsCalculating] = useState(false)
    const [isFillGapsLoading, setIsFillGapsLoading] = useState(false)

    // Clear difficulty data when grid changes
    useEffect(() => {
        setDifficultyData(null)
    }, [generatorOverlays])

    const handleCalculateDifficulty = async () => {
        if (!generatorOverlays) return

        setIsCalculating(true)
        try {
            const payload = {
                rows: gridSize.height,
                cols: gridSize.width,
                snakes: generatorOverlays.arrows.map(a => ({
                    path: a.path || [{ row: a.row, col: a.col }]
                })),
                obstacles: generatorOverlays.obstacles
            }

            const res = await apiRequest('/calculate-difficulty', {
                method: 'POST',
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to calculate')
            }

            const data = await res.json()
            setDifficultyData(data)
            addNotification('success', 'Difficulty calculated!')
        } catch (e: any) {
            console.error(e)
            addNotification('error', 'Calculation failed: ' + e.message)
        } finally {
            setIsCalculating(false)
        }
    }

    const tools = [
        { id: 'pen' as const, icon: Pencil, label: t('pen') },
        { id: 'eraser' as const, icon: Eraser, label: t('eraser') },
        { id: 'shape' as const, icon: Shapes, label: t('shape') },
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
        { id: 'none' as const, icon: null, label: t('none') },
        { id: 'arrow' as const, icon: ArrowUpRight, label: t('arrow') },
        { id: 'obstacle' as const, icon: Ban, label: t('obstacles') },
        { id: 'eraser' as const, icon: Eraser, label: t('eraser') },
    ]

    const obstacleTypes = [
        { id: 'wall', label: t('wall') },
        { id: 'wall_break', label: t('wallBreak') },
        { id: 'hole', label: t('hole') },
        { id: 'tunnel', label: t('tunnel') },
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

        // Counter for sequential itemID export
        let exportItemID = 0

        // Convert arrows (snakes) - each snake is one item with position array
        arrows.forEach(arrow => {
            const path = arrow.path || [{ row: arrow.row, col: arrow.col }]
            // Reverse: position[0] should be the arrowhead (last cell of path)
            const reversedPath = [...path].reverse()
            const positions = reversedPath.map(p => toPos(p.row, p.col))

            // Get colorID from palette
            const colorId = snakePalette.indexOf(arrow.color)

            levelData.push({
                itemID: exportItemID++,
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
                    itemID: exportItemID++,
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
                    itemID: exportItemID++,
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
                    itemID: exportItemID++,
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
                    itemID: exportItemID++,
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
                    itemID: exportItemID++,
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
                    itemID: exportItemID++,
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
                        <button
                            onClick={() => setActiveTab('tools')}
                            className={`
                                relative z-10 flex-1 flex items-center justify-center text-xs font-medium transition-colors duration-200
                                ${activeTab === 'tools' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}
                            `}
                        >
                            {activeTab === 'tools' && (
                                <motion.div
                                    layoutId="rs-tab"
                                    className="absolute inset-[3px] bg-purple-600 rounded-md shadow-sm -z-10"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <Pencil size={14} className="mr-2" />
                            <span className="translate-y-[1px]">{t('tools')}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('files')}
                            className={`
                                relative z-10 flex-1 flex items-center justify-center text-xs font-medium transition-colors duration-200
                                ${activeTab === 'files' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}
                            `}
                        >
                            {activeTab === 'files' && (
                                <motion.div
                                    layoutId="rs-tab"
                                    className="absolute inset-[3px] bg-purple-600 rounded-md shadow-sm -z-10"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <Download size={14} className="mr-2" />
                            <span className="translate-y-[1px]">{t('files')}</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">

                    {/* Tools Tab Content */}
                    <div className={activeTab === 'tools' ? 'block animate-in fade-in duration-300' : 'hidden'}>
                        {/* Tool Selection - Matching Editor Tools Layout */}
                        <div className="relative flex gap-2 mb-6 bg-gray-700/50 p-1.5 rounded-xl isolate">
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
                                    {generatorTool === tool.id && (
                                        <motion.div
                                            layoutId="rs-tool-gen"
                                            className="absolute inset-0 bg-purple-600 rounded-lg shadow-lg -z-10"
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        />
                                    )}
                                    {tool.icon && <tool.icon size={20} />}
                                    <span className="text-xs font-medium">{tool.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Contextual Settings */}
                        {generatorTool === 'arrow' && generatorSettings && setGeneratorSettings && (
                            <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <ArrowUpRight size={16} /> <span className="translate-y-[1px]">{t('arrow')} {t('settings')}</span>
                                </h3>
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400 block mb-1">{t('arrowColor')}</label>
                                    <ColorSelect
                                        value={generatorSettings.arrowColor}
                                        palette={snakePalette}
                                        onChange={(color) => setGeneratorSettings({ ...generatorSettings, arrowColor: color })}
                                        showRandomOption={true}
                                        isRandomSelected={generatorSettings.arrowColor === 'random'}
                                    />
                                </div>
                            </div>
                        )}

                        {generatorTool === 'obstacle' && generatorSettings && setGeneratorSettings && generatorOverlays && (
                            <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Ban size={16} /> <span className="translate-y-[1px]">{t('obstacles')} {t('settings')}</span>
                                </h3>
                                <div className="space-y-4">
                                    {/* Obstacle Type Dropdown */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400 block mb-1">{t('obstacleType')}</label>
                                        <CustomSelect
                                            value={generatorSettings.obstacleType}
                                            options={obstacleTypes.map(t => ({ value: t.id, label: t.label }))}
                                            onChange={(val) => {
                                                const newType = val
                                                if (newType === 'hole' || newType === 'tunnel') {
                                                    setGeneratorSettings({ ...generatorSettings, obstacleType: newType as any, obstacleColor: 'Color 1' })
                                                } else {
                                                    setGeneratorSettings({ ...generatorSettings, obstacleType: newType as any })
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Color Selection for Tunnel & Hole */}
                                    {(generatorSettings.obstacleType === 'tunnel' || generatorSettings.obstacleType === 'hole') && (
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-400 block mb-1">
                                                {generatorSettings.obstacleType === 'tunnel' ? t('tunnelColor') : t('holeColor')}
                                            </label>
                                            <ColorSelect
                                                value={generatorSettings.obstacleColor}
                                                palette={snakePalette}
                                                onChange={(color) => setGeneratorSettings({ ...generatorSettings, obstacleColor: color })}
                                                showRandomOption={false}
                                                isRandomSelected={false}
                                            />
                                        </div>
                                    )}

                                    {/* Direction Dropdown for Tunnel */}
                                    {generatorSettings.obstacleType === 'tunnel' && (
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-400 block mb-1">{t('direction')}</label>
                                            <CustomSelect
                                                value={generatorSettings.tunnelDirection}
                                                options={[
                                                    { value: 'up', label: t('upArrow') },
                                                    { value: 'down', label: t('downArrow') },
                                                    { value: 'left', label: t('leftArrow') },
                                                    { value: 'right', label: t('rightArrow') },
                                                ]}
                                                onChange={(val) => setGeneratorSettings({ ...generatorSettings, tunnelDirection: val })}
                                            />
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
                                                                    ? t('pairCheckOK')
                                                                    : t('pairCheckIncomplete')
                                                                }
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                                {remainder === 0
                                                                    ? t('placeFirstTunnel')
                                                                    : t('placeOneMoreTunnel')
                                                                }
                                                            </p>
                                                            {currentTunnelCount > 0 && (
                                                                <p className="text-[10px] text-gray-500 mt-1">
                                                                    {t('currentCount')}: <span className="text-gray-300">{currentTunnelCount}</span>
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    )}

                                    {/* Wall Break Countdown Input */}
                                    {generatorSettings.obstacleType === 'wall_break' && (
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-400 block mb-1">{t('breakCountdown')}</label>
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
                                <Trash2 size={16} /> <span className="translate-y-[1px]">{t('actions')}</span>
                            </h3>
                            <AnimatedButton
                                onClick={onClearOverlays}
                                className="w-full py-2 bg-red-500/10 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Trash2 size={14} /> <span className="translate-y-[1px]">{t('clearOverlays')}</span>
                            </AnimatedButton>
                            <AnimatedButton
                                onClick={onSimulate}
                                className="w-full mt-2 py-2 bg-green-500/10 text-green-400 border border-green-500/50 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Play size={14} /> <span className="translate-y-[1px]">{t('simulate')}</span>
                            </AnimatedButton>
                            <AnimatedButton
                                onClick={async () => {
                                    if (isFillGapsLoading || !onFillGaps) return
                                    setIsFillGapsLoading(true)
                                    try {
                                        await onFillGaps()
                                    } finally {
                                        setIsFillGapsLoading(false)
                                    }
                                }}
                                disabled={isFillGapsLoading}
                                className={`w-full mt-2 py-2 bg-teal-500/10 text-teal-400 border border-teal-500/50 rounded-lg hover:bg-teal-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2 ${isFillGapsLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isFillGapsLoading ? (
                                    <span className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Puzzle size={14} />
                                )}
                                <span className="translate-y-[1px]">{t('fillGaps')}</span>
                            </AnimatedButton>
                        </div>

                        {/* Difficulty Analysis */}
                        <div className="bg-gray-700/50 rounded-xl p-4 space-y-3 mt-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Calculator size={16} /> <span className="translate-y-[1px]">{t('difficultyAnalysis')}</span>
                            </h3>

                            <AnimatedButton
                                onClick={handleCalculateDifficulty}
                                disabled={!generatorOverlays || isCalculating}
                                className={`w-full py-2 bg-orange-500/10 text-orange-400 border border-orange-500/50 rounded-lg hover:bg-orange-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2 leading-none ${(!generatorOverlays || isCalculating) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isCalculating ? (
                                    <span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Calculator size={14} />
                                )}
                                {t('calculateScore')}
                            </AnimatedButton>

                            {difficultyData && (
                                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex justify-between items-end border-b border-gray-700 pb-2">
                                        <span className="text-xs text-gray-400">{t('totalDifficulty')}</span>
                                        <span className="text-xl font-bold text-orange-400">{difficultyData.difficulty_score}</span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                                        <div className="bg-gray-900/40 rounded p-1">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{t('snake')}</div>
                                            <div className="text-sm font-semibold text-blue-400">{difficultyData.breakdown.S}</div>
                                        </div>
                                        <div className="bg-gray-900/40 rounded p-1">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{t('free')}</div>
                                            <div className="text-sm font-semibold text-green-400">{difficultyData.breakdown.F}</div>
                                        </div>
                                        <div className="bg-gray-900/40 rounded p-1">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{t('obs')}</div>
                                            <div className="text-sm font-semibold text-red-400">{difficultyData.breakdown.O}</div>
                                        </div>
                                    </div>

                                    {/* Extra details from new calculator */}
                                    {difficultyData.details && (
                                        <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gray-700/50 text-center">
                                            <div>
                                                <div className="text-[9px] text-gray-600">Grid</div>
                                                <div className="text-[10px] text-gray-400">{difficultyData.details.grid_bounds}</div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] text-gray-600">Depth</div>
                                                <div className="text-[10px] text-gray-400">{difficultyData.details.solve_depth}</div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] text-gray-600">Cells</div>
                                                <div className="text-[10px] text-gray-400">{difficultyData.details.occupied_cells}</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-[10px] text-gray-500 italic text-center mt-1">
                                        {t('scoreFormula')}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Files Tab Content */}
                    <div className={activeTab === 'files' ? 'block animate-in fade-in duration-300' : 'hidden'}>
                        <div className="space-y-4">
                            {/* Level Config */}
                            <div className="bg-gray-700/50 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Settings size={16} /> <span className="translate-y-[1px]">{t('exportConfig')}</span>
                                </h3>
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400">{t('levelIdLabel')}</label>
                                    <input
                                        type="number"
                                        value={levelId}
                                        onChange={(e) => onLevelIdChange(Number(e.target.value))}
                                        className="w-full bg-gray-900/50 border border-gray-600/50 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                                    />
                                    <p className="text-[10px] text-gray-500">{t('file')}: <span className="text-gray-400">{filenamePrefix}{levelId}{filenameSuffix}</span></p>
                                </div>
                            </div>

                            {/* Uploads */}
                            <div className="bg-gray-700/50 rounded-xl p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Upload size={16} /> <span className="translate-y-[1px]">{t('import')}</span>
                                </h3>

                                <AnimatedButton
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
                                                    addNotification('success', t('jsonImportedFile'))
                                                } catch {
                                                    addNotification('error', t('invalidJsonFile'))
                                                }
                                            }
                                        }
                                        input.click()
                                    }}
                                    className="w-full py-2 bg-blue-500/10 text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2 leading-none"
                                >
                                    <FileUp size={14} /> {t('importFromFile')}
                                </AnimatedButton>

                                <AnimatedButton
                                    onClick={async () => {
                                        try {
                                            const text = await navigator.clipboard.readText()
                                            JSON.parse(text) // Validate JSON
                                            onImportJson?.(text)
                                            addNotification('success', t('jsonImportedClipboard'))
                                        } catch {
                                            addNotification('error', t('invalidJsonClipboard'))
                                        }
                                    }}
                                    className="w-full py-2 bg-green-500/10 text-green-400 border border-green-500/50 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2 leading-none"
                                >
                                    <ClipboardPaste size={14} /> {t('importFromClipboard')}
                                </AnimatedButton>
                            </div>

                            {/* Export */}
                            <div className="bg-gray-700/50 rounded-xl p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <FileJson size={16} /> <span className="translate-y-[1px]">{t('export')}</span>
                                </h3>
                                <p className="text-[10px] text-gray-500 -mt-2 mb-2">
                                    {t('exportDescription')}
                                </p>

                                <AnimatedButton
                                    onClick={handleDownloadDrawnJson}
                                    disabled={!generatorOverlays || (generatorOverlays.arrows.length === 0 && generatorOverlays.obstacles.length === 0)}
                                    className={`w-full py-2 bg-purple-500/10 text-purple-400 border border-purple-500/50 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2 leading-none ${(!generatorOverlays || (generatorOverlays.arrows.length === 0 && generatorOverlays.obstacles.length === 0))
                                        ? 'opacity-50 cursor-not-allowed'
                                        : ''
                                        }`}
                                >
                                    <Download size={14} /> {t('downloadJson')}
                                </AnimatedButton>

                                <AnimatedButton
                                    onClick={handleExportDrawnJson}
                                    disabled={!generatorOverlays || (generatorOverlays.arrows.length === 0 && generatorOverlays.obstacles.length === 0)}
                                    className={`w-full py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2 leading-none ${(!generatorOverlays || (generatorOverlays.arrows.length === 0 && generatorOverlays.obstacles.length === 0))
                                        ? 'opacity-50 cursor-not-allowed'
                                        : ''
                                        }`}
                                >
                                    <Copy size={14} /> {t('copyJson')}
                                </AnimatedButton>

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
                                        <Info size={16} /> <span className="translate-y-[1px]">{t('debugInfo')}</span>
                                    </h3>
                                    <div className="text-xs text-gray-400 space-y-1">
                                        <p>{t('objects')}: <span className="text-white">{levelJson.length}</span></p>
                                        <p>{t('generatedAt')}: <span className="text-white">{new Date().toLocaleTimeString()}</span></p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div >
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
                        <span className="translate-y-[1px]">{t('tools')}</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">

                {/* Tools Content */}
                <div> {/* Wrapper to match structure roughly, though not strictly needed for animation if always visible */}

                    {/* Tool Selection */}
                    <div className="relative flex gap-2 mb-6 bg-gray-700/50 p-1.5 rounded-xl isolate">
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
                                    {isActive && (
                                        <motion.div
                                            layoutId="rs-tool-editor"
                                            className="absolute inset-0 bg-purple-600 rounded-lg shadow-lg -z-10"
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        />
                                    )}
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
                                <Shapes size={16} /> <span className="translate-y-[1px]">{t('selectShape')}</span>
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
                                <Upload size={16} /> <span className="translate-y-[1px]">{t('importMask')}</span>
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
                                    <span className="text-xs">{t('clickOrDropImage')}</span>
                                </div>
                            </div>
                            {/* Import from Clipboard button */}
                            <button
                                onClick={async () => {
                                    try {
                                        const clipboardItems = await navigator.clipboard.read()
                                        for (const item of clipboardItems) {
                                            const imageType = item.types.find(type => type.startsWith('image/'))
                                            if (imageType) {
                                                const blob = await item.getType(imageType)
                                                const file = new File([blob], 'clipboard-image.png', { type: imageType })
                                                onImageUpload(file)
                                                return
                                            }
                                        }
                                        alert('No image found in clipboard')
                                    } catch (err) {
                                        console.error('Clipboard read failed:', err)
                                        alert('Failed to read clipboard. Make sure you have copied an image.')
                                    }
                                }}
                                className="w-full mt-2 py-2 bg-gray-600/50 text-gray-300 border border-gray-500/50 rounded-lg hover:bg-purple-500/20 hover:border-purple-500/50 hover:text-purple-400 transition-colors text-xs font-medium flex items-center justify-center gap-2"
                            >
                                <ClipboardPaste size={14} /> {t('importFromClipboard') || 'Paste from Clipboard'}
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="bg-gray-700/50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Trash2 size={16} /> <span>{t('actions')}</span>
                            </h3>
                            <div className="space-y-2">
                                <AnimatedButton
                                    onClick={onClearGrid}
                                    className="w-full py-2 bg-red-500/10 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={14} /> {t('clearGrid')}
                                </AnimatedButton>
                                <AnimatedButton
                                    onClick={onCopyJson}
                                    className="w-full py-2 bg-blue-500/10 text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <Copy size={14} /> {t('copyJson')}
                                </AnimatedButton>
                                <AnimatedButton
                                    onClick={onCopyJsonToGenerator}
                                    className="w-full py-2 bg-purple-500/10 text-purple-400 border border-purple-500/50 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <FileJson size={14} /> {t('toGenerator')}
                                </AnimatedButton>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
