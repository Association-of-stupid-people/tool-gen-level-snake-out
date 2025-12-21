import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

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
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-purple-500 flex items-center justify-between transition-colors hover:bg-gray-800/50"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{displayText}</span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Custom dropdown menu */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute top-full right-0 left-0 bg-gray-800 border border-gray-600 rounded-lg mt-2 z-20 shadow-xl max-h-48 overflow-y-auto origin-top"
                        >
                            <div className="p-1">
                                {showRandomOption && (
                                    <button
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700/80 rounded-md text-left transition-colors"
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
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700/80 rounded-md text-left transition-colors"
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
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
