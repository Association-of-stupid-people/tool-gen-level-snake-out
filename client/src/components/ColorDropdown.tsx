import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useLanguage } from '../i18n'

interface ColorDropdownProps {
    color: string
    palette: string[]
    onChange: (color: string) => void
    showRandomOption?: boolean
    onRandomSelect?: () => void
    isRandomSelected?: boolean
}

export function ColorDropdown({
    color,
    palette,
    onChange,
    showRandomOption,
    onRandomSelect,
    isRandomSelected
}: ColorDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const { t } = useLanguage()
    const index = palette.indexOf(color)

    return (
        <div className="relative w-full">
            <button
                className={`w-full bg-gray-900 border ${isRandomSelected ? 'border-purple-500 text-purple-400' : 'border-gray-600 text-white'} rounded px-2 py-1.5 text-xs flex items-center justify-between hover:border-gray-500 transition-colors`}
                style={!isRandomSelected ? { borderLeft: `8px solid ${color}` } : undefined}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">
                    {isRandomSelected ? t('randomColor' as any) : `${t('color')} ${index !== -1 ? index + 1 : '?'}`}
                </span>
                <ChevronDown size={12} className="text-gray-400" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 left-0 bg-gray-800 border border-gray-600 rounded mt-1 z-20 shadow-xl max-h-48 overflow-y-auto">
                        {showRandomOption && onRandomSelect && (
                            <button
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-left transition-colors border-b border-gray-700/50"
                                onClick={() => {
                                    onRandomSelect()
                                    setIsOpen(false)
                                }}
                            >
                                <div className="w-3 h-3 rounded-full shrink-0 border border-purple-500 bg-purple-500/20" />
                                <span className="text-xs text-purple-300">{t('randomColor' as any)}</span>
                            </button>
                        )}
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
                                <span className="text-xs text-gray-200">{t('color')} {i + 1} <span className="text-gray-500 font-mono ml-1">({c})</span></span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
