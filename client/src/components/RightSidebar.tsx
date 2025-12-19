import { Pencil, Eraser, Shapes, Upload, Trash2 } from 'lucide-react'

interface RightSidebarProps {
    currentTool: 'pen' | 'eraser' | 'shape'
    onToolChange: (tool: 'pen' | 'eraser' | 'shape') => void
    currentShape: 'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'frame'
    onShapeChange: (shape: 'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'frame') => void
    onImageUpload: (file: File) => void
    onClearGrid: () => void
    rows: number
    cols: number
    onGridSizeChange: (rows: number, cols: number) => void
}

export function RightSidebar({
    currentTool,
    onToolChange,
    currentShape,
    onShapeChange,
    onImageUpload,
    onClearGrid,
    rows,
    cols,
    onGridSizeChange
}: RightSidebarProps) {
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

    return (
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-6 overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">Tools</h2>

            {/* Drawing Tools - Vertical */}
            <div className="space-y-3 mb-8">
                {tools.map(tool => {
                    const Icon = tool.icon
                    const isActive = currentTool === tool.id

                    return (
                        <button
                            key={tool.id}
                            onClick={() => onToolChange(tool.id)}
                            className={`
                                w-full flex items-center gap-3 p-4 rounded-xl transition-all
                                ${isActive
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }
                            `}
                        >
                            <Icon size={22} />
                            <span className="text-sm font-medium">{tool.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Shape Selector - Show when Shape tool is active */}
            {currentTool === 'shape' && (
                <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
                    <h3 className="text-sm font-semibold text-white mb-3">Select Shape</h3>
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
                {/* Grid Size */}
                <div className="bg-gray-700/50 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Grid Size</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Rows</label>
                            <input
                                type="number"
                                value={rows}
                                onChange={e => onGridSizeChange(Number(e.target.value), cols)}
                                className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                min="10"
                                max="200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Cols</label>
                            <input
                                type="number"
                                value={cols}
                                onChange={e => onGridSizeChange(rows, Number(e.target.value))}
                                className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                min="10"
                                max="200"
                            />
                        </div>
                    </div>
                </div>

                {/* Image Import */}
                <div className="bg-gray-700/50 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Import Image</h3>
                    <label className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition">
                        <Upload size={18} />
                        <span className="text-sm font-medium">Upload Mask</span>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => e.target.files?.[0] && onImageUpload(e.target.files[0])}
                        />
                    </label>
                    <p className="text-xs text-gray-400 mt-2">Upload an image to auto-trace</p>
                </div>

                {/* Actions */}
                <div className="bg-gray-700/50 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Actions</h3>
                    <button
                        onClick={onClearGrid}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-700 rounded-lg transition"
                    >
                        <Trash2 size={18} />
                        <span className="text-sm font-medium">Clear Grid</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
