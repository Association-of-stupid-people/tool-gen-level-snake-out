import { Grid, Wand2, Settings } from 'lucide-react'

interface LeftSidebarProps {
    activePanel: 'panel1' | 'panel2' | 'settings'
    onPanelChange: (panel: 'panel1' | 'panel2' | 'settings') => void
}

export function LeftSidebar({ activePanel, onPanelChange }: LeftSidebarProps) {
    const panels = [
        { id: 'panel1' as const, icon: Grid, label: 'Grid Editor', description: 'Define region' },
        { id: 'panel2' as const, icon: Wand2, label: 'Generator', description: 'Create level' },
        { id: 'settings' as const, icon: Settings, label: 'Settings', description: 'Configure' },
    ]

    return (
        <div className="w-20 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-6 gap-4">
            {panels.map(panel => {
                const Icon = panel.icon
                const isActive = activePanel === panel.id

                return (
                    <button
                        key={panel.id}
                        onClick={() => onPanelChange(panel.id)}
                        className={`
              relative group w-14 h-14 rounded-xl flex items-center justify-center
              transition-all duration-200
              ${isActive
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                            }
            `}
                        title={panel.label}
                    >
                        <Icon size={24} />
                        {isActive && (
                            <div className="absolute -right-1 top-0 bottom-0 w-1 bg-purple-400 rounded-l" />
                        )}
                    </button>
                )
            })}
        </div>
    )
}
