import { useState, useRef, useEffect } from 'react'
import { Trash2, RotateCcw, Palette, Hash, ArrowUpDown, ChevronDown } from 'lucide-react'

// Reusable ColorDropdown Component
function ColorDropdown({
    color,
    palette,
    onChange,
    label = 'Color'
}: {
    color: string
    palette: string[]
    onChange: (color: string) => void
    label?: string
}) {
    const [isOpen, setIsOpen] = useState(false)
    const index = palette.indexOf(color)

    return (
        <div className="relative">
            <button
                className="w-32 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white flex items-center justify-between hover:border-gray-500 transition-colors"
                style={{ borderLeft: `8px solid ${color}` }}
                onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(!isOpen)
                }}
            >
                <span className="truncate">{label} {index !== -1 ? index + 1 : '?'}</span>
                <ChevronDown size={12} className="text-gray-400" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 w-48 bg-gray-800 border border-gray-600 rounded mb-1 z-50 shadow-xl max-h-48 overflow-y-auto">
                        {palette.map((c, i) => (
                            <button
                                key={i}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-left transition-colors border-b border-gray-700/50 last:border-0"
                                onClick={(e) => {
                                    e.stopPropagation()
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

// Direction options for tunnels
const DIRECTION_OPTIONS = [
    { value: 'up', label: '↑ Up' },
    { value: 'down', label: '↓ Down' },
    { value: 'left', label: '← Left' },
    { value: 'right', label: '→ Right' }
]

// Reusable DirectionDropdown Component (matches ColorDropdown style)
function DirectionDropdown({
    direction,
    onChange
}: {
    direction: string
    onChange: (direction: string) => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const currentOption = DIRECTION_OPTIONS.find(d => d.value === direction) || DIRECTION_OPTIONS[3]

    return (
        <div className="relative">
            <button
                className="w-32 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white flex items-center justify-between hover:border-gray-500 transition-colors"
                onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(!isOpen)
                }}
            >
                <span className="truncate">{currentOption.label}</span>
                <ChevronDown size={12} className="text-gray-400" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 w-32 bg-gray-800 border border-gray-600 rounded mb-1 z-50 shadow-xl">
                        {DIRECTION_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-left transition-colors border-b border-gray-700/50 last:border-0 ${opt.value === direction ? 'bg-gray-700/50' : ''
                                    }`}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onChange(opt.value)
                                    setIsOpen(false)
                                }}
                            >
                                <span className="text-xs text-gray-200">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

interface ContextMenuData {
    x: number
    y: number
    type: 'arrow' | 'obstacle' | 'bulk'
    data: any
    index: number
}

interface GeneratorContextMenuProps {
    contextMenu: ContextMenuData | null
    onClose: () => void
    // Arrow actions
    onDeleteArrow: (id: number) => void
    onReverseArrow: (id: number, arrow: any) => void
    onRecolorArrow: (id: number, color: string) => void
    // Obstacle actions
    onDeleteObstacle: (id: number) => void
    onUpdateObstacle: (id: number, updates: any) => void
    // Bulk actions
    onFlipSelected: () => void
    onRecolorSelected: (color: string) => void
    onDeleteSelected: () => void
    // Data
    snakePalette: string[]
    selectedCount: number
}

export function GeneratorContextMenu({
    contextMenu,
    onClose,
    onDeleteArrow,
    onReverseArrow,
    onRecolorArrow,
    onDeleteObstacle,
    onUpdateObstacle,
    onFlipSelected,
    onRecolorSelected,
    onDeleteSelected,
    snakePalette,
    selectedCount
}: GeneratorContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

    // Calculate optimal position to avoid going off-screen
    useEffect(() => {
        if (!contextMenu || !menuRef.current) {
            setPosition(null)
            return
        }

        const menu = menuRef.current
        const menuRect = menu.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth
        const padding = 8 // Padding from screen edges

        let x = contextMenu.x
        let y = contextMenu.y

        // Check if menu goes off the right edge
        if (x + menuRect.width > viewportWidth - padding) {
            x = viewportWidth - menuRect.width - padding
        }

        // Check if menu goes off the bottom edge
        if (y + menuRect.height > viewportHeight - padding) {
            // Position above the cursor instead
            y = contextMenu.y - menuRect.height
            // If still off-screen (too close to top), position at top with padding
            if (y < padding) {
                y = padding
            }
        }

        // Check if menu goes off the left edge
        if (x < padding) {
            x = padding
        }

        setPosition({ x, y })
    }, [contextMenu])

    if (!contextMenu) return null

    // Safety check for empty palette
    const safePalette = snakePalette && snakePalette.length > 0 ? snakePalette : ['#FF0000']

    // Use calculated position or fallback to original
    const menuStyle = position
        ? { left: position.x, top: position.y }
        : { left: contextMenu.x, top: contextMenu.y, visibility: 'hidden' as const }

    return (
        <div
            ref={menuRef}
            className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 z-50 min-w-[200px]"
            style={menuStyle}
            onClick={(e) => e.stopPropagation()}
        >
            {/* ==================== ARROW MENU ==================== */}
            {contextMenu.type === 'arrow' && (
                <>
                    {/* Header */}
                    <div className="px-4 py-2 border-b border-gray-700 bg-gray-900/50 rounded-t-lg">
                        <span className="text-xs font-mono text-gray-400">Arrow #{contextMenu.data.id}</span>
                    </div>

                    <div className="py-1">
                        {/* Delete */}
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-red-400 flex items-center gap-2"
                            onClick={() => {
                                onDeleteArrow(contextMenu.data.id)
                                onClose()
                            }}
                        >
                            <Trash2 size={14} /> Delete
                        </button>

                        <div className="border-t border-gray-700 my-1" />

                        {/* Reverse Direction */}
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-gray-400 flex items-center gap-2"
                            onClick={() => {
                                onReverseArrow(contextMenu.data.id, contextMenu.data)
                                onClose()
                            }}
                        >
                            <RotateCcw size={14} /> Reverse Direction
                        </button>

                        <div className="border-t border-gray-700 my-1" />

                        {/* Color Dropdown */}
                        <div className="px-4 py-2 text-sm text-gray-400 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Palette size={14} /> Color:
                            </div>
                            <ColorDropdown
                                color={contextMenu.data.color || safePalette[0]}
                                palette={safePalette}
                                onChange={(color) => {
                                    onRecolorArrow(contextMenu.data.id, color)
                                    onClose()
                                }}
                            />
                        </div>
                    </div>
                </>
            )}

            {/* ==================== OBSTACLE MENU ==================== */}
            {contextMenu.type === 'obstacle' && (
                <>
                    {/* Header */}
                    <div className="px-4 py-2 border-b border-gray-700 bg-gray-900/50 rounded-t-lg">
                        <span className="text-xs font-mono text-gray-400">Obstacle #{contextMenu.data.id}</span>
                    </div>

                    <div className="py-1">
                        {/* Delete */}
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-red-400 flex items-center gap-2"
                            onClick={() => {
                                onDeleteObstacle(contextMenu.data.id)
                                onClose()
                            }}
                        >
                            <Trash2 size={14} /> Delete
                        </button>

                        {/* Direction for tunnel */}
                        {contextMenu.data.type === 'tunnel' && (
                            <>
                                <div className="border-t border-gray-700 my-1" />
                                <div className="px-4 py-2 text-sm text-gray-400 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <ArrowUpDown size={14} /> Direction:
                                    </div>
                                    <DirectionDropdown
                                        direction={contextMenu.data.direction || 'right'}
                                        onChange={(direction) => {
                                            onUpdateObstacle(contextMenu.data.id, { direction })
                                            onClose()
                                        }}
                                    />
                                </div>
                            </>
                        )}

                        {/* Countdown for wall_break */}
                        {contextMenu.data.type === 'wall_break' && (
                            <>
                                <div className="border-t border-gray-700 my-1" />
                                <div className="px-4 py-2 text-sm text-gray-400 flex items-center gap-2">
                                    <Hash size={14} /> Countdown:
                                    <input
                                        type="number"
                                        className="w-12 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                        defaultValue={contextMenu.data.count || 3}
                                        min={1}
                                        max={99}
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={(e) => {
                                            const value = parseInt(e.target.value) || 3
                                            onUpdateObstacle(contextMenu.data.id, { count: value })
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const value = parseInt((e.target as HTMLInputElement).value) || 3
                                                onUpdateObstacle(contextMenu.data.id, { count: value })
                                                onClose()
                                            }
                                        }}
                                    />
                                </div>
                            </>
                        )}

                        {/* Color for hole/tunnel */}
                        {(contextMenu.data.type === 'hole' || contextMenu.data.type === 'tunnel') && (
                            <>
                                <div className="border-t border-gray-700 my-1" />
                                <div className="px-4 py-2 text-sm text-gray-400 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Palette size={14} /> Color:
                                    </div>
                                    <ColorDropdown
                                        color={contextMenu.data.color || safePalette[0]}
                                        palette={safePalette}
                                        onChange={(color) => {
                                            onUpdateObstacle(contextMenu.data.id, { color })
                                            onClose()
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* ==================== BULK MENU ==================== */}
            {contextMenu.type === 'bulk' && (
                <>
                    {/* Header - "X arrows selected" style */}
                    <div className="px-4 py-2 border-b border-gray-700 bg-gray-900/50 rounded-t-lg">
                        <span className="text-sm text-gray-300">{selectedCount} arrows selected</span>
                    </div>

                    <div className="py-1">
                        {/* Delete X arrows */}
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-red-400 flex items-center gap-2"
                            onClick={() => {
                                onDeleteSelected()
                                onClose()
                            }}
                        >
                            <Trash2 size={14} /> Delete {selectedCount} arrows
                        </button>

                        <div className="border-t border-gray-700 my-1" />

                        {/* Flip Selected (X) */}
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-gray-400 flex items-center gap-2"
                            onClick={() => {
                                onFlipSelected()
                                onClose()
                            }}
                        >
                            <RotateCcw size={14} /> Flip Selected ({selectedCount})
                        </button>

                        <div className="border-t border-gray-700 my-1" />

                        {/* Recolor Selected */}
                        <div className="px-4 py-2 text-sm text-gray-400 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Palette size={14} /> Recolor Selected:
                            </div>
                            <ColorDropdown
                                color={safePalette[0]}
                                palette={safePalette}
                                label="Color"
                                onChange={(color) => {
                                    onRecolorSelected(color)
                                    onClose()
                                }}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
