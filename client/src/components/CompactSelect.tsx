import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

interface Option {
    value: string | number
    label: string
}

interface CompactSelectProps {
    value: string | number
    options: Option[]
    onChange: (value: string) => void
    placeholder?: string
}

// Compact dropdown for strategy configs - smaller text and tighter spacing
export function CompactSelect({
    value,
    options,
    onChange,
    placeholder = 'Select...'
}: CompactSelectProps) {
    const [isOpen, setIsOpen] = useState(false)

    const selectedOption = options.find(opt => opt.value === value)
    const displayText = selectedOption ? selectedOption.label : placeholder

    return (
        <div className="relative w-full">
            {/* Button styled like native select */}
            <button
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white appearance-none focus:outline-none focus:border-purple-500 flex items-center justify-between transition-colors hover:bg-gray-800/50"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{displayText}</span>
                <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
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
                                {options.map((opt) => (
                                    <button
                                        key={opt.value}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700/80 rounded-md text-left transition-colors"
                                        onClick={() => {
                                            onChange(String(opt.value))
                                            setIsOpen(false)
                                        }}
                                    >
                                        <span className={`text-xs ${opt.value === value ? 'text-white font-medium' : 'text-gray-300'}`}>
                                            {opt.label}
                                        </span>
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
