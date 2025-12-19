import { Grid, Wand2, Settings } from 'lucide-react'

interface LeftSidebarProps {
    activePanel: 'panel1' | 'panel2' | 'settings'
    onPanelChange: (panel: 'panel1' | 'panel2' | 'settings') => void
    rows: number
    cols: number
    onGridSizeChange: (rows: number, cols: number) => void
}

export function LeftSidebar({ activePanel, onPanelChange, rows, cols, onGridSizeChange }: LeftSidebarProps) {
    const panels = [
        { id: 'panel1' as const, icon: Grid, label: 'Grid' },
        { id: 'panel2' as const, icon: Wand2, label: 'Generator' },
        { id: 'settings' as const, icon: Settings, label: 'Settings' },
    ]

    return (
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
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
                    <div className="space-y-6">
                        <h2 className="text-lg font-bold text-white mb-4">Grid Settings</h2>

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
                                        value={rows}
                                        onChange={(e) => onGridSizeChange(parseInt(e.target.value) || 1, cols)}
                                        className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                        min="1"
                                        max="100"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Columns</label>
                                    <input
                                        type="number"
                                        value={cols}
                                        onChange={(e) => onGridSizeChange(rows, parseInt(e.target.value) || 1)}
                                        className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                        min="1"
                                        max="100"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activePanel === 'panel2' && (
                    <div className="text-center text-gray-500 mt-10">
                        <p>Generator options will be here.</p>
                    </div>
                )}

                {activePanel === 'settings' && (
                    <div className="text-center text-gray-500 mt-10">
                        <p>Global settings.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
