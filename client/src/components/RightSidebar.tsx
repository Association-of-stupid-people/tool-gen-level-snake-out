import { Pencil, Eraser, Shapes, Upload, Trash2 } from 'lucide-react'

interface RightSidebarProps {
    currentTool: 'pen' | 'eraser' | 'shape'
    onToolChange: (tool: 'pen' | 'eraser' | 'shape') => void
    currentShape: 'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'frame'
    onShapeChange: (shape: 'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'frame') => void
    onImageUpload: (file: File) => void
    onClearGrid: () => void
}

export function RightSidebar({
    currentTool,
    onToolChange,
    currentShape,
    onShapeChange,
    onImageUpload,
    onClearGrid
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
            <h2 className="text-lg font-bold text-white mb-6">Tools & Options</h2>

            {/* Tool Selection */}
            <div className="flex gap-2 mb-6 bg-gray-700/50 p-1.5 rounded-xl">
                {tools.map(tool => {
                    const Icon = tool.icon
                    const isActive = currentTool === tool.id
                    return (
                        <button
                            key={tool.id}
                            onClick={() => onToolChange(tool.id)}
                            className={`
                                flex-1 flex flex-col items-center justify-center py-3 rounded-lg gap-1.5
                                transition-all duration-200
                                ${isActive
                                    ? 'bg-purple-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
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
                    <button
                        onClick={onClearGrid}
                        className="w-full py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-medium"
                    >
                        Clear Grid
                    </button>
                </div>
            </div>
        </div>
    )
}
