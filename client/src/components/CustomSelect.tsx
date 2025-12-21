import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Option {
    value: string | number
    label: string
}

interface CustomSelectProps {
    value: string | number
    options: Option[]
    onChange: (value: string) => void
    placeholder?: string
}

// Generic custom dropdown: matches styling of ColorSelect but for text options
export function CustomSelect({
    value,
    options,
    onChange,
    placeholder = 'Select...'
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false)

    const selectedOption = options.find(opt => opt.value === value)
    const displayText = selectedOption ? selectedOption.label : placeholder

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

            {/* Custom dropdown menu */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 left-0 bg-gray-800 border border-gray-600 rounded-lg mt-1 z-20 shadow-xl max-h-48 overflow-y-auto">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-left transition-colors border-b border-gray-700/50 last:border-0"
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
                </>
            )}
        </div>
    )
}
