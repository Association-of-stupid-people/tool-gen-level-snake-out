import { useState, useRef, useEffect } from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface ColorPickerPopupProps {
    color: string
    onChange: (color: string) => void
}

export function ColorPickerPopup({ color, onChange }: ColorPickerPopupProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })
    const popupRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLDivElement>(null)

    // Calculate popup position when opening
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            const popupHeight = 320 // Approximate popup height
            const popupWidth = 230 // Approximate popup width

            let top = rect.top
            let left = rect.right + 8

            // Check if popup would overflow bottom of viewport
            if (top + popupHeight > window.innerHeight) {
                // Position it so bottom aligns with viewport bottom (with padding)
                top = window.innerHeight - popupHeight - 16
            }

            // Ensure top doesn't go negative
            if (top < 16) {
                top = 16
            }

            // Check if popup would overflow right of viewport
            if (left + popupWidth > window.innerWidth) {
                // Position to the left of the button instead
                left = rect.left - popupWidth - 8
            }

            // Ensure left doesn't go negative
            if (left < 16) {
                left = 16
            }

            setPopupPos({ top, left })
        }
    }, [isOpen])

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                popupRef.current &&
                !popupRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    return (
        <>
            {/* Color Swatch Button */}
            <div
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="h-8 w-8 rounded-lg cursor-pointer ring-1 ring-white/20 hover:ring-purple-500 transition-all shadow-md hover:scale-105 shrink-0"
                style={{ backgroundColor: color }}
                title="Click to pick color"
            />

            {/* Portal Popup */}
            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            ref={popupRef}
                            initial={{ opacity: 0, scale: 0.9, x: -10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9, x: -10 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="fixed z-[9999] p-3 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl"
                            style={{
                                top: popupPos.top,
                                left: popupPos.left,
                                minWidth: '220px'
                            }}
                        >
                            {/* Color Picker */}
                            <div className="color-picker-wrapper">
                                <HexColorPicker
                                    color={color}
                                    onChange={onChange}
                                    style={{ width: '100%', height: '160px' }}
                                />
                            </div>

                            {/* Hex Input */}
                            <div className="mt-3 flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-mono">#</span>
                                <HexColorInput
                                    color={color}
                                    onChange={onChange}
                                    prefixed={false}
                                    className="flex-1 bg-gray-900/80 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white font-mono uppercase focus:outline-none focus:border-purple-500 transition-colors"
                                />
                                <div
                                    className="h-6 w-6 rounded-md border border-gray-600"
                                    style={{ backgroundColor: color }}
                                />
                            </div>

                            {/* Preset Colors */}
                            <div className="mt-3 pt-3 border-t border-gray-700">
                                <p className="text-[10px] text-gray-500 mb-2">Quick Colors</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        '#FF6B9D', '#7CFC00', '#FF00FF', '#00FFFF',
                                        '#FF8C00', '#DEB887', '#FFD700', '#00BFFF',
                                        '#FF4500', '#9370DB', '#32CD32', '#FF69B4'
                                    ].map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => onChange(c)}
                                            className={`h-5 w-5 rounded-md border transition-all hover:scale-110 ${color === c ? 'border-white ring-1 ring-purple-500' : 'border-gray-600'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    )
}

