import { motion, type HTMLMotionProps } from 'framer-motion'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import React from 'react'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export interface AnimatedButtonProps extends HTMLMotionProps<"button"> {
    children: React.ReactNode
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

export function AnimatedButton({ children, className, variant, ...props }: AnimatedButtonProps) {
    // Base hover/tap effects
    const defaultAnimation = {
        whileHover: { scale: 1.05 },
        whileTap: { scale: 0.95 }
    }

    return (
        <motion.button
            {...defaultAnimation}
            className={cn(className)}
            {...props}
        >
            {children}
        </motion.button>
    )
}
