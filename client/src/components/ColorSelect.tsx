import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface ColorSelectProps {
    value: string
    palette: string[]
    onChange: (color: string) => void
    showRandomOption?: boolean
    isRandomSelected?: boolean
}

// Hybrid dropdown: looks like native select outside, shows color swatches on dropdown
export function ColorSelect({
    value,
    palette,
    onChange,
    showRandomOption,
    isRandomSelected
}: ColorSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const index = palette.indexOf(value)

    const displayText = isRandomSelected ? 'Random' : `Color ${index !== -1 ? index + 1 : '?'}`

    return (
        <div className="relative w-full">
            {/* Button styled like native select */}
            <button
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-purple-500 flex items-center justify-between"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{displayText}</span>
                <ChevronDown size={14} className="text-gray-400" />
            </button>

            {/* Custom dropdown with color swatches */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 left-0 bg-gray-800 border border-gray-600 rounded-lg mt-1 z-20 shadow-xl max-h-48 overflow-y-auto">
                        {showRandomOption && (
                            <button
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-left transition-colors border-b border-gray-700/50"
                                onClick={() => {
                                    onChange('random')
                                    setIsOpen(false)
                                }}
                            >
                                <div className="w-3 h-3 rounded-full shrink-0 border border-purple-500 bg-purple-500/20" />
                                <span className="text-xs text-purple-300">Random</span>
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
                                <span className="text-xs text-gray-200">Color {i + 1} <span className="text-gray-500 font-mono ml-1">({c})</span></span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
