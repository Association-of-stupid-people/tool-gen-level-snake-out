import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, User, X, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface AuthModalProps {
  isOpen: boolean
  onClose?: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register, authMethod, requiresUsername, supportsRegistration, isLoading } = useAuth()
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setUsername('')
      setPassword('')
      setConfirmPassword('')
      setError('')
      setIsRegisterMode(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (isRegisterMode && supportsRegistration) {
        // Registration
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setIsSubmitting(false)
          return
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          setIsSubmitting(false)
          return
        }
        
        const success = await register(username, password)
        if (!success) {
          setError('Registration failed. Username may already exist.')
        } else {
          // Success - modal will close automatically
          if (onClose) onClose()
        }
      } else {
        // Login
        const success = requiresUsername
          ? await login(username, password)
          : await login(password)
        
        if (!success) {
          setError(requiresUsername 
            ? 'Invalid username or password'
            : 'Invalid password')
        } else {
          // Success - modal will close automatically
          if (onClose) onClose()
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error('Auth error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 relative"
        >
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={24} />
            </button>
          )}

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Lock className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isRegisterMode ? 'Create Account' : 'Authentication Required'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isRegisterMode 
                  ? 'Create a new account to continue'
                  : 'Please authenticate to access this application'}
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="text-red-600 dark:text-red-400" size={20} />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username field (for JWT auth) */}
            {requiresUsername && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your username"
                    disabled={isSubmitting || isLoading}
                  />
                </div>
              </div>
            )}

            {/* Password field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {requiresUsername ? 'Password' : 'Access Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={requiresUsername ? 'Enter your password' : 'Enter access password'}
                  disabled={isSubmitting || isLoading}
                />
              </div>
            </div>

            {/* Confirm password (registration only) */}
            {isRegisterMode && supportsRegistration && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm your password"
                    disabled={isSubmitting || isLoading}
                  />
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {isSubmitting || isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isRegisterMode ? 'Creating Account...' : 'Authenticating...'}
                </span>
              ) : (
                isRegisterMode ? 'Create Account' : 'Login'
              )}
            </button>
          </form>

          {/* Toggle register/login */}
          {supportsRegistration && (
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode)
                  setError('')
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                disabled={isSubmitting || isLoading}
              >
                {isRegisterMode
                  ? 'Already have an account? Login'
                  : "Don't have an account? Register"}
              </button>
            </div>
          )}

          {/* Auth method info */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Authentication Method: <span className="font-semibold capitalize">{authMethod || 'loading...'}</span>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

