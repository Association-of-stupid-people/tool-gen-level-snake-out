import { create } from 'zustand'

export type NotificationType = 'success' | 'error' | 'info' | 'warning'

export interface Notification {
    id: string
    type: NotificationType
    message: string
}

interface NotificationState {
    notifications: Notification[]
    addNotification: (type: NotificationType, message: string, duration?: number) => void
    removeNotification: (id: string) => void
    clearAll: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],

    addNotification: (type, message, duration = 5000) => {
        const id = Math.random().toString(36).substring(2, 9)
        set((state) => ({
            notifications: [...state.notifications, { id, type, message }]
        }))

        if (duration > 0) {
            setTimeout(() => {
                get().removeNotification(id)
            }, duration)
        }
    },

    removeNotification: (id) => {
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id)
        }))
    },

    clearAll: () => set({ notifications: [] }),
}))

// Compatibility hook
export const useNotification = () => {
    const addNotification = useNotificationStore((s) => s.addNotification)
    const removeNotification = useNotificationStore((s) => s.removeNotification)
    return { addNotification, removeNotification }
}
