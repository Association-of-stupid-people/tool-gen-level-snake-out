import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

export type NotificationType = 'success' | 'error' | 'info'

export interface Notification {
    id: string
    type: NotificationType
    message: string
}

interface NotificationContextType {
    addNotification: (type: NotificationType, message: string, duration?: number) => void
    removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotification() {
    const context = useContext(NotificationContext)
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider')
    }
    return context
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([])

    const addNotification = useCallback((type: NotificationType, message: string, duration = 5000) => {
        const id = Math.random().toString(36).substring(2, 9)
        console.log(`Adding notification: ${message} (${id})`)
        setNotifications(prev => [...prev, { id, type, message }])

        if (duration > 0) {
            setTimeout(() => {
                removeNotification(id)
            }, duration)
        }
    }, [])

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id))
    }, [])

    return (
        <NotificationContext.Provider value={{ addNotification, removeNotification }}>
            {children}
            <NotificationContainer notifications={notifications} onClose={removeNotification} />
        </NotificationContext.Provider>
    )
}

function NotificationContainer({ notifications, onClose }: { notifications: Notification[], onClose: (id: string) => void }) {
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {notifications.map(notification => (
                <NotificationItem key={notification.id} notification={notification} onClose={onClose} />
            ))}
        </div>
    )
}

function NotificationItem({ notification, onClose }: { notification: Notification, onClose: (id: string) => void }) {
    // Simple slide-in animation handled by CSS/Tailwind classes could be tricky without a library for enter/exit,
    // but we can do a simple keyframe animation on mount.
    // For simplicity and "animation day du", we'll add a keyframe animation class.

    const bgColors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600'
    }

    const icons = {
        success: <CheckCircle size={20} className="text-white" />,
        error: <AlertCircle size={20} className="text-white" />,
        info: <Info size={20} className="text-white" />
    }

    return (
        <div className={`
      pointer-events-auto
      flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white
      ${bgColors[notification.type]}
      animate-[slideIn_0.3s_ease-out_forwards]
      hover:opacity-90 transition-opacity cursor-pointer
    `}
            onClick={() => onClose(notification.id)}
        >
            {icons[notification.type]}
            <span className="text-sm font-medium">{notification.message}</span>
            <button onClick={(e) => { e.stopPropagation(); onClose(notification.id) }} className="ml-2 text-white/50 hover:text-white">
                <X size={16} />
            </button>

            {/* Inline style for the animation keyframes since we might not have them in tailwind config */}
            <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
        </div>
    )
}
