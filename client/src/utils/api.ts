/**
 * API utility functions with authentication support
 */
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

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

/**
 * Make authenticated API request
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken()
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // Add auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  // If unauthorized, clear token and reload
  if (response.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    // Optionally redirect to login or show auth modal
    window.location.reload()
  }

  return response
}

/**
 * Make authenticated POST request with FormData (for file uploads)
 */
export async function apiRequestFormData(
  endpoint: string,
  formData: FormData,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken()
  
  const headers: HeadersInit = {
    ...options.headers,
  }

  // Add auth token if available (don't set Content-Type for FormData)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    method: 'POST',
    headers,
    body: formData,
  })

  // If unauthorized, clear token and reload
  if (response.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    window.location.reload()
  }

  return response
}

