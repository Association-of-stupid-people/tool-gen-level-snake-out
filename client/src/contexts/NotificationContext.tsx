import { type ReactNode } from 'react'
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react'
import { useNotificationStore, type Notification } from '../stores'

// Re-export for backward compatibility
export { useNotification } from '../stores'
export type { NotificationType, Notification } from '../stores'

// Provider only renders the notification UI
export function NotificationProvider({ children }: { children: ReactNode }) {
    const notifications = useNotificationStore((s) => s.notifications)
    const removeNotification = useNotificationStore((s) => s.removeNotification)

    return (
        <>
            {children}
            <NotificationContainer notifications={notifications} onClose={removeNotification} />
        </>
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
    const bgColors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600',
        warning: 'bg-yellow-600'
    }

    const icons = {
        success: <CheckCircle size={20} className="text-white" />,
        error: <AlertCircle size={20} className="text-white" />,
        info: <Info size={20} className="text-white" />,
        warning: <AlertTriangle size={20} className="text-white" />
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

            <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
        </div>
    )
}

