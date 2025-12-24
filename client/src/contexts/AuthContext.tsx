import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id?: number
  username?: string
  email?: string
  name?: string
}

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  token: string | null
  login: (usernameOrPassword: string, password?: string) => Promise<boolean>
  register: (username: string, password: string) => Promise<boolean>
  logout: () => void
  authMethod: 'simple' | 'jwt' | 'oauth' | null
  requiresUsername: boolean
  supportsRegistration: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Construct API base URL - ensure it ends with /api
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (!envUrl) {
    return 'http://localhost:5000/api'
  }
  // If URL doesn't end with /api, add it
  if (envUrl.endsWith('/api')) {
    return envUrl
  } else if (envUrl.endsWith('/')) {
    return `${envUrl}api`
  } else {
    return `${envUrl}/api`
  }
}

const API_BASE_URL = getApiBaseUrl()

// Debug: Log API base URL
console.log('[AUTH] API Base URL:', API_BASE_URL)
console.log('[AUTH] VITE_API_URL env:', import.meta.env.VITE_API_URL)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [authMethod, setAuthMethod] = useState<'simple' | 'jwt' | 'oauth' | null>(null)
  const [requiresUsername, setRequiresUsername] = useState(false)
  const [supportsRegistration, setSupportsRegistration] = useState(false)

  // Load auth state from localStorage on mount
  useEffect(() => {
    checkAuthMethod()
    loadAuthState()
  }, [])

  const checkAuthMethod = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/method`)
      const data = await response.json()
      setAuthMethod(data.method)
      setRequiresUsername(data.requires_username)
      setSupportsRegistration(data.supports_registration)
    } catch (error) {
      console.error('Failed to check auth method:', error)
      setAuthMethod('simple') // Default to simple
    }
  }

  const loadAuthState = () => {
    const savedToken = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('auth_user')
    const savedExpiresAt = localStorage.getItem('auth_token_expires_at')
    
    if (savedToken) {
      // Check if token is expired
      if (savedExpiresAt) {
        const expiresAt = parseInt(savedExpiresAt, 10)
        const currentTime = Math.floor(Date.now() / 1000)
        
        if (currentTime > expiresAt) {
          // Token expired, clear it
          console.log('[AUTH] Token expired, clearing...')
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
          localStorage.removeItem('auth_token_expires_at')
          setIsLoading(false)
          return
        }
      }
      
      setToken(savedToken)
      setIsAuthenticated(true)
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser))
        } catch (e) {
          console.error('Failed to parse saved user:', e)
        }
      }
    }
    
    setIsLoading(false)
  }

  const login = async (usernameOrPassword: string, password?: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      
      const payload: any = {}
      if (authMethod === 'jwt' && password) {
        payload.username = usernameOrPassword
        payload.password = password
      } else {
        // Simple auth - just password
        payload.password = usernameOrPassword
      }

      const loginUrl = `${API_BASE_URL}/auth/login`
      console.log('[DEBUG] Login URL:', loginUrl)
      console.log('[DEBUG] Login payload:', payload)
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('[DEBUG] Non-JSON response:', text.substring(0, 200))
        throw new Error('Server returned non-JSON response. Check if server is running and URL is correct.')
      }

      const data = await response.json()
      console.log('[DEBUG] Login response:', data)

      if (data.success && data.token) {
        setToken(data.token)
        setIsAuthenticated(true)
        localStorage.setItem('auth_token', data.token)
        
        // Save expiry timestamp if provided
        if (data.expires_at) {
          localStorage.setItem('auth_token_expires_at', data.expires_at.toString())
        } else if (data.expires_in) {
          // Calculate expiry from expires_in (seconds)
          const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in
          localStorage.setItem('auth_token_expires_at', expiresAt.toString())
        }
        
        if (data.user) {
          setUser(data.user)
          localStorage.setItem('auth_user', JSON.stringify(data.user))
        }
        
        setIsLoading(false)
        return true
      } else {
        setIsLoading(false)
        return false
      }
    } catch (error) {
      console.error('Login error:', error)
      setIsLoading(false)
      return false
    }
  }

  const register = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (data.success) {
        // Auto login after registration
        return await login(username, password)
      } else {
        setIsLoading(false)
        return false
      }
    } catch (error) {
      console.error('Registration error:', error)
      setIsLoading(false)
      return false
    }
  }

  const logout = () => {
    setToken(null)
    setIsAuthenticated(false)
    setUser(null)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_token_expires_at')
  }

  // Verify token on mount and periodically, and check expiry
  useEffect(() => {
    if (token) {
      verifyToken()
      
      // Check expiry every minute
      const expiryCheckInterval = setInterval(() => {
        const savedExpiresAt = localStorage.getItem('auth_token_expires_at')
        if (savedExpiresAt) {
          const expiresAt = parseInt(savedExpiresAt, 10)
          const currentTime = Math.floor(Date.now() / 1000)
          
          if (currentTime > expiresAt) {
            console.log('[AUTH] Token expired, logging out...')
            logout()
          }
        }
      }, 60 * 1000) // Check every minute
      
      // Verify with server every 5 minutes
      const verifyInterval = setInterval(verifyToken, 5 * 60 * 1000)
      
      return () => {
        clearInterval(expiryCheckInterval)
        clearInterval(verifyInterval)
      }
    }
  }, [token])

  const verifyToken = async () => {
    if (!token) return

    // Check expiry locally first
    const savedExpiresAt = localStorage.getItem('auth_token_expires_at')
    if (savedExpiresAt) {
      const expiresAt = parseInt(savedExpiresAt, 10)
      const currentTime = Math.floor(Date.now() / 1000)
      
      if (currentTime > expiresAt) {
        console.log('[AUTH] Token expired locally')
        logout()
        return
      }
    }

    try {
      const expiresAt = savedExpiresAt ? parseInt(savedExpiresAt, 10) : undefined
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, expires_at: expiresAt }),
      })

      const data = await response.json()

      if (!data.valid) {
        console.log('[AUTH] Token invalid:', data.error)
        logout()
      }
    } catch (error) {
      console.error('Token verification error:', error)
      // Don't logout on network errors, might be temporary
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        token,
        login,
        register,
        logout,
        authMethod,
        requiresUsername,
        supportsRegistration,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

