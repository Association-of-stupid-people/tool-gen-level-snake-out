import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { NotificationProvider } from './contexts/NotificationContext'
import { LanguageProvider } from './i18n'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <NotificationProvider>
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        </NotificationProvider>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>,
)

